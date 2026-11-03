"""
Tests for difficulty handling and scoring calibration:
- cap_difficulty / DIFFICULTY_GUIDE (services/question_engine.py)
- generate_question_adaptive never exceeds the user's chosen difficulty
- the LLM scoring and ideal-answer prompts contain the calibration rules
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.answer_benchmark import IDEAL_ANSWER_PROMPT
from services.groq_service import batch_evaluate
from services.question_engine import (
    DIFFICULTY_GUIDE,
    cap_difficulty,
    generate_question,
    generate_question_adaptive,
)


class TestCapDifficulty:

    @pytest.mark.parametrize("inferred,ceiling,expected", [
        ("hard", "easy", "easy"),
        ("medium", "easy", "easy"),
        ("hard", "medium", "medium"),
        ("easy", "hard", "easy"),
        ("medium", "medium", "medium"),
        ("easy", "easy", "easy"),
    ])
    def test_never_exceeds_ceiling(self, inferred, ceiling, expected):
        assert cap_difficulty(inferred, ceiling) == expected

    def test_unknown_values_do_not_crash(self):
        assert cap_difficulty("weird", "medium") == "weird"


class TestDifficultyGuide:

    def test_all_levels_defined(self):
        assert set(DIFFICULTY_GUIDE) == {"easy", "medium", "hard"}

    def test_easy_is_about_fundamentals(self):
        assert "fundamentals" in DIFFICULTY_GUIDE["easy"].lower()

    @pytest.mark.asyncio
    async def test_prompt_includes_the_guide_for_the_level(self):
        mock = AsyncMock(return_value="What is a stack and when would you use one?")
        with patch("services.question_engine.ask_groq", new=mock):
            await generate_question("Software Engineer", "Data Structures", "easy")
        prompt = mock.call_args.args[0]
        assert "DIFFICULTY GUIDE (easy)" in prompt
        assert DIFFICULTY_GUIDE["easy"] in prompt
        assert "research-level" in prompt


class TestAdaptiveRespectsChosenDifficulty:

    @pytest.mark.asyncio
    async def test_high_mastery_does_not_push_easy_to_hard(self):
        graph = MagicMock()
        graph.get_target_skill.return_value = "Graphs"
        graph.mastery_for.return_value = 90  # would infer "hard"
        gen = AsyncMock(return_value="What is a graph?")
        with patch("services.skill_graph.load_skill_graph", new=AsyncMock(return_value=graph)), \
             patch("services.question_engine.generate_question", new=gen):
            _, topic = await generate_question_adaptive(
                "Software Engineer", "Data Structures", "easy",
                user_id="u1", session_skills_covered=[])
        assert topic == "Graphs"
        assert gen.call_args.kwargs["difficulty"] == "easy"

    @pytest.mark.asyncio
    async def test_low_mastery_can_still_lower_difficulty(self):
        graph = MagicMock()
        graph.get_target_skill.return_value = "Graphs"
        graph.mastery_for.return_value = 10  # infers "easy"
        gen = AsyncMock(return_value="What is a graph?")
        with patch("services.skill_graph.load_skill_graph", new=AsyncMock(return_value=graph)), \
             patch("services.question_engine.generate_question", new=gen):
            await generate_question_adaptive(
                "Software Engineer", "Data Structures", "hard",
                user_id="u1", session_skills_covered=[])
        assert gen.call_args.kwargs["difficulty"] == "easy"


class TestScoringCalibration:

    @pytest.mark.asyncio
    async def test_scoring_prompt_is_scope_aware_and_fair(self):
        mock = AsyncMock(return_value=None)
        answers = [{"transcript": "A stack is LIFO.", "phase": "technical",
                    "input_mode": "voice", "question_text": "What is a stack?"}]
        with patch("services.groq_service.ask_groq", new=mock):
            await batch_evaluate("Software Engineer", answers)
        prompt = mock.call_args_list[0].args[0]
        assert "Do not deduct points for advanced, optional or research-level" in prompt
        assert "Be fair but not generous" in prompt
        assert "Be strict overall" not in prompt

    def test_ideal_answer_prompt_limits_concepts(self):
        assert "4 to 6 core concepts" in IDEAL_ANSWER_PROMPT
        assert "research-level" in IDEAL_ANSWER_PROMPT
