from typing import List, Dict, Any, Tuple


def validate_solution_candidate(
    selected_vars: List[str],
    eligible_tuples: List[Dict[str, Any]],
    containers: List[Dict[str, Any]],
    trucks: List[Dict[str, Any]],
    slots: List[Dict[str, Any]]
) -> Tuple[bool, List[str], Dict[str, Any]]:
    violations = []
    assignments = []
    assigned_containers = set()
    assigned_trucks = set()
    assigned_slots = set()

    tup_by_name = {t["var_name"]: t for t in eligible_tuples}

    for var in selected_vars:
        if var.startswith("u["):
            c_id = var[2:-1]
            if c_id in assigned_containers:
                violations.append(f"Conflict: Container {c_id} marked as both deferred and assigned.")
            assigned_containers.add(c_id)
            continue

        if var not in tup_by_name:
            violations.append(f"Invalid variable {var} not recognized in eligible horizon.")
            continue

        tup = tup_by_name[var]
        c_id = tup["container_id"]
        t_id = tup["truck_id"]
        s_id = tup["slot_id"]

        # Container exclusivity
        if c_id in assigned_containers:
            violations.append(f"Duplicate Container: Container {c_id} assigned multiple times in plan.")
        assigned_containers.add(c_id)

        # Truck exclusivity
        if t_id in assigned_trucks:
            violations.append(f"Truck Collision: Truck {t_id} assigned to multiple concurrent slots.")
        assigned_trucks.add(t_id)

        # Slot capacity exclusivity
        if s_id in assigned_slots:
            violations.append(f"Slot Collision: Slot {s_id} booked for multiple simultaneous pickups.")
        assigned_slots.add(s_id)

        # Physical payload check
        c_weight = tup["container"].get("weight_kg", 20000)
        t_payload = tup["truck"].get("payload_capacity_kg", 25000)
        if c_weight > t_payload:
            violations.append(f"Overweight: Container {c_id} ({c_weight}kg) exceeds {t_id} payload ({t_payload}kg).")

        # Driver hours limit check
        used_h = tup["truck"].get("driver_hours_used", 4.0)
        max_h = tup["truck"].get("driver_hours_max", 10.0)
        if used_h + 3.5 > max_h:
            violations.append(f"Duty Hours: Driver for {t_id} exceeds statutory maximum working hours.")

        assignments.append({
            "container_id": c_id,
            "truck_id": t_id,
            "slot_id": s_id,
            "slot_start": tup["slot"]["start_at"],
            "slot_end": tup["slot"]["end_at"],
            "checkpoint_id": "LIRA-EDGE-01",
            "truck": tup["truck"],
            "slot": tup["slot"],
            "container": tup["container"]
        })

    # Coverage: check if all containers have an assignment or deferral
    all_c_ids = {c["container_id"] for c in containers}
    unhandled = all_c_ids - assigned_containers
    if unhandled:
        violations.append(f"Uncovered Containers: Containers {list(unhandled)} have neither assignment nor deferral.")

    is_feasible = (len(violations) == 0)
    score = 1.0 if is_feasible else max(0.0, 1.0 - (len(violations) * 0.25))

    return is_feasible, violations, {
        "assignments": assignments,
        "feasibility_score": score,
        "violations": violations
    }

