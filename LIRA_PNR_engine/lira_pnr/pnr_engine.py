"""
LIRA · Point-of-No-Return (PNR) Engine  —  v1.0
==================================================
"Everyone tracks the deadline. Nobody tracks the moment the deadline became unavoidable."

For every container we know the visible deadline (e.g. DPD free-time ends 16:00). But the container is
actually lost much earlier: at the last moment when *every remaining step* (payment reconciliation -> e-DO
-> slot booking -> truck dispatch -> travel -> gate) can still be completed inside the real-world calendar
windows in which each step is possible (bank cutoffs, carrier desk hours, booking lead times, heavy-vehicle
windows, Sundays/holidays).

This module computes, deterministically and explainably:
  * latest start / latest finish for every remaining step  (backward pass, calendar-snapped)
  * PNR = earliest latest-start among remaining steps, and the critical chain that defines it
  * projected completion if work starts now  (forward pass)  -> SAVE_POSSIBLE / ALREADY_LOST
  * PNR under uncertainty (scenario sampling; supply QCBM samples or triangular p10/p50/p90)
  * ORPHANED actions: required, no acknowledged owner, PNR approaching  ("bystander effect")
  * portfolio triage as a QpiAI Opt model: with limited people/call slots, which containers' next actions
    to pull forward so the maximum value is saved before each container's PNR.

Pure Python 3.10+. qpiai_opt is optional (only needed for build_triage_model / solve_triage).
All times are timezone-aware datetimes (IST). Fixture values are LAB_FIXTURE, not live port data.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from typing import Iterable

IST = timezone(timedelta(hours=5, minutes=30))
MAX_LOOKBACK_DAYS = 10


# ------------------------------------------------------------------ calendars
@dataclass(frozen=True)
class Window:
    """Daily window [start, end) on the given weekdays (0=Mon .. 6=Sun)."""
    start: time
    end: time
    weekdays: tuple[int, ...] = (0, 1, 2, 3, 4, 5, 6)


@dataclass
class Calendar:
    """When a step can be *executed*. A step must fit fully inside one window (atomic) unless splittable."""
    name: str
    windows: list[Window]
    holidays: set[date] = field(default_factory=set)

    @staticmethod
    def always(name: str = "24x7") -> "Calendar":
        return Calendar(name, [Window(time(0, 0), time(23, 59, 59))])

    def intervals_backward(self, until: datetime) -> Iterable[tuple[datetime, datetime]]:
        """Yield concrete open intervals ending at or before `until`, newest first."""
        tz = until.tzinfo or IST
        d = until.date()
        for _ in range(MAX_LOOKBACK_DAYS + 1):
            if d not in self.holidays:
                todays = []
                for w in self.windows:
                    if d.weekday() in w.weekdays:
                        a = datetime.combine(d, w.start, tz)
                        b = datetime.combine(d, w.end, tz)
                        if a < until:
                            todays.append((a, min(b, until)))
                for iv in sorted(todays, key=lambda x: x[1], reverse=True):
                    yield iv
            d -= timedelta(days=1)

    def intervals_forward(self, since: datetime) -> Iterable[tuple[datetime, datetime]]:
        tz = since.tzinfo or IST
        d = since.date()
        for _ in range(MAX_LOOKBACK_DAYS + 1):
            if d not in self.holidays:
                todays = []
                for w in self.windows:
                    if d.weekday() in w.weekdays:
                        a = datetime.combine(d, w.start, tz)
                        b = datetime.combine(d, w.end, tz)
                        if b > since:
                            todays.append((max(a, since), b))
                for iv in sorted(todays, key=lambda x: x[0]):
                    yield iv
            d += timedelta(days=1)


# ------------------------------------------------------------------ steps
@dataclass
class Step:
    step_id: str
    title: str
    owner_role: str
    duration_min: float                      # nominal (p50)
    calendar: Calendar
    predecessors: list[str] = field(default_factory=list)
    done: bool = False
    owner_ack_at: datetime | None = None     # when a named owner acknowledged responsibility
    p10_min: float | None = None             # optional uncertainty
    p90_min: float | None = None
    evidence_ref: str | None = None          # document / quote that defines this step or window

    def sample_duration(self, rng: random.Random) -> float:
        lo = self.p10_min if self.p10_min is not None else self.duration_min
        hi = self.p90_min if self.p90_min is not None else self.duration_min
        if hi <= lo:
            return self.duration_min
        return rng.triangular(lo, hi, min(max(self.duration_min, lo), hi))


@dataclass
class ContainerChain:
    container_no: str
    deadline: datetime                       # visible deadline (free time end / delivery window close)
    deadline_kind: str                       # DPD_FREE_TIME | DETENTION | DELIVERY_WINDOW
    steps: list[Step]
    penalty_per_day_inr: float = 0.0         # MODELED, from tariff
    fixed_penalty_inr: float = 0.0           # e.g. CFS transfer charge if the cliff is missed
    value_label: str = "MODELED"

    def by_id(self) -> dict[str, Step]:
        return {s.step_id: s for s in self.steps}


# ------------------------------------------------------------------ core passes
class Infeasible(Exception):
    pass


def _latest_start(step_dur: float, cal: Calendar, latest_finish: datetime) -> tuple[datetime, datetime]:
    """Latest (start, finish) such that the step fits in one calendar interval and finishes <= latest_finish."""
    dur = timedelta(minutes=step_dur)
    for a, b in cal.intervals_backward(latest_finish):
        if b - a >= dur:
            return b - dur, b
    raise Infeasible(f"no window of {step_dur:.0f} min in calendar {cal.name} before {latest_finish}")


def _earliest_finish(step_dur: float, cal: Calendar, earliest_start: datetime) -> tuple[datetime, datetime]:
    dur = timedelta(minutes=step_dur)
    for a, b in cal.intervals_forward(earliest_start):
        if b - a >= dur:
            return a, a + dur
    raise Infeasible(f"no window of {step_dur:.0f} min in calendar {cal.name} after {earliest_start}")


def _topo(steps: list[Step]) -> list[Step]:
    ids = {s.step_id for s in steps}
    indeg = {s.step_id: sum(1 for p in s.predecessors if p in ids) for s in steps}
    succ: dict[str, list[str]] = {s.step_id: [] for s in steps}
    for s in steps:
        for p in s.predecessors:
            if p in ids:
                succ[p].append(s.step_id)
    order, queue = [], [s for s in steps if indeg[s.step_id] == 0]
    byid = {s.step_id: s for s in steps}
    while queue:
        n = queue.pop(0)
        order.append(n)
        for m in succ[n.step_id]:
            indeg[m] -= 1
            if indeg[m] == 0:
                queue.append(byid[m])
    if len(order) != len(steps):
        raise ValueError("step graph has a cycle")
    return order


def backward_pass(chain: ContainerChain, durations: dict[str, float] | None = None) -> dict[str, dict]:
    """Latest start/finish for every NOT-done step."""
    remaining = [s for s in chain.steps if not s.done]
    order = _topo(remaining)
    succ: dict[str, list[str]] = {s.step_id: [] for s in remaining}
    for s in remaining:
        for p in s.predecessors:
            if p in succ:
                succ[p].append(s.step_id)
    out: dict[str, dict] = {}
    for s in reversed(order):
        lf = chain.deadline if not succ[s.step_id] else min(out[n]["latest_start"] for n in succ[s.step_id])
        d = (durations or {}).get(s.step_id, s.duration_min)
        ls, finish = _latest_start(d, s.calendar, lf)
        out[s.step_id] = {"latest_start": ls, "latest_finish": finish, "bound_by": lf, "duration_min": d,
                          "calendar": s.calendar.name, "snapped": finish < lf}
    return out


def forward_pass(chain: ContainerChain, now: datetime, durations: dict[str, float] | None = None) -> dict[str, dict]:
    remaining = [s for s in chain.steps if not s.done]
    out: dict[str, dict] = {}
    for s in _topo(remaining):
        es = max([now] + [out[p]["earliest_finish"] for p in s.predecessors if p in out])
        d = (durations or {}).get(s.step_id, s.duration_min)
        start, finish = _earliest_finish(d, s.calendar, es)
        out[s.step_id] = {"earliest_start": start, "earliest_finish": finish}
    return out


def critical_chain(chain: ContainerChain, bp: dict[str, dict]) -> list[str]:
    """Follow the step whose latest start is the PNR forward through the tightest successor."""
    remaining = {s.step_id: s for s in chain.steps if not s.done}
    if not bp:
        return []
    start = min(bp, key=lambda k: bp[k]["latest_start"])
    path = [start]
    while True:
        succs = [k for k, s in remaining.items() if path[-1] in s.predecessors]
        if not succs:
            return path
        path.append(min(succs, key=lambda k: bp[k]["latest_start"]))


def penalty_for_completion(chain: ContainerChain, completion: datetime) -> float:
    if completion <= chain.deadline:
        return 0.0
    days = math.ceil((completion - chain.deadline).total_seconds() / 86400)
    return chain.fixed_penalty_inr + days * chain.penalty_per_day_inr


# ------------------------------------------------------------------ public API
def analyze(chain: ContainerChain, now: datetime, *, alert_lead_min: int = 30,
            scenarios: int = 400, seed: int = 7,
            duration_samples: list[dict[str, float]] | None = None) -> dict:
    """Full PNR analysis for one container. `duration_samples` may come from the QCBM scenario generator."""
    remaining = [s for s in chain.steps if not s.done]
    if not remaining:
        return {"container_no": chain.container_no, "status": "COMPLETE", "pnr": None}

    infeasible_reason = None
    try:
        bp = backward_pass(chain)
        pnr = min(v["latest_start"] for v in bp.values())
    except Infeasible as e:
        bp, pnr = {}, None
        infeasible_reason = str(e)
    fp = forward_pass(chain, now)
    projected = max(v["earliest_finish"] for v in fp.values())
    lost_now = projected > chain.deadline

    # uncertainty: PNR distribution
    rng = random.Random(seed)
    samples = duration_samples or [{s.step_id: s.sample_duration(rng) for s in remaining} for _ in range(scenarios)]
    pnrs = []
    for d in samples:
        try:
            pnrs.append(min(v["latest_start"] for v in backward_pass(chain, d).values()))
        except Infeasible:
            pass
    pnrs.sort()
    p20 = pnrs[int(0.2 * (len(pnrs) - 1))] if pnrs else None          # "safe" PNR: 80% of scenarios later than this
    p50 = pnrs[len(pnrs) // 2] if pnrs else None

    status = ("ALREADY_LOST" if lost_now else
              "PAST_SAFE_PNR" if p20 and now > p20 else
              "PNR_IMMINENT" if pnr and (pnr - now) <= timedelta(minutes=alert_lead_min) else
              "ON_TRACK")

    chain_ids = critical_chain(chain, bp) if bp else []
    byid = chain.by_id()
    orphans = []
    for s in remaining:
        ls = bp.get(s.step_id, {}).get("latest_start")
        preds_done = all(byid[p].done for p in s.predecessors if p in byid)
        if s.owner_ack_at is None and preds_done and ls is not None and (ls - now) <= timedelta(minutes=alert_lead_min * 3):
            orphans.append({"step_id": s.step_id, "title": s.title, "owner_role": s.owner_role,
                            "latest_start": ls.isoformat(), "minutes_left": round((ls - now).total_seconds() / 60)})

    explain = []
    for sid in chain_ids:
        s, v = byid[sid], bp[sid]
        line = f"{s.title} ({s.owner_role}) must start by {v['latest_start']:%H:%M}"
        if v["snapped"]:
            line += f" — its {s.calendar.name} window closes before the next step needs it"
        explain.append(line)

    return {
        "container_no": chain.container_no,
        "deadline": chain.deadline.isoformat(), "deadline_kind": chain.deadline_kind,
        "pnr": pnr.isoformat() if pnr else None,
        "pnr_safe_p20": p20.isoformat() if p20 else None,
        "pnr_median": p50.isoformat() if p50 else None,
        "minutes_to_pnr": round((pnr - now).total_seconds() / 60) if pnr else None,
        "minutes_to_deadline": round((chain.deadline - now).total_seconds() / 60),
        "hidden_gap_minutes": round((chain.deadline - pnr).total_seconds() / 60) if pnr else None,
        "status": status,
        "projected_completion_if_start_now": projected.isoformat(),
        "projected_penalty_inr": penalty_for_completion(chain, projected),
        "penalty_if_missed_inr": chain.fixed_penalty_inr + chain.penalty_per_day_inr,
        "value_label": chain.value_label,
        "critical_chain": chain_ids,
        "explanation": explain,
        "next_action": ({"step_id": chain_ids[0], "title": byid[chain_ids[0]].title,
                         "owner_role": byid[chain_ids[0]].owner_role,
                         "act_by": bp[chain_ids[0]]["latest_start"].isoformat()} if chain_ids else None),
        "orphaned_actions": orphans,
        "steps": {k: {kk: (vv.isoformat() if isinstance(vv, datetime) else vv) for kk, vv in v.items()}
                  for k, v in bp.items()},
        "scenarios_used": len(pnrs),
        "infeasible_reason": None if bp else infeasible_reason,
    }


# ------------------------------------------------------------------ portfolio triage (QpiAI Opt)
def triage_inputs(analyses: list[dict], now: datetime, slot_min: int = 10, horizon_slots: int = 12) -> list[dict]:
    """Each container whose next action must happen before PNR becomes a job with a deadline slot index."""
    jobs = []
    for a in analyses:
        if a["status"] in ("COMPLETE", "ALREADY_LOST") or not a["pnr"]:
            continue
        mins = (datetime.fromisoformat(a["pnr"]) - now).total_seconds() / 60
        last_slot = int(mins // slot_min)            # action must START in a slot <= last_slot
        if last_slot < 0:
            continue
        jobs.append({"container_no": a["container_no"], "value": a["penalty_if_missed_inr"],
                     "last_slot": min(last_slot, horizon_slots - 1), "next_action": a["next_action"]})
    return jobs


def build_triage_model(jobs: list[dict], horizon_slots: int, capacity_per_slot: int):
    """QpiAI Opt model: x[c,s]=1 -> start container c's next action in slot s (needs one person / call line).
       maximize Σ value_c·x[c,s] (only s <= last_slot_c allowed) − tiny lateness tiebreak
       s.t. Σ_s x[c,s] <= 1 ;  Σ_c x[c,s] <= capacity."""
    from qpiai_opt.opt_modeller import Binary, Model
    m = Model("lira_pnr_triage")
    x = {}
    for j, job in enumerate(jobs):
        for s in range(min(job["last_slot"], horizon_slots - 1) + 1):
            x[(j, s)] = Binary(f"x_{j}_{s}")
    scale = max([job["value"] for job in jobs] + [1.0])
    obj = 0
    for (j, s), v in x.items():
        obj = obj + (jobs[j]["value"] / scale) * v - 0.001 * s * v
    m.maximize(obj)
    for j in range(len(jobs)):
        vs = [v for (jj, _), v in x.items() if jj == j]
        if len(vs) > 1:
            m.add_constraint(sum(vs[1:], vs[0]) <= 1, label=f"once_{j}")
    for s in range(horizon_slots):
        vs = [v for (_, ss), v in x.items() if ss == s]
        if len(vs) > capacity_per_slot:
            m.add_constraint(sum(vs[1:], vs[0]) <= capacity_per_slot, label=f"cap_{s}")
    return m, x


def decode_triage(jobs: list[dict], x: dict, assignment: dict[str, float], now: datetime, slot_min: int) -> list[dict]:
    plan = []
    for (j, s), v in x.items():
        if assignment.get(v.name if hasattr(v, "name") else str(v), 0) > 0.5:
            plan.append({"container_no": jobs[j]["container_no"], "slot": s,
                         "start_at": (now + timedelta(minutes=s * slot_min)).isoformat(),
                         "action": jobs[j]["next_action"], "value_inr": jobs[j]["value"]})
    return sorted(plan, key=lambda p: p["slot"])


def greedy_triage(jobs: list[dict], horizon_slots: int, capacity: int) -> set[str]:
    """Baseline: earliest-PNR-first (what a good dispatcher would do by hand)."""
    used = [0] * horizon_slots
    saved = set()
    for job in sorted(jobs, key=lambda j: j["last_slot"]):
        for s in range(job["last_slot"] + 1):
            if used[s] < capacity:
                used[s] += 1
                saved.add(job["container_no"])
                break
    return saved


def solve_triage(jobs: list[dict], now: datetime, *, horizon_slots: int = 12, capacity_per_slot: int = 1,
                 slot_min: int = 10, client=None, mode: str = "local") -> dict:
    """Runs the real QpiAI Opt solve when a Client is given; always returns the greedy baseline too."""
    greedy = greedy_triage(jobs, horizon_slots, capacity_per_slot)
    out = {"baseline_greedy_saved": sorted(greedy),
           "baseline_greedy_value": sum(j["value"] for j in jobs if j["container_no"] in greedy)}
    m, x = build_triage_model(jobs, horizon_slots, capacity_per_slot)
    from qpiai_opt.opt_solvers import inspect
    out["model_inspect"] = inspect(m)
    if client is None:
        out["qpiai"] = {"status": "NOT_RUN", "reason": "no QpiAI Opt client (needs QPIAI_OPT_API_KEY + internet)"}
        return out
    from qpiai_opt.opt_solvers import solve
    res = solve(m, client=client, mode=mode)
    sol = res.solution if isinstance(res.solution, dict) else getattr(res, "variable_assignment", {})
    plan = decode_triage(jobs, x, sol, now, slot_min)
    out["qpiai"] = {"status": "OK", "objective": res.objective, "execution_mode": res.execution_mode,
                    "job_id": getattr(res, "job_id", None), "info": str(res.info()),
                    "raw": res.model_dump(mode="json")}
    out["plan"] = plan
    out["qpiai_saved_value"] = sum(p["value_inr"] for p in plan)
    return out
