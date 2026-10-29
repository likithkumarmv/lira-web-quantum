from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import IncidentModel, BlockerNodeModel, DependencyEdgeModel, ContainerModel


async def get_incident_blocker_graph(db: AsyncSession, incident_id: str) -> Dict[str, Any]:
    # 1. Fetch incident
    inc_stmt = select(IncidentModel).where(IncidentModel.incident_id == incident_id)
    inc_res = await db.execute(inc_stmt)
    incident = inc_res.scalars().first()
    if not incident:
        return None

    # 2. Fetch container
    cnt_stmt = select(ContainerModel).where(ContainerModel.container_id == incident.container_id)
    cnt_res = await db.execute(cnt_stmt)
    container = cnt_res.scalars().first()

    # 3. Fetch nodes
    node_stmt = select(BlockerNodeModel).where(BlockerNodeModel.incident_id == incident_id)
    node_res = await db.execute(node_stmt)
    nodes = node_res.scalars().all()

    # 4. Fetch edges
    edge_stmt = select(DependencyEdgeModel).where(DependencyEdgeModel.incident_id == incident_id)
    edge_res = await db.execute(edge_stmt)
    edges = edge_res.scalars().all()

    return {
        "incident_id": incident.incident_id,
        "container_id": incident.container_id,
        "title": incident.title,
        "severity": incident.severity,
        "status": incident.status,
        "root_blocker_code": incident.root_blocker_code,
        "owner_role": incident.owner_role,
        "action_deadline": incident.action_deadline,
        "projected_avoidable_cost_inr": incident.projected_avoidable_cost_inr,
        "do_nothing_cost_inr": incident.do_nothing_cost_inr,
        "nodes": [
            {
                "node_id": n.node_id,
                "incident_id": n.incident_id,
                "container_id": n.container_id,
                "code": n.code,
                "claim": n.claim,
                "quote": n.quote,
                "start_char": n.start_char,
                "end_char": n.end_char,
                "authority_tier": n.authority_tier,
                "status": n.status,
                "responsible_role": n.responsible_role,
                "evidence_id": n.evidence_id
            } for n in nodes
        ],
        "edges": [
            {
                "edge_id": e.edge_id,
                "incident_id": e.incident_id,
                "source_node_id": e.source_node_id,
                "target_node_id": e.target_node_id,
                "relationship_type": e.relationship_type
            } for e in edges
        ],
        "container_details": {
            "container_id": container.container_id if container else incident.container_id,
            "size_ft": container.size_ft if container else 40,
            "weight_kg": container.weight_kg if container else 22500,
            "release_state": container.release_state if container else "NEEDS_VERIFICATION",
            "free_time_deadline": container.free_time_deadline if container else "",
            "delivery_deadline": container.delivery_deadline if container else ""
        },
        "created_at": incident.created_at,
        "updated_at": incident.updated_at
    }

