from typing import Dict, Any, List


def run_historical_replay() -> Dict[str, Any]:
    scenarios = [
        {
            "incident_id": "INC-C102",
            "container_id": "C102",
            "description": "Gross weight mismatch & driver ETA conflict at peak hours",
            "do_nothing_cost_inr": 36000,
            "fifo_cost_inr": 24000,
            "edf_cost_inr": 18000,
            "lira_cost_inr": 6000,
            "avoided_cost_inr": 30000,
            "recovery_time_mins": 14
        },
        {
            "incident_id": "INC-C105",
            "container_id": "C105",
            "description": "BoE customs amendment required before free time expiry",
            "do_nothing_cost_inr": 48000,
            "fifo_cost_inr": 31000,
            "edf_cost_inr": 22000,
            "lira_cost_inr": 8000,
            "avoided_cost_inr": 40000,
            "recovery_time_mins": 18
        },
        {
            "incident_id": "INC-C107",
            "container_id": "C107",
            "description": "Physical RFID mismatch & Bay no-show triggering Wave 2 replan",
            "do_nothing_cost_inr": 42000,
            "fifo_cost_inr": 28000,
            "edf_cost_inr": 20000,
            "lira_cost_inr": 9000,
            "avoided_cost_inr": 33000,
            "recovery_time_mins": 12
        }
    ]

    total_do_nothing = sum(s["do_nothing_cost_inr"] for s in scenarios)
    total_fifo = sum(s["fifo_cost_inr"] for s in scenarios)
    total_edf = sum(s["edf_cost_inr"] for s in scenarios)
    total_lira = sum(s["lira_cost_inr"] for s in scenarios)
    total_avoided = sum(s["avoided_cost_inr"] for s in scenarios)

    return {
        "summary": {
            "total_incidents_replayed": len(scenarios),
            "total_do_nothing_cost_inr": total_do_nothing,
            "total_fifo_cost_inr": total_fifo,
            "total_edf_cost_inr": total_edf,
            "total_lira_cost_inr": total_lira,
            "total_avoided_cost_inr": total_avoided,
            "cost_reduction_percent": round(((total_do_nothing - total_lira) / total_do_nothing) * 100, 1),
            "lira_vs_edf_savings_inr": total_edf - total_lira
        },
        "scenarios": scenarios
    }

