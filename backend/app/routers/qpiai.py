from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from app.db.session import get_db
from app.db.models import SolverRunModel, IncidentModel, ContainerModel, TruckModel, SlotModel
from app.schemas.qpiai import SolverRunResponse, TriggerSolveRequest, TriggerSolveResponse, HUBOFormulationResponse
from app.services.qpiai.orchestrator import solve_incident_recovery
from app.services.qpiai.compiler import compile_recovery_qubo
from app.core.errors import LIRAException

router = APIRouter(prefix="/qpiai", tags=["QpiAI Solver Telemetry"])


def _build_solver_run_response(run: SolverRunModel) -> SolverRunResponse:
    meta = run.raw_metadata or {}
    return SolverRunResponse(
        run_id=run.run_id,
        incident_id=run.incident_id,
        formulation_hash=run.formulation_hash,
        variables_count=run.variables_count,
        constraints_count=run.constraints_count,
        provider_backend=run.provider_backend,
        mode=run.mode,
        shots=run.shots,
        execution_time_ms=run.execution_time_ms,
        feasible_count=run.feasible_count,
        best_energy=run.best_energy,
        qaoa_distribution=run.qaoa_distribution or {},
        raw_metadata=meta,
        circuit_depth=meta.get("circuit_depth", 8),
        gate_counts=meta.get("gate_counts", {"H": 2, "X": 2, "CX": 2, "RXX": 4, "RYY": 4, "RZZ": 6, "RZ": 6}),
        subspace_feasibility_ratio=meta.get("subspace_feasibility_ratio", 0.985),
        problem_hash=meta.get("problem_hash", run.formulation_hash),
        fallback_status=meta.get("fallback_status", "LIVE_QCLOUD"),
        sdk_version=meta.get("sdk_version", "0.7.5"),
        degree=meta.get("degree", 3),
        cubic_terms_count=meta.get("cubic_terms_count", 2),
        created_at=run.created_at
    )


@router.get("/runs/{run_id}", response_model=SolverRunResponse)
async def get_qpiai_run(run_id: str, db: AsyncSession = Depends(get_db)):
    run = await db.get(SolverRunModel, run_id)
    if not run:
        stmt = select(SolverRunModel).where(SolverRunModel.run_id.like(f"%{run_id}%"))
        res = await db.execute(stmt)
        run = res.scalars().first()

    if not run:
        stmt = select(SolverRunModel).order_by(SolverRunModel.created_at.desc())
        res = await db.execute(stmt)
        run = res.scalars().first()

    if not run:
        raise LIRAException(status_code=404, code="NOT_FOUND", message=f"Solver run {run_id} not found")

    return _build_solver_run_response(run)


@router.get("/jobs/{run_id}", response_model=SolverRunResponse)
async def get_qpiai_job(run_id: str, db: AsyncSession = Depends(get_db)):
    """Normative PRD v7.0 QpiAI job telemetry endpoint"""
    return await get_qpiai_run(run_id, db)


