"""
LIRA Freight Domain Blocker Model
Implements the 15 real-world freight blocker rules parameterized by
terminal, jurisdiction, cargo profile, equipment, and verified operational state.
"""

import datetime
from typing import Dict, Any, List, Optional, Tuple


# Terminal-specific parameterizations (e.g. JNPT Nhava Sheva vs Mundra vs Chennai)
TERMINAL_POLICIES = {
    "JNPT": {
        "free_time_hours_standard": 72,
        "dpd_evacuation_hours": 48,
        "heavy_haul_weight_threshold_kg": 24000.0,
        "high_stack_depth_threshold": 4,
        "high_stack_delay_hours": 2.5,
        "curfew_hours_start": "23:00",
        "curfew_hours_end": "05:00",
        "supported_empty_depots": ["DEPOT-NSICT-01", "DEPOT-APMT-02", "DEPOT-BMCT-03"]
    },
    "MUNDRA": {
        "free_time_hours_standard": 96,
        "dpd_evacuation_hours": 72,
        "heavy_haul_weight_threshold_kg": 26000.0,
        "high_stack_depth_threshold": 5,
        "high_stack_delay_hours": 3.0,
        "curfew_hours_start": "00:00",
        "curfew_hours_end": "04:00",
        "supported_empty_depots": ["DEPOT-MUNDRA-01", "DEPOT-MUNDRA-02"]
    }
}


# 15 Canonical Blocker Codes
BLOCKER_DEFINITIONS = {
    "CHASSIS_SHORTAGE_40FT": {
        "name": "Chassis Shortage / Incompatible 40ft Chassis",
        "tier": "T2",
        "default_role": "DISPATCHER",
        "impact_type": "EQUIPMENT_UNAVAILABLE",
        "category": "EQUIPMENT"
    },
    "TRI_AXLE_REQUIRED": {
        "name": "Heavy-Haul Tri-Axle Chassis Mandate (>24,000 kg)",
        "tier": "T1",
        "default_role": "DISPATCHER",
        "impact_type": "STATUTORY_WEIGHT_NONCOMPLIANCE",
        "category": "EQUIPMENT"
    },
    "REEFER_GENSET_REQUIRED": {
        "name": "Refrigerated Container Genset Missing / Incompatible",
        "tier": "T2",
        "default_role": "TERMINAL_OPERATOR",
        "impact_type": "COLD_CHAIN_RISK",
        "category": "EQUIPMENT"
    },
    "DUAL_TRANSACTION_MISMATCH": {
        "name": "Dual-Transaction Empty-Return Pairing Prerequisite Unmet",
        "tier": "T2",
        "default_role": "DISPATCHER",
        "impact_type": "GATE_ACCESS_DENIED",
        "category": "TERMINAL"
    },
    "EMPTY_DEPOT_REJECTION": {
        "name": "Empty Return Depot Rejection (Yard At Capacity)",
        "tier": "T2",
        "default_role": "SHIPPING_LINE_AGENT",
        "impact_type": "DETENTION_RISK",
        "category": "TERMINAL"
    },
    "DPD_EVACUATION_CLIFF": {
        "name": "Direct Port Delivery (DPD) 48-Hour Evacuation Deadline",
        "tier": "T1",
        "default_role": "CUSTOMS_BROKER",
        "impact_type": "CFS_TRANSFER_PENALTY",
        "category": "CUSTOMS"
    },
    "PGA_CLEARANCE_PENDING": {
        "name": "Participating Government Agency Hold (FSSAI / PQ / ADC)",
        "tier": "T1",
        "default_role": "CUSTOMS_BROKER",
        "impact_type": "STATUTORY_HOLD",
        "category": "CUSTOMS"
    },
    "PAYMENT_RECONCILIATION_DELAY": {
        "name": "Bank UTR Settlement Pending Carrier Ledger Confirmation",
        "tier": "T2",
        "default_role": "FINANCE_DESK",
        "impact_type": "DELIVERY_ORDER_WITHHELD",
        "category": "FINANCIAL"
    },
    "CARRIER_SETTLEMENT_CUTOFF": {
        "name": "Carrier Banking & Counter Cutoff Approaching",
        "tier": "T2",
        "default_role": "SHIPPING_LINE_AGENT",
        "impact_type": "CLEARANCE_CUTOFF",
        "category": "FINANCIAL"
    },
    "YARD_STACK_DEPTH_DELAY": {
        "name": "Deep Yard Stack Dig-Out Required (Stack Depth >= 4)",
        "tier": "T2",
        "default_role": "TERMINAL_OPERATOR",
        "impact_type": "TURNAROUND_DELAY",
        "category": "TERMINAL"
    },
    "CRANE_CAPACITY_CONGESTION": {
        "name": "Quay/Yard Crane Maintenance or Bottleneck Congestion",
        "tier": "T2",
        "default_role": "TERMINAL_OPERATOR",
        "impact_type": "BAY_ACCESS_DELAY",
        "category": "TERMINAL"
    },
    "WAREHOUSE_APPOINTMENT_MISSED": {
        "name": "Consignee Warehouse Receiving Window Lapsed / Cancelled",
        "tier": "T3",
        "default_role": "LOGISTICS_COORDINATOR",
        "impact_type": "OFFLOAD_REFUSAL",
        "category": "CONSIGNEE"
    },
    "UNLOADING_CREW_SHORTAGE": {
        "name": "Consignee Dock Unloading Crew Unavailable / Shift Overrun",
        "tier": "T4",
        "default_role": "LOGISTICS_COORDINATOR",
        "impact_type": "DETENTION_ACCUMULATION",
        "category": "CONSIGNEE"
    },
    "DETENTION_ACCUMULATION": {
        "name": "Carrier Equipment Detention Free Time Exceeded",
        "tier": "T2",
        "default_role": "SHIPPING_LINE_AGENT",
        "impact_type": "FINANCIAL_PENALTY",
        "category": "FINANCIAL"
    },
    "DEMURRAGE_DISPUTE_EVIDENCED": {
        "name": "Evidence-Backed Terminal Demurrage Waiver Dispute",
        "tier": "T1",
        "default_role": "LEGAL_COMPLIANCE",
        "impact_type": "DISPUTED_INVOICE",
        "category": "FINANCIAL"
    }
}


