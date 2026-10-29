"""
LIRA Tag Registry Service (Physical RFID Cards)
Requirement 3:
Real physical cards:
  F7B5FB03,TRUCK_CARD,T09
  32A3FF03,TRUCK_CARD,T11
  15B2FE03,EQUIPMENT_TAG,R-03
  7226DA05,EQUIPMENT_TAG,R-07
  1D46FB03,CONTAINER_TAG,ONEU5519206

tag_registry_canonical = lines "tag_ref,role,entity_id" sorted by tag_ref, joined by "\n", no trailing newline.
"""

import hashlib
from typing import Dict, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import ResourceRegistryModel

REAL_TAG_ENTRIES = [
    {"tag_ref": "F7B5FB03", "role": "TRUCK_CARD", "entity_id": "T09", "resource_type": "TRUCK"},
    {"tag_ref": "32A3FF03", "role": "TRUCK_CARD", "entity_id": "T11", "resource_type": "TRUCK"},
    {"tag_ref": "15B2FE03", "role": "EQUIPMENT_TAG", "entity_id": "R-03", "resource_type": "CHASSIS"},
    {"tag_ref": "7226DA05", "role": "EQUIPMENT_TAG", "entity_id": "R-07", "resource_type": "CHASSIS"},
    {"tag_ref": "1D46FB03", "role": "CONTAINER_TAG", "entity_id": "ONEU5519206", "resource_type": "CONTAINER"},
]

# Quick map by tag_ref
TAG_LOOKUP_MAP: Dict[str, Dict[str, str]] = {
    e["tag_ref"].upper(): e for e in REAL_TAG_ENTRIES
}


async def seed_real_tag_registry(db: AsyncSession) -> None:
    """Seeds the 5 canonical physical RFID cards into resource_registry table."""
    for entry in REAL_TAG_ENTRIES:
        res_id = entry["entity_id"]
        stmt = select(ResourceRegistryModel).where(ResourceRegistryModel.resource_id == res_id)
        res = await db.execute(stmt)
        existing = res.scalars().first()
        if not existing:
            reg = ResourceRegistryModel(
                resource_id=res_id,
                resource_type=entry["resource_type"],
                name=f"{entry['role']}: {entry['entity_id']}",
                tag_ref=entry["tag_ref"].upper(),
                status="INSPECTED_AVAILABLE",
                location="JNPT-BAY-04",
                specs={"role": entry["role"], "entity_id": entry["entity_id"]}
            )
            db.add(reg)
        else:
            existing.tag_ref = entry["tag_ref"].upper()
            existing.specs = {"role": entry["role"], "entity_id": entry["entity_id"]}
    await db.commit()


def get_canonical_tag_registry() -> Tuple[str, str]:
    """
    Returns (tag_registry_canonical, tag_registry_digest)
    sorted by tag_ref, joined by "\n", no trailing newline.
    """
    sorted_entries = sorted(REAL_TAG_ENTRIES, key=lambda x: x["tag_ref"].upper())
    lines = [f"{e['tag_ref'].upper()},{e['role']},{e['entity_id']}" for e in sorted_entries]
    canonical_str = "\n".join(lines)
    digest = hashlib.sha256(canonical_str.encode("utf-8")).hexdigest().lower()
    return canonical_str, digest


def lookup_tag_info(tag_ref: str) -> Optional[Dict[str, str]]:
    """Looks up tag metadata by tag UID."""
    return TAG_LOOKUP_MAP.get(tag_ref.strip().upper())

