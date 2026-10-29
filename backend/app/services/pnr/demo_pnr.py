"""Run: python demo_pnr.py   (prints the judge demo story; add QPIAI_OPT_API_KEY to also run the real QpiAI solve)"""
import json, os
from pnr_engine import analyze, triage_inputs, solve_triage
from pnr_fixtures import at, all_chains

now = at(10, 25)
print(f"NOW {now:%H:%M}\n")
analyses = [analyze(c, now) for c in all_chains()]
for a in analyses:
    print(f"{a['container_no']}: deadline in {a['minutes_to_deadline']//60}h{a['minutes_to_deadline']%60:02d}m  |  "
          f"POINT OF NO RETURN {a['pnr'][11:16]} -> {a['minutes_to_pnr']} min  [{a['status']}]")
    for line in a["explanation"]:
        print("    -", line)
    if a["orphaned_actions"]:
        print("    ! ORPHANED:", [o["title"] + " (" + o["owner_role"] + ")" for o in a["orphaned_actions"]])
    print()
jobs = triage_inputs(analyses, now, slot_min=10, horizon_slots=12)
client = None
if os.environ.get("QPIAI_OPT_API_KEY"):
    from qpiai_opt.opt_solvers import Client
    client = Client(api_key=os.environ["QPIAI_OPT_API_KEY"])
res = solve_triage(jobs, now, horizon_slots=12, capacity_per_slot=1, client=client)
print("Greedy saves:", res["baseline_greedy_saved"], "₹", res["baseline_greedy_value"])
print("QpiAI:", res["qpiai"]["status"], res.get("plan", ""))
print("Model:", res["model_inspect"])
