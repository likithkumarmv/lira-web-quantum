import re
import csv
import io
import zlib
import email
from email import policy
from typing import Tuple, Dict, Any, Optional


def parse_eml_content(raw_bytes: bytes) -> Tuple[str, Dict[str, Any]]:
    """
    Parses RFC 822 / MIME .eml email content into clean text and metadata.
    """
    try:
        msg = email.message_from_bytes(raw_bytes, policy=policy.default)
        headers = {
            "from": msg.get("From", ""),
            "to": msg.get("To", ""),
            "subject": msg.get("Subject", ""),
            "date": msg.get("Date", "")
        }
        
        body_parts = []
        if msg.is_multipart():
            for part in msg.walk():
                ctype = part.get_content_type()
                cdispo = str(part.get("Content-Disposition", ""))
                if ctype == "text/plain" and "attachment" not in cdispo:
                    payload = part.get_payload(decode=True)
                    if payload:
                        body_parts.append(payload.decode("utf-8", errors="replace"))
                elif ctype == "text/html" and not body_parts and "attachment" not in cdispo:
                    payload = part.get_payload(decode=True)
                    if payload:
                        # Strip basic html tags
                        html_text = payload.decode("utf-8", errors="replace")
                        clean_text = re.sub(r"<[^>]+>", " ", html_text)
                        clean_text = re.sub(r"\s+", " ", clean_text)
                        body_parts.append(clean_text)
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                body_parts.append(payload.decode("utf-8", errors="replace"))

        body = "\n".join(body_parts).strip()
        formatted = f"FROM: {headers['from']}\nTO: {headers['to']}\nSUBJECT: {headers['subject']}\nDATE: {headers['date']}\n\n{body}"
        return formatted, headers
    except Exception as exc:
        fallback = raw_bytes.decode("utf-8", errors="replace")
        return fallback, {"error": str(exc)}


def parse_csv_content(raw_bytes: bytes) -> Tuple[str, Dict[str, Any]]:
    """
    Parses tabular CSV shipping records into structured claims text.
    """
    try:
        text = raw_bytes.decode("utf-8", errors="replace")
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
        if not rows:
            return text, {"row_count": 0}

        headers = [h.strip() for h in rows[0]]
        formatted_lines = [f"CSV SHIPPING RECORD ({len(rows)-1} rows):", f"Columns: {', '.join(headers)}", ""]

        for idx, row in enumerate(rows[1:], start=1):
            row_items = []
            for h, val in zip(headers, row):
                row_items.append(f"{h}: {val.strip()}")
            formatted_lines.append(f"Row {idx} -> " + " | ".join(row_items))

        return "\n".join(formatted_lines), {"row_count": len(rows)-1, "columns": headers}
    except Exception as exc:
        fallback = raw_bytes.decode("utf-8", errors="replace")
        return fallback, {"error": str(exc)}


def parse_pdf_content(raw_bytes: bytes) -> Tuple[str, Dict[str, Any]]:
    """
    Pure Python PDF stream extractor:
    Decompresses FlateDecode streams with zlib and extracts text from Tj / TJ operators.
    """
    try:
        extracted_text_chunks = []
        
        # 1. Search for FlateDecode compressed streams
        stream_matches = re.finditer(rb"stream[\r\n]+(.*?)[\r\n]+endstream", raw_bytes, re.DOTALL)
        for sm in stream_matches:
            stream_data = sm.group(1)
            # Try decompressing
            decompressed = None
            try:
                decompressed = zlib.decompress(stream_data)
            except Exception:
                try:
                    decompressed = zlib.decompress(stream_data, -15)
                except Exception:
                    decompressed = stream_data

            if decompressed:
                # Extract text between parenthesis inside Tj operators: (some text) Tj
                tj_matches = re.findall(rb"\((.*?)\)\s*Tj", decompressed)
                for tj in tj_matches:
                    try:
                        extracted_text_chunks.append(tj.decode("utf-8", errors="ignore"))
                    except Exception:
                        pass
                
                # Extract text inside array TJ operators: [(some) 20 (text)] TJ
                tj_array_matches = re.findall(rb"\[(.*?)\]\s*TJ", decompressed)
                for tja in tj_array_matches:
                    inner = re.findall(rb"\((.*?)\)", tja)
                    line = " ".join([i.decode("utf-8", errors="ignore") for i in inner])
                    if line.strip():
                        extracted_text_chunks.append(line)

        # 2. If streams didn't yield enough text, look for readable raw string literals
        if len(extracted_text_chunks) < 3:
            raw_tjs = re.findall(rb"\((.*?)\)\s*Tj", raw_bytes)
            for tj in raw_tjs:
                txt = tj.decode("utf-8", errors="ignore").strip()
                if len(txt) > 3 and txt not in extracted_text_chunks:
                    extracted_text_chunks.append(txt)

        if extracted_text_chunks:
            full_text = "\n".join(extracted_text_chunks)
            return full_text, {"page_text_chunks": len(extracted_text_chunks)}
        
        # Fallback to ASCII string extraction
        ascii_strings = re.findall(rb"[A-Za-z0-9,:\-\. \t/]{6,}", raw_bytes)
        fallback_text = "\n".join([s.decode("ascii", errors="ignore").strip() for s in ascii_strings if len(s.strip()) > 8])
        return fallback_text or raw_bytes.decode("utf-8", errors="replace"), {"mode": "ascii_fallback"}
    except Exception as exc:
        return raw_bytes.decode("utf-8", errors="replace"), {"error": str(exc)}


def parse_incoming_payload(
    filename: Optional[str],
    content_bytes: bytes,
    content_type: str = ""
) -> Tuple[str, str, Dict[str, Any]]:
    """
    Routes incoming file bytes to the appropriate format parser.
    Returns: (extracted_text, normalized_source_type, parser_metadata)
    """
    fname = (filename or "").lower()
    
    if fname.endswith(".eml") or "message/rfc822" in content_type:
        text, meta = parse_eml_content(content_bytes)
        return text, "EMAIL", meta
    elif fname.endswith(".csv") or "text/csv" in content_type:
        text, meta = parse_csv_content(content_bytes)
        return text, "CSV", meta
    elif fname.endswith(".pdf") or "application/pdf" in content_type:
        text, meta = parse_pdf_content(content_bytes)
        return text, "PDF", meta
    else:
        # Plain text / JSON / XML
        text = content_bytes.decode("utf-8", errors="replace")
        return text, "DOCUMENT", {"mode": "utf8_direct"}

