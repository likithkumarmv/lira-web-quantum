from typing import List, Tuple, Dict, Any, Optional
from app.services.blockers.rules import evaluate_expanded_blockers


def check_assignment_eligibility(
    container: Dict[str, Any],
    truck: Dict[str, Any],
    slot: Dict[str, Any],
    external_events: Optional[List[Dict[str, Any]]] = None,
    terminal_code: str = "JNPT"
) -> Tuple[bool, List[str]]:
    violations = []

    c_id = container.get("container_id", "UNKNOWN")
    t_id = truck.get("truck_id", "UNKNOWN")
    s_id = slot.get("slot_id", "UNKNOWN")

    # 1. Container weight vs Truck payload capacity
    c_weight = float(container.get("weight_kg", 20000.0))
    t_payload = float(truck.get("payload_capacity_kg", 25000.0))
    if c_weight > t_payload:
        violations.append(f"Payload Exceeded: Container weight {c_weight:,.0f}kg > Truck {t_id} payload capacity {t_payload:,.0f}kg")

    # 2. Container size vs Truck TEU capacity & Chassis compatibility
    c_size = int(container.get("size_ft", 40))
    t_teu = int(truck.get("capacity_teu", 2))
    if c_size == 40 and t_teu < 2:
        violations.append(f"Chassis Mismatch: 40ft container requires 2-TEU chassis; truck {t_id} is {t_teu}-TEU")

    # 3. Heavy-Haul Tri-Axle Mandate (>24,000 kg)
    if c_weight >= 24000.0:
        chassis_type = truck.get("chassis_type", "TRI_AXLE" if t_payload >= 28000.0 else "TANDEM")
        if "TRI_AXLE" not in chassis_type:
            violations.append(f"Heavy-Haul Violation: Container {c_id} ({c_weight:,.0f}kg) requires certified tri-axle chassis; truck {t_id} has {chassis_type}")

    # 4. Reefer Cold Chain Genset Mandate
    cargo_type = str(container.get("cargo_type", "")).upper()
    special_handling = str(container.get("special_handling", "")).upper()
    if "REEFER" in cargo_type or "PERISHABLE" in cargo_type or "COLD_CHAIN" in special_handling:
        has_genset = truck.get("has_genset", False)
        if not has_genset:
            violations.append(f"Reefer Violation: Cargo {c_id} requires active clip-on genset; truck {t_id} lacks auxiliary power unit")

    # 5. Customs Release Prerequisite (Unknown is not cleared)
    release_state = container.get("release_state", "NEEDS_VERIFICATION")
    if release_state != "CONFIRMED":
        violations.append(f"Customs Gated: Container {c_id} release state is '{release_state}'; terminal gate pickup prohibited without confirmed Out-of-Charge (OoC)")

    # 6. PGA Statutory Hold Prerequisite
    pga_status = container.get("pga_status")
    if pga_status in ["PENDING", "HOLD", "SAMPLING_REQUIRED"]:
        violations.append(f"PGA Statutory Hold: Container {c_id} pending {pga_status} inspection clearance from regulatory agency")

    # 7. Driver Working Hours Compliance
    hours_used = float(truck.get("driver_hours_used", 4.0))
    hours_max = float(truck.get("driver_hours_max", 10.0))
    estimated_trip_hours = 3.5
    if hours_used + estimated_trip_hours > hours_max:
        violations.append(f"Driver Hours Exceeded: Used {hours_used}h + Trip {estimated_trip_hours}h > Limit {hours_max}h")

    # 8. Slot Confirmation & Operational Status
    if slot.get("confirmed_status") != "CONFIRMED":
        violations.append(f"Slot Inactive: Slot {s_id} status is {slot.get('confirmed_status')}")

    # 9. External Events: Confirmed port closure vs Forecast weather
    if external_events:
        for evt in external_events:
            trust_state = evt.get("trust_state")
            evt_type = evt.get("type")

            # Weather risk (FORECAST_RISK) does NOT prove port closure
            if evt_type in ["PORT_CLOSURE", "STRIKE"]:
                if trust_state == "CONFIRMED_DISRUPTION":
                    affected_slots = evt.get("affected_slots", [])
                    if not affected_slots or s_id in affected_slots:
                        violations.append(f"Port Operational Closure: Slot {s_id} closed by confirmed disruption {evt.get('event_id')}")
                elif trust_state == "FORECAST_RISK":
                    # Advisory only, do not block confirmed slot
                    pass

            # Confirmed severe route flooding for specific assigned truck
            if evt_type == "HEAVY_RAIN" and trust_state == "CONFIRMED_DISRUPTION":
                affected_trucks = evt.get("affected_trucks", [])
                if t_id in affected_trucks and evt.get("severity") == "CRITICAL":
                    violations.append(f"Severe Weather Hazard: Route flooded for truck {t_id}")

    is_eligible = (len(violations) == 0)
    return is_eligible, violations
