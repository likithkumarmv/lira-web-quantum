# POINT OF NO RETURN (PNR): integration prompts

"Everyone tracks the deadline. Nobody tracks the moment the deadline became unavoidable."

The engine is ALREADY BUILT AND TESTED (`LIRA_PNR_engine.zip`: `pnr_engine.py`, `pnr_fixtures.py`, `pnr_router.py`, `test_pnr.py`, 7/7 passing). The web friend integrates it, and the app friend displays it.

---

## PROMPT A: WEB + BACKEND (paste into the web friend's Antigravity, attach LIRA_PNR_engine.zip)

```
TASK: Integrate the attached, tested Point-of-No-Return (PNR) engine into LIRA. Do NOT rewrite its math.
Copy pnr_engine.py into backend/app/services/pnr/ and keep test_pnr.py passing in the backend test suite.

CONCEPT: Every container has a visible deadline (free time / detention / delivery window). The PNR is the latest
moment at which ALL remaining steps (payment reconciliation -> e-DO -> slot booking -> dispatch -> travel -> gate)
can still finish inside their real calendar windows (bank cutoff, carrier desk hours, booking lead time, heavy-vehicle
road windows, holidays). After the PNR the container is lost even though its deadline has not passed yet.

1. DATA
   - New table `step_calendars(calendar_id, name, windows_json[{start,end,weekdays}], holidays_json, source_ref, label)`.
     Seed with the calendars in pnr_fixtures.py (label LAB_FIXTURE).
   - Blocker DAG nodes become PNR Steps: step_id, title, owner_role, duration p10/p50/p90 (minutes), calendar_id,
     predecessors, done, owner_ack_at, evidence_ref. Add these columns to verification/recovery tasks.
   - Replace pnr_router.load_chains() with a builder from the DB (one ContainerChain per affected container;
     penalties from the tariffs table; deadline from the cost engine).
   - Uncertainty: pass QCBM scenario samples (Q2) as `duration_samples` when available; otherwise the triangular p10/p50/p90.

2. API (mount pnr_router): GET /api/v1/pnr/containers?at=, GET /api/v1/pnr/containers/{no}, POST /api/v1/pnr/triage.
   - Extend the driver AssignmentV13 with "act_by" (next_action.act_by for the driver's step) and "pnr" (ISO).
   - Extend the edge /board next_cliff: kind "PNR", at_unix = the PNR of the NEXT container (the firmware already shows
     "POINT OF NO RETURN").
   - Add "pnr", "minutes_to_pnr", "pnr_status" to every incident/container DTO.

3. Q1 UPGRADE (QpiAI Opt): when several containers are close to their PNR, run solve_triage() with the real QpiAI client
   (capacity = available staff or Bolna call lines per 10-min slot). Show the greedy (earliest-PNR-first) baseline next to
   QpiAI, plus value saved (MODELED). Write the run to the solver_runs ledger like every other mode.

4. ORPHANED ACTIONS ("bystander effect"): any step with no owner_ack_at, predecessors done, and PNR approaching appears
   as ORPHANED. Owner acknowledgement = a button in the web UI (and a Bolna answer YES from the owner, recorded as T4).
   If still orphaned 15 min before its latest start: auto-create a Q1 verification task "Call <owner_role>"
   (a human authorizes the Bolna call).

5. UI
   - Operations queue: sort by minutes_to_pnr (not deadline). Each row shows TWO clocks:
     grey "Deadline 16:00 (5h35m)" and big red/amber/green "POINT OF NO RETURN 10:35 (10 min)".
     Status chips: ON_TRACK / PNR_IMMINENT / PAST_SAFE_PNR / ALREADY_LOST.
   - Container detail: a horizontal "backward timeline" from the deadline to now, each step as a bar at its latest
     start/finish, calendar windows shaded behind, the critical chain highlighted, and a red vertical line at the PNR.
     Show the explanation lines, orphaned actions (with an "I own this" button), the projected completion if started
     now, and the ₹ penalty if missed (MODELED).
   - "Hidden gap" stat on Operations: Σ minutes between deadline and PNR across containers. Tagline:
     "Everyone tracks the deadline. LIRA tracks the moment it became unavoidable."
   - Demo time-travel: an `at` time picker on /demo (default 2026-10-29 10:25 IST) so the judge story is reproducible.
   - Copilot (if built): add a tool `get_pnr(container_no)` and make "what must happen first?" answers cite the PNR.

6. METRICS (evaluation page)
   - Deadline compliance v2 = % of required actions started before their latest start (PNR-based).
   - Missed blocker v2 = a blocker detected AFTER its PNR counts as missed, even if the deadline had not passed.
   - Report both old and new definitions side by side, with a one-line explanation.

7. TESTS: keep test_pnr.py green; add an API test for /pnr/containers sorting; an orphan -> verification task creation test;
   triage ledger write; and board next_cliff kind == "PNR".

DONE WHEN: at the demo time 10:25, HLCU9201940 shows "Deadline 5h35m" but "POINT OF NO RETURN 10:35 (10 min)",
the RTGS reconciliation step is ORPHANED, the timeline explains why, and the QpiAI triage run appears in the ledger.
```

---

## PROMPT B: APP (paste into the app friend's Antigravity)

```
TASK: Show the Point of No Return to drivers. The backend adds to AssignmentV13:
  "pnr": ISO time | null, "act_by": ISO time | null (latest start of THIS driver's next step), "pnr_status":
  "ON_TRACK|PNR_IMMINENT|PAST_SAFE_PNR|ALREADY_LOST|UNKNOWN".

1. On the My Job instruction card, replace "Arrive by <deadline>" with a big countdown "ACT BY 14:00 · 1h 35m"
   (driver's language), colour by pnr_status (green/amber/red). Show the visible deadline small underneath:
   "Port deadline 16:00".
2. A one-line explanation under it, from the Why sheet: "After 14:00 the container cannot leave port today, even if
   you hurry." (string resources: en/hi/mr/ta).
3. If pnr_status becomes PNR_IMMINENT: a local notification + vibration + TextToSpeech in the driver's language
   ("You must leave within 10 minutes").
   If ALREADY_LOST: a calm grey card "Dispatch is re-planning. Wait for the new job." No ACK buttons on lost jobs.
4. Moshi: new fields optional with an UNKNOWN fallback; a Room migration; tests: countdown formatting,
   status colours, lost-job hides ACK, TTS trigger once per status change.
```
