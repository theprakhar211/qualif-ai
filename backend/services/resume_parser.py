import fitz  # PyMuPDF
import json
import re
from loguru import logger
from services.groq_service import ask_groq


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract raw text from PDF bytes using PyMuPDF."""
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text.strip()
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        return ""


async def parse_resume(pdf_bytes: bytes) -> dict:
    """
    Extract text from PDF and use Groq to parse it into structured data.
    Returns a dict with role, skills, experience, projects.
    """
    raw_text = extract_text_from_pdf(pdf_bytes)

    if not raw_text:
        return _empty_resume()

    # Truncate to avoid token limits — resumes rarely need more than 3000 chars
    truncated = raw_text[:3000]

    prompt = f"""Extract structured information from this resume text.

Resume:
{truncated}

Respond with ONLY a JSON object in this exact format:
{{
  "name": "<candidate name or empty string>",
  "target_role": "<most relevant job title based on experience>",
  "years_experience": <integer, 0 if unknown>,
  "skills": ["<skill1>", "<skill2>", "<skill3>"],
  "technologies": ["<tech1>", "<tech2>", "<tech3>"],
  "past_roles": ["<role at company>", "<role at company>"],
  "highlights": ["<key achievement or project>", "<key achievement or project>"],
  "education": "<highest degree and field or empty string>"
}}

Rules:
- skills: technical and soft skills, max 15
- technologies: specific tools, frameworks, languages, max 15
- past_roles: format as "Role at Company", max 5
- highlights: notable projects or achievements, max 5
- Return ONLY the JSON, no explanation"""

    result = await ask_groq(prompt, temperature=0.1, max_tokens=1024)

    if not result:
        logger.warning("Groq failed to parse resume — returning empty")
        return _empty_resume()

    try:
        json_match = re.search(r'\{.*\}', result, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group())
            logger.info(
                f"Resume parsed — role: {parsed.get('target_role')}, skills: {len(parsed.get('skills', []))}")
            return parsed
    except Exception as e:
        logger.error(f"Failed to parse resume JSON: {e}")

    return _empty_resume()


def _empty_resume() -> dict:
    return {
        "name":             "",
        "target_role":      "",
        "years_experience": 0,
        "skills":           [],
        "technologies":     [],
        "past_roles":       [],
        "highlights":       [],
        "education":        ""
    }


def build_resume_context(resume_data: dict) -> str:
    """
    Build a concise context string to inject into question prompts.
    """
    if not resume_data or not any(resume_data.values()):
        return ""

    parts = []

    if resume_data.get("years_experience"):
        parts.append(f"{resume_data['years_experience']} years of experience")

    if resume_data.get("technologies"):
        techs = ", ".join(resume_data["technologies"][:8])
        parts.append(f"works with {techs}")

    if resume_data.get("past_roles"):
        roles = ", ".join(resume_data["past_roles"][:3])
        parts.append(f"previously: {roles}")

    if resume_data.get("highlights"):
        highlight = resume_data["highlights"][0]
        parts.append(f"notable work: {highlight}")

    return " | ".join(parts)
