"""
tests/test_resume_parser.py

Tests for services/resume_parser.py covering:
  - _empty_resume            (pure function — shape check)
  - build_resume_context     (pure function — string building)
  - extract_text_from_pdf    (mocked PyMuPDF)
  - parse_resume             (mocked Groq + mocked PDF extraction)
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from services.resume_parser import (
    _empty_resume,
    build_resume_context,
    extract_text_from_pdf,
    parse_resume,
)


# ═══════════════════════════════════════════════════════════════════════════════
# _empty_resume — pure function
# ═══════════════════════════════════════════════════════════════════════════════

class TestEmptyResume:

    def test_returns_all_required_keys(self):
        """_empty_resume returns a dict with all expected keys."""
        result = _empty_resume()
        assert "name" in result
        assert "target_role" in result
        assert "years_experience" in result
        assert "skills" in result
        assert "technologies" in result
        assert "past_roles" in result
        assert "highlights" in result
        assert "education" in result

    def test_default_values_are_empty(self):
        """All fields are empty/zero by default."""
        result = _empty_resume()
        assert result["name"] == ""
        assert result["target_role"] == ""
        assert result["years_experience"] == 0
        assert result["skills"] == []
        assert result["technologies"] == []
        assert result["past_roles"] == []
        assert result["highlights"] == []
        assert result["education"] == ""

    def test_returns_new_dict_each_call(self):
        """Each call returns a fresh dict — no shared mutable state."""
        a = _empty_resume()
        b = _empty_resume()
        a["skills"].append("Python")
        assert b["skills"] == []


# ═══════════════════════════════════════════════════════════════════════════════
# build_resume_context — pure function
# ═══════════════════════════════════════════════════════════════════════════════

class TestBuildResumeContext:

    def test_empty_dict_returns_empty_string(self):
        """Empty resume data returns empty string."""
        assert build_resume_context({}) == ""

    def test_none_returns_empty_string(self):
        """None input returns empty string."""
        assert build_resume_context(None) == ""

    def test_all_empty_values_returns_empty_string(self):
        """Dict with all empty values returns empty string."""
        result = build_resume_context(_empty_resume())
        assert result == ""

    def test_includes_years_experience(self):
        """years_experience is included when present."""
        data = {**_empty_resume(), "years_experience": 3}
        context = build_resume_context(data)
        assert "3 years of experience" in context

    def test_includes_technologies(self):
        """Technologies are included when present."""
        data = {**_empty_resume(), "technologies": ["Python", "FastAPI", "MongoDB"]}
        context = build_resume_context(data)
        assert "Python" in context
        assert "FastAPI" in context

    def test_caps_technologies_at_8(self):
        """Only first 8 technologies are included."""
        techs = [f"tech{i}" for i in range(12)]
        data = {**_empty_resume(), "technologies": techs}
        context = build_resume_context(data)
        assert "tech8" not in context
        assert "tech7" in context

    def test_includes_past_roles(self):
        """Past roles are included when present."""
        data = {**_empty_resume(), "past_roles": ["Engineer at Google", "Intern at Meta"]}
        context = build_resume_context(data)
        assert "Engineer at Google" in context

    def test_caps_past_roles_at_3(self):
        """Only first 3 past roles are included."""
        roles = ["Role A", "Role B", "Role C", "Role D"]
        data = {**_empty_resume(), "past_roles": roles}
        context = build_resume_context(data)
        assert "Role D" not in context
        assert "Role C" in context

    def test_includes_first_highlight_only(self):
        """Only first highlight is included."""
        data = {**_empty_resume(), "highlights": ["Built payment system", "Led team of 5"]}
        context = build_resume_context(data)
        assert "Built payment system" in context
        assert "Led team of 5" not in context

    def test_parts_joined_with_pipe(self):
        """Context parts are joined with ' | '."""
        data = {
            **_empty_resume(),
            "years_experience": 2,
            "technologies": ["Python"],
        }
        context = build_resume_context(data)
        assert " | " in context

    def test_full_resume_builds_complete_context(self):
        """Full resume data produces a non-empty multi-part context."""
        data = {
            "name": "Jane Doe",
            "target_role": "Software Engineer",
            "years_experience": 4,
            "skills": ["problem solving"],
            "technologies": ["Python", "React", "PostgreSQL"],
            "past_roles": ["Engineer at Stripe", "Intern at Shopify"],
            "highlights": ["Built real-time payment processing system"],
            "education": "BSc Computer Science",
        }
        context = build_resume_context(data)
        assert "4 years of experience" in context
        assert "Python" in context
        assert "Engineer at Stripe" in context
        assert "Built real-time payment processing system" in context


# ═══════════════════════════════════════════════════════════════════════════════
# extract_text_from_pdf — mocked PyMuPDF
# ═══════════════════════════════════════════════════════════════════════════════

class TestExtractTextFromPdf:

    def test_extracts_text_from_pages(self):
        """Concatenates text from all pages and strips whitespace."""
        mock_page1 = MagicMock()
        mock_page1.get_text.return_value = "Page one content. "
        mock_page2 = MagicMock()
        mock_page2.get_text.return_value = "Page two content."

        mock_doc = MagicMock()
        mock_doc.__iter__ = MagicMock(return_value=iter([mock_page1, mock_page2]))

        with patch("services.resume_parser.fitz.open", return_value=mock_doc):
            result = extract_text_from_pdf(b"fake pdf bytes")

        assert "Page one content." in result
        assert "Page two content." in result
        mock_doc.close.assert_called_once()

    def test_returns_empty_string_on_exception(self):
        """Returns empty string when PyMuPDF raises an exception."""
        with patch("services.resume_parser.fitz.open", side_effect=Exception("corrupt PDF")):
            result = extract_text_from_pdf(b"bad bytes")

        assert result == ""

    def test_returns_stripped_text(self):
        """Strips leading/trailing whitespace from extracted text."""
        mock_page = MagicMock()
        mock_page.get_text.return_value = "  some text  "
        mock_doc = MagicMock()
        mock_doc.__iter__ = MagicMock(return_value=iter([mock_page]))

        with patch("services.resume_parser.fitz.open", return_value=mock_doc):
            result = extract_text_from_pdf(b"fake pdf")

        assert result == "some text"


# ═══════════════════════════════════════════════════════════════════════════════
# parse_resume — mocked Groq + PDF extraction
# ═══════════════════════════════════════════════════════════════════════════════

class TestParseResume:

    @pytest.mark.asyncio
    async def test_returns_empty_resume_when_pdf_extraction_fails(self):
        """Returns empty resume dict when no text can be extracted."""
        with patch("services.resume_parser.extract_text_from_pdf", return_value=""):
            result = await parse_resume(b"bad pdf")
        assert result == _empty_resume()

    @pytest.mark.asyncio
    async def test_returns_empty_resume_when_groq_returns_none(self):
        """Returns empty resume dict when Groq returns None."""
        with patch("services.resume_parser.extract_text_from_pdf", return_value="John Doe, Software Engineer"), \
             patch("services.resume_parser.ask_groq", new=AsyncMock(return_value=None)):
            result = await parse_resume(b"fake pdf")
        assert result == _empty_resume()

    @pytest.mark.asyncio
    async def test_parses_valid_json_response(self):
        """Returns parsed resume data from valid Groq JSON response."""
        fake_json = '''{
            "name": "John Doe",
            "target_role": "Software Engineer",
            "years_experience": 3,
            "skills": ["Python", "problem solving"],
            "technologies": ["FastAPI", "MongoDB"],
            "past_roles": ["Engineer at Acme"],
            "highlights": ["Built internal tooling"],
            "education": "BSc Computer Science"
        }'''

        with patch("services.resume_parser.extract_text_from_pdf", return_value="resume text"), \
             patch("services.resume_parser.ask_groq", new=AsyncMock(return_value=fake_json)):
            result = await parse_resume(b"fake pdf")

        assert result["name"] == "John Doe"
        assert result["target_role"] == "Software Engineer"
        assert result["years_experience"] == 3
        assert "Python" in result["skills"]

    @pytest.mark.asyncio
    async def test_handles_json_wrapped_in_markdown(self):
        """Handles JSON response wrapped in markdown code fences."""
        fake_response = '```json\n{"name": "Jane", "target_role": "Dev", "years_experience": 1, "skills": [], "technologies": [], "past_roles": [], "highlights": [], "education": ""}\n```'

        with patch("services.resume_parser.extract_text_from_pdf", return_value="resume text"), \
             patch("services.resume_parser.ask_groq", new=AsyncMock(return_value=fake_response)):
            result = await parse_resume(b"fake pdf")

        # Should still extract the JSON via regex
        assert result["name"] == "Jane"

    @pytest.mark.asyncio
    async def test_returns_empty_resume_on_invalid_json(self):
        """Returns empty resume dict when Groq response is not valid JSON."""
        with patch("services.resume_parser.extract_text_from_pdf", return_value="resume text"), \
             patch("services.resume_parser.ask_groq", new=AsyncMock(return_value="not valid json at all")):
            result = await parse_resume(b"fake pdf")
        assert result == _empty_resume()

    @pytest.mark.asyncio
    async def test_truncates_long_resume_text(self):
        """Long resume text is truncated to 3000 chars before sending to Groq."""
        long_text = "a" * 5000
        fake_json = '{"name": "", "target_role": "", "years_experience": 0, "skills": [], "technologies": [], "past_roles": [], "highlights": [], "education": ""}'

        with patch("services.resume_parser.extract_text_from_pdf", return_value=long_text), \
             patch("services.resume_parser.ask_groq", new=AsyncMock(return_value=fake_json)) as mock_ask:
            await parse_resume(b"fake pdf")

        prompt_sent = mock_ask.call_args.args[0]
        # The prompt contains the truncated text — verify full 5000 char text not present
        assert "a" * 3001 not in prompt_sent
