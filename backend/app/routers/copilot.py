"""
Quantum Dispatch Copilot Router — Prompt 3 Feature 2
Endpoints:
- POST /api/v1/copilot/ask -> conversation_id
- GET /api/v1/copilot/stream/{conversation_id} -> SSE stream (thought, tool_call, tool_result, answer, done)
- GET /api/v1/copilot/history/{conversation_id} -> message history
"""

import asyncio
import json
import logging
import uuid
from typing import Dict, Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db, AsyncSessionLocal
from app.db.models import CopilotMessageModel
from app.services.copilot.agent import (
    run_copilot_turn, _COPILOT_QUEUES
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/copilot", tags=["Quantum Dispatch Copilot"])


@router.post("/ask")
async def ask_copilot(
    payload: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Submits a user question to the Quantum Dispatch Copilot.
    Returns a conversation_id to subscribe to the SSE stream.
    """
    query = payload.get("query", "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    conversation_id = payload.get("conversation_id") or f"CONV-{uuid.uuid4().hex[:8]}"

    # Save user message
    user_msg = CopilotMessageModel(
        message_id=f"MSG-{uuid.uuid4().hex[:8]}",
        conversation_id=conversation_id,
        role="user",
        content=query,
        tool_calls_json=[],
        tool_results_json=[]
    )
    db.add(user_msg)
    await db.commit()

    # Create streaming queue for this conversation
    queue = asyncio.Queue()
    _COPILOT_QUEUES[conversation_id] = queue

    # Run agent loop in background
    asyncio.create_task(run_copilot_turn(conversation_id, query, queue))

    return {
        "status": "ACCEPTED",
        "conversation_id": conversation_id,
        "stream_url": f"/api/v1/copilot/stream/{conversation_id}"
    }


@router.get("/stream/{conversation_id}")
async def stream_copilot_response(
    conversation_id: str,
    request: Request
):
    """
    SSE stream emitting:
    - thought
    - tool_call
    - tool_result
    - answer
    - done
    """
    queue = _COPILOT_QUEUES.get(conversation_id)
    if not queue:
        # If queue not found, initialize a transient one
        queue = asyncio.Queue()
        _COPILOT_QUEUES[conversation_id] = queue

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=25.0)
                    yield msg
                    # Check if stream ended
                    if '"type": "done"' in msg:
                        break
                except asyncio.TimeoutError:
                    yield f": keepalive\n\n"
        finally:
            _COPILOT_QUEUES.pop(conversation_id, None)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/history/{conversation_id}")
async def get_copilot_history(
    conversation_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns message history for this conversation.
    """
    stmt = select(CopilotMessageModel).where(
        CopilotMessageModel.conversation_id == conversation_id
    ).order_by(CopilotMessageModel.created_at.asc())
    res = await db.execute(stmt)
    msgs = res.scalars().all()

    return {
        "conversation_id": conversation_id,
        "count": len(msgs),
        "messages": [
            {
                "message_id": m.message_id,
                "role": m.role,
                "content": m.content,
                "tool_calls": m.tool_calls_json or [],
                "tool_results": m.tool_results_json or [],
                "created_at": m.created_at
            }
            for m in msgs
        ]
    }

