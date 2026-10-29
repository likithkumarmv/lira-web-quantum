import json
import os
import sys

# Ensure backend root is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app

def dump_yaml(data, indent=0):
    lines = []
    space = "  " * indent
    if isinstance(data, dict):
        for k, v in data.items():
            key_str = str(k)
            if isinstance(v, (dict, list)):
                if not v:
                    lines.append(f"{space}{key_str}: " + ("{}" if isinstance(v, dict) else "[]"))
                else:
                    lines.append(f"{space}{key_str}:")
                    lines.append(dump_yaml(v, indent + 1))
            elif isinstance(v, bool):
                lines.append(f"{space}{key_str}: {'true' if v else 'false'}")
            elif v is None:
                lines.append(f"{space}{key_str}: null")
            elif isinstance(v, (int, float)):
                lines.append(f"{space}{key_str}: {v}")
            else:
                s = str(v).replace("\\", "\\\\").replace('"', '\\"')
                if "\n" in s or any(c in s for c in ":#{}[]&*?|-<>=!%@`"):
                    lines.append(f'{space}{key_str}: "{s}"')
                else:
                    lines.append(f"{space}{key_str}: {s}")
    elif isinstance(data, list):
        for item in data:
            if isinstance(item, (dict, list)):
                if not item:
                    lines.append(f"{space}- " + ("{}" if isinstance(item, dict) else "[]"))
                else:
                    sub = dump_yaml(item, indent + 1)
                    sub_lines = sub.split("\n")
                    first = sub_lines[0].lstrip()
                    lines.append(f"{space}- {first}")
                    for sl in sub_lines[1:]:
                        lines.append(sl)
            elif isinstance(item, bool):
                lines.append(f"{space}- {'true' if item else 'false'}")
            elif item is None:
                lines.append(f"{space}- null")
            elif isinstance(item, (int, float)):
                lines.append(f"{space}- {item}")
            else:
                s = str(item).replace("\\", "\\\\").replace('"', '\\"')
                if "\n" in s or any(c in s for c in ":#{}[]&*?|-<>=!%@`"):
                    lines.append(f'{space}- "{s}"')
                else:
                    lines.append(f"{space}- {s}")
    return "\n".join(lines)

def main():
    contracts_dir = os.path.abspath(os.path.join(backend_dir, "..", "contracts"))
    os.makedirs(contracts_dir, exist_ok=True)
    
    openapi_schema = app.openapi()
    
    # Save openapi.json
    json_path = os.path.join(contracts_dir, "openapi.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(openapi_schema, f, indent=2)
    print(f"Generated: {json_path}")
    
    # Save openapi.yaml
    yaml_path = os.path.join(contracts_dir, "openapi.yaml")
    yaml_str = dump_yaml(openapi_schema)
    with open(yaml_path, "w", encoding="utf-8") as f:
        f.write(yaml_str)
    print(f"Generated: {yaml_path}")
    
    # Generate frozen sample payloads for ESP32 and Android
    esp32_payloads = {
        "device_state_response": {
            "device_id": "ESP32-GATE-01",
            "device_type": "ESP32_TFT_RC522",
            "display_header": "LIRA RESOURCELOCK",
            "display_lines": [
                "STATE: TAG_OBSERVED",
                "RES: RES-CHASSIS-40-01",
                "TAG: TAG_07",
                "CHAL: CHAL-4921",
                "STATUS: AWAITING WEB COMMIT"
            ],
            "prompt_tag": "TAG_07",
            "tag_observed": "TAG_07",
            "awaiting_web_confirmation": True,
            "active_work_order_id": "WO-20261029-4921",
            "decision_capsule_status": "ACTIVE_SIGNED_V9"
        },
        "decision_capsule_response": {
            "snapshot_hash": "sha256-a1b2c3d4e5f67890",
            "plan_version": 2,
            "solver_run_id": "qpiai-opt-qubo-20261029-01",
            "provider": "QPIAI_OPT_LOCAL_FALLBACK",
            "backend": "hybrid_qubo_classical",
            "source_origin": "LAB_FIXTURE",
            "shortlist_candidates": [
                {
                    "candidate_id": "CAND-01",
                    "resource_id": "RES-CHASSIS-40-01",
                    "tag_id": "TAG_07",
                    "driver_id": "DRV-101",
                    "truck_id": "TRK-MH04-8899",
                    "modeled_cost": 2450.0,
                    "exclusion_reason": None
                },
                {
                    "candidate_id": "CAND-02",
                    "resource_id": "RES-CHASSIS-40-02",
                    "tag_id": "TAG_09",
                    "driver_id": "DRV-102",
                    "truck_id": "TRK-MH04-4411",
                    "modeled_cost": 2900.0,
                    "exclusion_reason": "High cost backup"
                }
            ],
            "exclusion_reasons": {
                "RES-CHASSIS-QUAR": "Failed brake air pressure inspection (Quarantined)"
            },
            "modeled_cost": 2450.0,
            "issued_at": "2026-10-29T04:20:00Z",
            "expires_at": "2026-10-29T04:50:00Z",
            "signature": "hmac_sha256_hex_digest_9876543210abcdef"
        },
        "edge_event_request": {
            "event_type": "SCAN_OBSERVED",
            "raw_payload": "TAG_07",
            "tag_ref": "TAG_07",
            "work_order_id": "WO-20261029-4921",
            "sequence_number": 42,
            "hmac_signature": "simulated-sig"
        }
    }
    
    with open(os.path.join(contracts_dir, "esp32_contract_samples.json"), "w", encoding="utf-8") as f:
        json.dump(esp32_payloads, f, indent=2)
    print("Generated: contracts/esp32_contract_samples.json")
    
    android_payloads = {
        "driver_task_response": {
            "task_id": "TSK-001",
            "status": "ASSIGNED",
            "driver_id": "DRV-101",
            "resource_id": "RES-CHASSIS-40-01",
            "gate_id": "GATE-01",
            "auth_challenge": "CHAL-4921",
            "instruction": "Present TAG_07 at ESP32 Gate 01 display; wait for Dispatcher Web Confirmation"
        },
        "plan_latest_response": {
            "plan_id": "PLAN-20261029-WAVE2",
            "version": 2,
            "status": "APPROVED",
            "solver_backend": "QPIAI_OPT_LOCAL_FALLBACK",
            "modeled_cost": 2450.0,
            "tasks": [
                {
                    "task_id": "TSK-001",
                    "job_id": "JOB-JNPA-401",
                    "resource_id": "RES-CHASSIS-40-01",
                    "driver_id": "DRV-101",
                    "status": "ASSIGNED"
                }
            ]
        }
    }
    
    with open(os.path.join(contracts_dir, "android_contract_samples.json"), "w", encoding="utf-8") as f:
        json.dump(android_payloads, f, indent=2)
    print("Generated: contracts/android_contract_samples.json")

if __name__ == "__main__":
    main()

