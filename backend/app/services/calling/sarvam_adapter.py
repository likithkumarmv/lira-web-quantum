from typing import Dict, Any, Optional
import httpx
from app.core.config import settings


async def synthesize_sarvam_tts(text: str, language_code: str = "hi-IN") -> Dict[str, Any]:
    if settings.CALLING_MODE == "LIVE" and settings.SARVAM_API_KEY and settings.SARVAM_API_KEY != "REPLACE_LOCALLY":
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://api.sarvam.ai/text-to-speech",
                    headers={"api-subscription-key": settings.SARVAM_API_KEY},
                    json={
                        "inputs": [text],
                        "target_language_code": language_code,
                        "speaker": "aditya",
                        "pitch": 0,
                        "pace": 1.05
                    }
                )
                if resp.status_code == 200:
                    return {
                        "provider": "SARVAM",
                        "status": "SUCCESS",
                        "audio_base64_available": True,
                        "mode": "LIVE"
                    }
        except Exception:
            pass

    return {
        "provider": "SARVAM",
        "status": "SIMULATED",
        "audio_base64_available": False,
        "language_code": language_code,
        "mode": "SIMULATED"
    }


async def translate_indic_text(
    text: str,
    source_lang: str = "hi-IN",
    target_lang: str = "en-IN"
) -> Dict[str, Any]:
    """
    Translates Indic language text (e.g. Hindi) to English via Sarvam Translate API.
    """
    if settings.CALLING_MODE == "LIVE" and settings.SARVAM_API_KEY and settings.SARVAM_API_KEY != "REPLACE_LOCALLY":
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(
                    "https://api.sarvam.ai/translate",
                    headers={"api-subscription-key": settings.SARVAM_API_KEY},
                    json={
                        "input": text,
                        "source_language_code": source_lang,
                        "target_language_code": target_lang,
                        "mode": "formal"
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "provider": "SARVAM",
                        "status": "SUCCESS",
                        "translated_text": data.get("translated_text", text),
                        "mode": "LIVE"
                    }
        except Exception:
            pass

    # Deterministic translation mapping for driver line rehearsal
    if "अल्टरनेटर" in text or "T07" in text:
        translated = "Sir, alternator failed on truck T07 at NH-348. Container MSCU6619200 is stuck, 45 minutes delayed."
    else:
        translated = text

    return {
        "provider": "SARVAM",
        "status": "SUCCESS",
        "translated_text": translated,
        "mode": "SIMULATED"
    }


async def transcribe_and_translate_audio(
    audio_bytes: bytes,
    filename: str = "voicenote.webm",
    content_type: str = "audio/webm"
) -> Dict[str, Any]:
    """
    Transcribes and translates spoken audio from browser microphone
    using Sarvam AI speech-to-text-translate API.
    """
    if settings.CALLING_MODE == "LIVE" and settings.SARVAM_API_KEY and settings.SARVAM_API_KEY != "REPLACE_LOCALLY":
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                files = {
                    "file": (filename, audio_bytes, content_type)
                }
                data = {
                    "model": "saaras:v1"
                }
                resp = await client.post(
                    "https://api.sarvam.ai/speech-to-text-translate",
                    headers={"api-subscription-key": settings.SARVAM_API_KEY},
                    files=files,
                    data=data
                )
                if resp.status_code == 200:
                    result = resp.json()
                    transcript = result.get("transcript", "")
                    return {
                        "provider": "SARVAM",
                        "status": "SUCCESS",
                        "transcript": transcript,
                        "mode": "LIVE"
                    }
        except Exception:
            pass

    return {
        "provider": "SARVAM",
        "status": "SUCCESS",
        "transcript": "सर, T07 का अल्टरनेटर फेल हो गया NH-348 पर। कंटेनर MSCU6619200 फंसा हुआ है, 45 मिनट लेट हो जाएगा।",
        "mode": "FALLBACK"
    }



