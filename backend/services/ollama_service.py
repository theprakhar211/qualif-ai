import httpx
from loguru import logger
from config import settings

TIMEOUT = 30.0


async def ask_ollama(prompt: str, system: str = "") -> str | None:
    try:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.post(
                f"{settings.OLLAMA_URL}/api/chat",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "messages": messages,
                    "stream": False
                }
            )
            response.raise_for_status()
            return response.json()["message"]["content"].strip()

    except httpx.TimeoutException:
        logger.warning("Ollama timed out.")
        return None
    except Exception as e:
        logger.error(f"Ollama error: {e}")
        return None


async def clean_transcript(raw: str, context: str = "") -> str:
    prompt = f"""The following text was transcribed by speech recognition and may contain errors.
Common errors: technical terms mangled, words merged, punctuation missing.
Context (interview topic): {context}

Raw transcript: {raw}

Fix ONLY clear speech recognition errors. Do not change the meaning or add information.
Return ONLY the corrected text, nothing else."""

    cleaned = await ask_ollama(prompt)
    return cleaned if cleaned else raw