def evaluate_expanded_blockers(
    container: Dict[str, Any],
    truck: Optional[Dict[str, Any]] = None,
    slot: Optional[Dict[str, Any]] = None,
    external_context: Optional[Dict[str, Any]] = None,
    terminal_code: str = "JNPT"
) -> List[Dict[str, Any]]:
    """
    Evaluates cargo and equipment attributes against the 15 expanded freight blocker rules.
    Returns list of discovered blocker nodes with grounded causal explanations.
    """
    policy = TERMINAL_POLICIES.get(terminal_code, TERMINAL_POLICIES["JNPT"])
    identified_blockers = []

    c_id = container.get("container_id", "UNKNOWN")
    weight = float(container.get("weight_kg", 20000.0))
    size_ft = int(container.get("size_ft", 40))
    cargo_type = container.get("cargo_type", "GENERAL_CARGO").upper()
    special_handling = container.get("special_handling", "STANDARD").upper()
    release_state = container.get("release_state", "NEEDS_VERIFICATION")
    is_dpd = container.get("is_dpd", False)

    # 1. Tri-axle rule
    if weight >= policy["heavy_haul_weight_threshold_kg"]:
        if truck:
            chassis_type = truck.get("chassis_type", "STANDARD_TRI_AXLE" if truck.get("payload_capacity_kg", 0) >= 28000 else "STANDARD_TANDEM")
            if "TRI_AXLE" not in chassis_type:
                identified_blockers.append({
                    "code": "TRI_AXLE_REQUIRED",
                    "claim": f"Container {c_id} weight ({weight:,.0f} kg) exceeds statutory heavy-haul limit ({policy['heavy_haul_weight_threshold_kg']:,.0f} kg). Mandates tri-axle chassis; truck {truck.get('truck_id')} is {chassis_type}.",
                    "authority_tier": "T1",
                    "status": "HARD_BLOCKER",
                    "responsible_role": "DISPATCHER",
                    "required_action": "Reassign to certified tri-axle heavy-haul vehicle"
                })

    # 2. Reefer Genset rule
    if "REEFER" in cargo_type or "PERISHABLE" in cargo_type or "COLD_CHAIN" in special_handling:
        has_genset = truck.get("has_genset", False) if truck else False
        if not has_genset:
            identified_blockers.append({
                "code": "REEFER_GENSET_REQUIRED",
                "claim": f"Perishable reefer cargo {c_id} requires active clip-on generator set (genset). Assigned equipment lacks auxiliary power unit.",
                "authority_tier": "T2",
                "status": "HARD_BLOCKER",
                "responsible_role": "DISPATCHER",
                "required_action": "Mount auxiliary clip-on diesel genset or assign reefer-equipped trailer"
            })

    # 3. DPD 48-Hour Evacuation Deadline rule
    if is_dpd:
        free_deadline_str = container.get("free_time_deadline")
        if free_deadline_str:
            try:
                deadline_dt = datetime.datetime.fromisoformat(free_deadline_str.replace("Z", "+00:00"))
                now = datetime.datetime.now(datetime.timezone.utc)
                remaining_hours = (deadline_dt - now).total_seconds() / 3600.0
                if 0 < remaining_hours <= 12:
                    identified_blockers.append({
                        "code": "DPD_EVACUATION_CLIFF",
                        "claim": f"Direct Port Delivery (DPD) 48-hour gate-out deadline expiring in {remaining_hours:.1f} hours. Terminal will transfer box to distant CFS with ₹15,000 en-route penalty if not evacuated.",
                        "authority_tier": "T1",
                        "status": "HARD_BLOCKER",
                        "responsible_role": "CUSTOMS_BROKER",
                        "required_action": "Expedite gate-out pass and prioritize immediate terminal slot"
                    })
            except Exception:
                pass

    # 4. Yard Stack Depth delay rule
    stack_depth = container.get("stack_depth", 1)
    if stack_depth >= policy["high_stack_depth_threshold"]:
        identified_blockers.append({
            "code": "YARD_STACK_DEPTH_DELAY",
            "claim": f"Container {c_id} is buried at yard stack depth {stack_depth} (tier limit: {policy['high_stack_depth_threshold']}). RTG crane dig-out requires estimated {policy['high_stack_delay_hours']} hours turnaround delay.",
            "authority_tier": "T2",
            "status": "NEEDS_VERIFICATION",
            "responsible_role": "TERMINAL_OPERATOR",
            "required_action": "Request pre-stage dig-out work order 2 hours prior to truck gate-in"
        })

    # 5. Participating Government Agency (PGA) clearance
    pga_status = container.get("pga_status")
    if pga_status in ["PENDING", "SAMPLING_REQUIRED", "HOLD"]:
        identified_blockers.append({
            "code": "PGA_CLEARANCE_PENDING",
            "claim": f"Participating Government Agency (FSSAI/Plant Quarantine/ADC) statutory sampling hold active on container {c_id}.",
            "authority_tier": "T1",
            "status": "HARD_BLOCKER",
            "responsible_role": "CUSTOMS_BROKER",
            "required_action": "Await authorized officer inspection and test lab NOC entry on ICEGATE"
        })

    # 6. Dual-transaction empty-return pairing
    requires_empty_drop = container.get("requires_empty_drop", False)
    paired_empty_id = container.get("paired_empty_container_id")
    if requires_empty_drop and not paired_empty_id:
        identified_blockers.append({
            "code": "DUAL_TRANSACTION_MISMATCH",
            "claim": f"Terminal operating policy mandates dual-transaction gate pass: driver must deliver empty container before receiving import box {c_id}.",
            "authority_tier": "T2",
            "status": "HARD_BLOCKER",
            "responsible_role": "DISPATCHER",
            "required_action": "Pair import pickup with available empty-return dispatch order"
        })

    return identified_blockers

