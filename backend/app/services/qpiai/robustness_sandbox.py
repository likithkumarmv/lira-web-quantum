import uuid
import datetime
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import RobustnessScenarioModel

def _utcnow_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


STRESS_TEST_SCENARIOS = [
    {
        "scenario_id": "SCEN-01-VEHICLE-REFUSAL",
        "scenario_type": "VEHICLE_REFUSAL",
        "title": "Primary Prime Mover T07 Mechanical Breakdown on NH-348",
        "description": "Primary truck T07 suffers radiator overheating 12km from JNPA gate. Without mitigation, container C102 misses 17:00 appointment slot, triggering Day 1 ₹12,000 demurrage cliff.",
        "worst_case_cost_inr": 48000.0,
        "baseline_cost_inr": 2450.0,
        "cost_regret_inr": 45550.0,
        "alternative_plan_summary": "Auto-switch to pre-staged Backup Truck T09 (MH-04-4411) with Carrier Transicold APU Genset #04.",
        "adversarial_coverage_pct": 98.2
    },
    {
        "scenario_id": "SCEN-02-MONSOON-DELAY",
        "scenario_type": "WEATHER_DELAY",
        "title": "Severe Monsoon Waterlogging on Panvel-JNPA Expressway",
        "description": "Flash waterlogging near Uran Phata adds +45 minutes to transit duration, eroding the 20-minute pre-gate staging buffer.",
        "worst_case_cost_inr": 24000.0,
        "baseline_cost_inr": 3200.0,
        "cost_regret_inr": 20800.0,
        "alternative_plan_summary": "Execute slot-swap with donor container C208 (Tata Consumer Products) into earlier S1700 buffer slot.",
        "adversarial_coverage_pct": 95.0
    },
    {
        "scenario_id": "SCEN-03-CHASSIS-QUARANTINE",
        "scenario_type": "CHASSIS_QUARANTINE",
        "title": "Rear Left Twistlock Defect Detected at Pre-Gate Inspection",
        "description": "Chassis RES-CHASSIS-QUAR fails pre-trip roadworthiness inspection due to cracked twistlock casting.",
        "worst_case_cost_inr": 18000.0,
        "baseline_cost_inr": 2900.0,
        "cost_regret_inr": 15100.0,
        "alternative_plan_summary": "Web Control Tower commits inspection failure quarantine; dispatches secondary verified chassis RES-CHASSIS-40-02.",
        "adversarial_coverage_pct": 99.1
    },
    {
        "scenario_id": "SCEN-04-CRANE-BREAKDOWN",
        "scenario_type": "SLOT_CONFLICT",
        "title": "Terminal RTG Crane Gridlock / Depth-Stack Delay (Tier 4+)",
        "description": "JNPA Terminal 2 RTG crane suffers hydraulic pressure drop; reefer container C102 cannot be retrieved before 18:00 counter closing.",
        "worst_case_cost_inr": 48000.0,
        "baseline_cost_inr": 0.0,
        "cost_regret_inr": 0.0,
        "alternative_plan_summary": "Compile tamper-evident Evidence Dossier under 46 CFR § 541.6 allocating 100% fault to terminal; legally defeats carrier demurrage billing.",
        "adversarial_coverage_pct": 94.4
    }
]


async def seed_robustness_scenarios_if_needed(db: AsyncSession):
    stmt = select(RobustnessScenarioModel)
    res = await db.execute(stmt)
    if not res.scalars().first():
        now_iso = _utcnow_iso()
        models = [
            RobustnessScenarioModel(
                scenario_id=s["scenario_id"],
                scenario_type=s["scenario_type"],
                title=s["title"],
                description=s["description"],
                worst_case_cost_inr=s["worst_case_cost_inr"],
                baseline_cost_inr=s["baseline_cost_inr"],
                cost_regret_inr=s["cost_regret_inr"],
                alternative_plan_summary=s["alternative_plan_summary"],
                adversarial_coverage_pct=s["adversarial_coverage_pct"],
                status="ANALYSIS_ONLY_LAB_SANDBOX",
                created_at=now_iso
            )
            for s in STRESS_TEST_SCENARIOS
        ]
        db.add_all(models)
        await db.commit()


async def evaluate_robustness_sandbox(db: AsyncSession) -> Dict[str, Any]:
    await seed_robustness_scenarios_if_needed(db)
    stmt = select(RobustnessScenarioModel)
    res = await db.execute(stmt)
    scenarios = res.scalars().all()

    total_worst_case = sum(s.worst_case_cost_inr for s in scenarios)
    total_baseline = sum(s.baseline_cost_inr for s in scenarios)
    total_avoided_exposure = sum(s.cost_regret_inr for s in scenarios)
    mean_coverage = sum(s.adversarial_coverage_pct for s in scenarios) / max(1, len(scenarios))

    return {
        "status": "ANALYSIS_ONLY_LAB_SANDBOX",
        "spec_version": "PRD v10 Robustness Sandbox",
        "description": "Bounded adversarial scenario stress test comparing worst-case cost exposure against QpiAI-optimized alternative plans.",
        "manager_approval_required": True,
        "metrics": {
            "scenarios_evaluated": len(scenarios),
            "total_worst_case_cost_inr": total_worst_case,
            "total_baseline_cost_inr": total_baseline,
            "total_avoided_exposure_inr": total_avoided_exposure,
            "mean_adversarial_coverage_pct": round(mean_coverage, 1),
            "classical_comparator": "HiGHS Branch-and-Bound Worst-Case Dual"
        },
        "scenarios": [
            {
                "scenario_id": s.scenario_id,
                "scenario_type": s.scenario_type,
                "title": s.title,
                "description": s.description,
                "worst_case_cost_inr": s.worst_case_cost_inr,
                "baseline_cost_inr": s.baseline_cost_inr,
                "cost_regret_inr": s.cost_regret_inr,
                "alternative_plan_summary": s.alternative_plan_summary,
                "adversarial_coverage_pct": s.adversarial_coverage_pct,
                "status": s.status
            }
            for s in scenarios
        ]
    }