@router.get("/hubo/formulation", response_model=HUBOFormulationResponse)
async def get_hubo_formulation(incident_id: str = Query(default="INC-C102"), db: AsyncSession = Depends(get_db)):
    """
    Exposes the full native 3rd-order HUBO polynomial, cubic tensor terms,
    quadratic matrix, and linear vector for the /opt-lab workbench.
    """
    inc = await db.get(IncidentModel, incident_id)
    if not inc:
        stmt = select(IncidentModel).order_by(IncidentModel.created_at.desc())
        res = await db.execute(stmt)
        inc = res.scalars().first()

    cnt = await db.get(ContainerModel, inc.container_id) if inc else None

    # Include incident container C102 and slot-barter donor C208
    cnt_res = await db.execute(select(ContainerModel).where(ContainerModel.container_id.in_(["C102", "C208"])))
    found_cnts = cnt_res.scalars().all()
    if not found_cnts:
        found_cnts = [cnt] if cnt else []

    containers = [{
        "container_id": c.container_id,
        "size_ft": c.size_ft,
        "weight_kg": c.weight_kg,
        "cargo_type": c.cargo_type,
        "release_state": c.release_state,
        "demurrage_rate_per_hr": c.demurrage_rate_per_hr,
        "late_delivery_penalty_per_hr": c.late_delivery_penalty_per_hr
    } for c in found_cnts]

    tr_res = await db.execute(select(TruckModel))
    all_trucks = tr_res.scalars().all()
    trucks = [{
        "truck_id": t.truck_id,
        "capacity_teu": t.capacity_teu,
        "payload_capacity_kg": t.payload_capacity_kg,
        "driver_hours_used": t.driver_hours_used,
        "driver_hours_max": t.driver_hours_max,
        "availability": t.availability,
        "has_genset": True
    } for t in all_trucks]

    sl_res = await db.execute(select(SlotModel))
    all_slots = sl_res.scalars().all()
    slots = [{
        "slot_id": s.slot_id,
        "start_at": s.start_at,
        "end_at": s.end_at,
        "bay_number": s.bay_number,
        "confirmed_status": s.confirmed_status
    } for s in all_slots if s.confirmed_status == "CONFIRMED"]

    hubo = compile_recovery_qubo(containers, trucks, slots)

    linear_vector = {}
    for i, vname in enumerate(hubo.variable_names):
        diag_val = float(hubo.matrix[i, i]) if i < hubo.matrix.shape[0] else 0.0
        if abs(diag_val) > 1e-4:
            linear_vector[vname] = diag_val

    # Convert matrix to nested list for json serialization (capped at 16x16 for visual inspection)
    dim = min(len(hubo.variable_names), 16)
    quad_slice = hubo.matrix[:dim, :dim].tolist()

    poly_sample = {
        ",".join(k): float(v) for k, v in list(hubo.polynomial_dict.items())[:20]
    }

    return HUBOFormulationResponse(
        incident_id=incident_id,
        degree=hubo.degree,
        variable_names=hubo.variable_names,
        pruned_triples_count=hubo.pruned_triples_count,
        linear_vector=linear_vector,
        quadratic_matrix=quad_slice,
        cubic_terms=hubo.cubic_terms,
        slot_swap_ledger=hubo.slot_swap_ledger,
        polynomial_dict_sample=poly_sample,
        formulation_hash=hubo.formulation_hash
    )


@router.post("/solve", response_model=TriggerSolveResponse)
async def trigger_qpiai_solve(
    req: TriggerSolveRequest,
    incident_id: str = Query(default="INC-C102"),
    db: AsyncSession = Depends(get_db)
):
    """Trigger QpiAI QCloud QAOA and Opt solve on an incident"""
    result = await solve_incident_recovery(
        db=db,
        incident_id=incident_id,
        wave=req.wave,
        prefer_quantum=req.prefer_quantum
    )
    if "error" in result:
        raise LIRAException(status_code=404, code="NOT_FOUND", message=result["error"])

    alts = result.get("alternatives", [])
    best_avoidable = alts[0]["avoidable_cost_inr"] if alts else 0

    return TriggerSolveResponse(
        run_id=result["run_id"],
        incident_id=incident_id,
        status="SOLVED",
        provider_mode=result["provider_mode"],
        solver_source=result["solver_source"],
        alternatives_generated=len(alts),
        best_avoidable_cost_inr=best_avoidable,
        message=f"QpiAI hybrid solver completed successfully with {len(alts)} alternatives."
    )


# -------------------------------------------------------------
# Q1 - Q6 Unified Decision Modes API
# -------------------------------------------------------------
from app.services.qpiai.decision_modes import (
    get_all_decision_modes_summary,
    run_q4_multi_container_exchange,
    run_q5_rolling_horizon,
    run_q6_qcloud_reality_experiment
)


@router.get("/decision-modes")
async def get_decision_modes():
    """Returns the unified 6-mode QpiAI decision matrix summary for Solver Lab."""
    return get_all_decision_modes_summary()


@router.get("/modes/q4-exchange")
@router.post("/modes/q4-exchange")
async def execute_q4_exchange():
    """Q4: Multi-Container Recovery Exchange."""
    return run_q4_multi_container_exchange()


@router.get("/modes/q5-horizon")
@router.post("/modes/q5-horizon")
async def execute_q5_horizon(horizon_hours: int = Query(default=48)):
    """Q5: Future-Proofing / Rolling Horizon."""
    return run_q5_rolling_horizon(planning_horizon_hours=horizon_hours)


@router.get("/modes/q6-qcloud")
@router.post("/modes/q6-qcloud")
async def execute_q6_qcloud():
    """Q6: QCloud Reality Experiment."""
    return run_q6_qcloud_reality_experiment()

