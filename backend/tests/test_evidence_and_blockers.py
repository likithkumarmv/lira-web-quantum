import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_document_ingestion_and_quote_extraction():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        sample_doc = """INVOICE #99401 - MAERSK LINE
Container: C102
Gross weight: 12,450 kg
Bill of Entry pending amendment
Target discharge slot: S1600"""

        resp = await ac.post("/api/v1/ingest/document", json={
            "raw_text": sample_doc,
            "source_id": "SRC-TEST-INV-01",
            "container_id": "C102"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "COMPLETED"
        assert "job_id" in data

        # Check job details
        job_res = await ac.get(f"/api/v1/ingest/jobs/{data['job_id']}")
        assert job_res.status_code == 200
        job_data = job_res.json()
        assert len(job_data["candidate_blockers"]) >= 1

        # Check exact quote matching
        first_b = job_data["candidate_blockers"][0]
        start_c = first_b["start_char"]
        end_c = first_b["end_char"]
        assert sample_doc[start_c:end_c].strip() == first_b["quote"].strip()

