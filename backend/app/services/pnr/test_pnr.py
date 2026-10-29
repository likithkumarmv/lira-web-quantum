import itertools
from datetime import timedelta
from pnr_engine import analyze, backward_pass, forward_pass, triage_inputs, build_triage_model, greedy_triage
from pnr_fixtures import at, chain_c2_edo, chain_c5_breakdown, chain_c6_empty, all_chains


def test_hidden_deadline_c2():
    now = at(10, 25)
    a = analyze(chain_c2_edo(), now)
    assert a["minutes_to_deadline"] == 335                  # looks like 5h35m left
    assert a["pnr"].startswith("2026-10-29T10:35")          # but only 10 minutes really left
    assert a["minutes_to_pnr"] == 10
    assert a["status"] in ("PNR_IMMINENT", "PAST_SAFE_PNR")
    assert a["critical_chain"][0] == "pay"
    assert a["projected_penalty_inr"] == 0                  # acting now still saves it


def test_after_pnr_container_is_lost_even_though_deadline_not_reached():
    now = at(10, 45)
    a = analyze(chain_c2_edo(), now)
    assert a["minutes_to_deadline"] > 0
    assert a["status"] == "ALREADY_LOST"
    assert a["projected_penalty_inr"] == 14500 + 10000


def test_calendar_snap_moves_to_previous_window():
    c = chain_c2_edo()
    bp = backward_pass(c)
    # e-DO must finish by slot start 12:20 -> fits 11:35-12:20 in the morning desk window
    assert bp["edo"]["latest_start"].strftime("%H:%M") == "11:35"
    # travel limited by heavy-vehicle window, still fits 14:40-15:30
    assert bp["travel"]["latest_start"].strftime("%H:%M") == "14:40"


def test_forward_pass_respects_windows():
    fp = forward_pass(chain_c2_edo(), at(8, 0))
    assert fp["pay"]["earliest_start"].strftime("%H:%M") == "10:00"      # bank opens 10:00


def test_orphaned_action_detected():
    c = chain_c2_edo()
    a = analyze(c, at(10, 25))
    assert any(o["step_id"] == "pay" for o in a["orphaned_actions"])
    c.steps[0].owner_ack_at = at(10, 0)
    a2 = analyze(c, at(10, 25))
    assert not any(o["step_id"] == "pay" for o in a2["orphaned_actions"])


def test_uncertainty_safe_pnr_is_not_later_than_median():
    a = analyze(chain_c5_breakdown(), at(12, 0))
    assert a["pnr_safe_p20"] <= a["pnr_median"]


def test_triage_qubo_penalties_correct_by_brute_force():
    now = at(10, 25)
    analyses = [analyze(c, now) for c in all_chains()]
    jobs = triage_inputs(analyses, now, slot_min=10, horizon_slots=4)
    m, x = build_triage_model(jobs, horizon_slots=4, capacity_per_slot=1)
    Q, off = m.to_qubo_dict()
    n = 1 + max(max(i, j) for i, j in Q)
    best_e, best = None, None
    for bits in itertools.product((0, 1), repeat=n):
        e = sum(v * bits[i] * bits[j] for (i, j), v in Q.items())
        if best_e is None or e < best_e:
            best_e, best = e, bits
    # decode by model variable order
    names = [v.name for v in x.values()]
    chosen = [names[i] for i in range(len(names)) if best[m.qubo_index(names[i])] == 1]
    per_job = {}
    per_slot = {}
    for nm in chosen:
        _, j, s = nm.split("_")
        per_job[j] = per_job.get(j, 0) + 1
        per_slot[s] = per_slot.get(s, 0) + 1
    assert all(v <= 1 for v in per_job.values()) and all(v <= 1 for v in per_slot.values())
    assert len(per_job) == min(len(jobs), 4)
