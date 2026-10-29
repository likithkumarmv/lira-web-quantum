"""FastAPI router for the PNR engine. Mount in backend/app/main.py:  app.include_router(pnr_router.router)
Replace `load_chains()` with chains built from the live DB (blockers -> steps, tariffs -> penalties, calendars table)."""
import os
from datetime import datetime
from fastapi import APIRouter, Query
from pnr_engine import IST, analyze, triage_inputs, solve_triage
from pnr_fixtures import all_chains

router = APIRouter(prefix="/api/v1/pnr", tags=["pnr"])


def load_chains():
    return all_chains()          # TODO: build from DB; fixtures are LAB_FIXTURE


def _now(at: str | None):
    return datetime.fromisoformat(at) if at else datetime.now(IST)


@router.get("/containers")
def pnr_all(at: str | None = Query(None, description="ISO time override for demo, e.g. 2026-10-29T10:25:00+05:30")):
    now = _now(at)
    items = sorted((analyze(c, now) for c in load_chains()),
                   key=lambda a: a["minutes_to_pnr"] if a["minutes_to_pnr"] is not None else -10**9)
    return {"now": now.isoformat(), "items": items, "label": "LAB_FIXTURE"}


@router.get("/containers/{container_no}")
def pnr_one(container_no: str, at: str | None = None):
    now = _now(at)
    for c in load_chains():
        if c.container_no == container_no:
            return analyze(c, now)
    return {"error": {"code": "NOT_FOUND"}}


@router.post("/triage")
def pnr_triage(at: str | None = None, capacity_per_slot: int = 1, slot_min: int = 10, horizon_slots: int = 12):
    now = _now(at)
    analyses = [analyze(c, now) for c in load_chains()]
    jobs = triage_inputs(analyses, now, slot_min, horizon_slots)
    client = None
    if os.environ.get("QPIAI_OPT_API_KEY"):
        from qpiai_opt.opt_solvers import Client
        client = Client(api_key=os.environ["QPIAI_OPT_API_KEY"])
    return solve_triage(jobs, now, horizon_slots=horizon_slots, capacity_per_slot=capacity_per_slot,
                        slot_min=slot_min, client=client)
