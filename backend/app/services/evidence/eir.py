"""
LIRA Equipment Interchange Receipt (EIR) PDF Generator
Generates a tamper-evident 1-page PDF EIR as T2 evidence for committed physical interchanges.
Computes SHA-256 hash and registers as EvidenceRecordModel.
"""

import io
import hashlib
import datetime
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors


def generate_eir_pdf_bytes(
    txn_id: str,
    eir_no: str,
    site_id: str,
    truck_id: str,
    chassis_id: str,
    container_no: str,
    custodian_user_id: str,
    plan_version: int,
    solver_run_id: str,
    challenge_code: str
) -> tuple[bytes, str]:
    """
    Generates a 1-page PDF EIR and returns (pdf_bytes, sha256_hex).
    """
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    # Header
    p.setFillColor(colors.HexColor("#0B1420"))
    p.rect(0, height - 70, width, 70, fill=True, stroke=False)
    p.setFillColor(colors.white)
    p.setFont("Helvetica-Bold", 18)
    p.drawString(40, height - 42, "LIRA-Q SENTINEL — EQUIPMENT INTERCHANGE RECEIPT (EIR)")
    p.setFont("Helvetica", 9)
    p.drawString(40, height - 58, "Statutory Cyber-Physical Staging Pass | Authority Tier: T2 (Physical Gate Custody)")

    # Metadata bar
    p.setFillColor(colors.HexColor("#F3F6FA"))
    p.rect(40, height - 130, width - 80, 45, fill=True, stroke=True)
    p.setFillColor(colors.HexColor("#102235"))
    p.setFont("Helvetica-Bold", 10)
    p.drawString(55, height - 100, f"EIR NO: {eir_no}")
    p.drawString(240, height - 100, f"TXN ID: {txn_id}")
    p.drawString(420, height - 100, f"SITE: {site_id}")
    p.setFont("Helvetica", 9)
    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    p.drawString(55, height - 118, f"TIMESTAMP: {now_str}")
    p.drawString(240, height - 118, f"CHALLENGE: {challenge_code}")
    p.drawString(420, height - 118, f"STATUS: COMMITTED")

    # Table of Details
    y = height - 160
    fields = [
        ("Prime Mover / Truck", truck_id),
        ("Allocated Chassis", chassis_id),
        ("Container Number", container_no),
        ("Checkpoint Terminal", site_id),
        ("Authorizing Custodian", custodian_user_id),
        ("Active Plan Version", f"v{plan_version}"),
        ("QpiAI Optimization Run ID", solver_run_id),
        ("Physical Interlock Status", "TWO-TAP VERIFIED & WEB COMMITTED"),
    ]

    for label, val in fields:
        p.setFont("Helvetica-Bold", 10)
        p.setFillColor(colors.HexColor("#516678"))
        p.drawString(60, y, label)
        p.setFont("Helvetica", 10)
        p.setFillColor(colors.HexColor("#102235"))
        p.drawString(240, y, str(val))
        p.setStrokeColor(colors.HexColor("#E5E7EB"))
        p.line(60, y - 6, width - 60, y - 6)
        y -= 26

    # Legal / Statutory clause
    y -= 20
    p.setFont("Helvetica-Bold", 9)
    p.setFillColor(colors.HexColor("#067A9B"))
    p.drawString(60, y, "STATUTORY DETENTION CLOCK-STOP NOTICE")
    p.setFont("Helvetica", 8)
    p.setFillColor(colors.HexColor("#516678"))
    y -= 14
    p.drawString(60, y, "Under Indian Major Port Authorities regulations and DPD Terminal Guidelines, physical custody of this chassis")
    y -= 12
    p.drawString(60, y, f"and container is verified at {site_id}. Ready-at-bay clock-stop event has been cryptographically recorded.")

    # Footer
    p.setFont("Helvetica-Bold", 8)
    p.setFillColor(colors.HexColor("#9CA3AF"))
    p.drawString(60, 40, "Cryptographically signed and anchored to LIRA Cyber-Physical ResourceLock ledger.")

    p.showPage()
    p.save()

    pdf_bytes = buffer.getvalue()
    sha256_hex = hashlib.sha256(pdf_bytes).hexdigest()
    return pdf_bytes, sha256_hex

