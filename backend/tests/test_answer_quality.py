"""
tests/test_answer_quality.py
Tests for _is_empty_answer_local (question_engine.py)
and _compute_communication_score (interview.py routers).

Run with: pytest tests/ -v
No external dependencies — pure function tests only.
"""

from services.question_engine import _is_empty_answer_local, _NON_ANSWER_EXACT
import sys
import os

# Ensure backend root is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ─────────────────────────────────────────────────────────────────────────────
# _is_empty_answer_local
# ─────────────────────────────────────────────────────────────────────────────

class TestIsEmptyAnswerLocal:

    # ── Empty / whitespace ──────────────────────────────────────────────────

    def test_empty_string(self):
        assert _is_empty_answer_local("") is True

    def test_whitespace_only(self):
        assert _is_empty_answer_local("   ") is True

    def test_newlines_only(self):
        assert _is_empty_answer_local("\n\n\t") is True

    # ── Exact non-answer strings ────────────────────────────────────────────

    def test_all_exact_non_answers(self):
        """Every string in _NON_ANSWER_EXACT must be caught."""
        for phrase in _NON_ANSWER_EXACT:
            assert _is_empty_answer_local(phrase) is True, \
                f"Expected '{phrase}' to be caught as empty answer"

    def test_exact_match_case_insensitive(self):
        assert _is_empty_answer_local("IDK") is True
        assert _is_empty_answer_local("No") is True
        assert _is_empty_answer_local("SKIP") is True
        assert _is_empty_answer_local("I Don't Know") is True
        assert _is_empty_answer_local("NOT SURE") is True

    def test_exact_match_with_surrounding_whitespace(self):
        assert _is_empty_answer_local("  no  ") is True
        assert _is_empty_answer_local("  idk  ") is True

    # ── Short answers without substance signals ─────────────────────────────

    def test_short_answer_no_substance(self):
        # Under 6 words, no substance signals
        assert _is_empty_answer_local("I have no clue") is True

    def test_single_word_non_answer(self):
        assert _is_empty_answer_local("maybe") is True

    def test_two_word_non_answer(self):
        assert _is_empty_answer_local("not applicable") is True

    def test_five_words_no_substance(self):
        # Exactly 5 words, no substance signals
        assert _is_empty_answer_local("I really do not know") is True

    # ── Short answers WITH substance signals ────────────────────────────────

    def test_short_with_lifo(self):
        assert _is_empty_answer_local("stack uses lifo order") is False

    def test_short_with_fifo(self):
        assert _is_empty_answer_local("queue uses fifo structure") is False

    def test_short_with_because(self):
        assert _is_empty_answer_local("it works because of recursion") is False

    def test_short_with_stack(self):
        assert _is_empty_answer_local("use a stack here") is False

    def test_short_with_queue(self):
        assert _is_empty_answer_local("queue is better here") is False

    def test_short_with_o_notation(self):
        assert _is_empty_answer_local("o(n) complexity here") is False

    def test_short_with_since(self):
        assert _is_empty_answer_local("yes since it is sorted") is False

    # ── Real answers that must NOT be caught ───────────────────────────────

    def test_normal_technical_answer(self):
        answer = (
            "A stack follows LIFO — last in, first out. "
            "You push elements on top and pop from the top. "
            "A queue follows FIFO — elements are added at the rear and removed from the front."
        )
        assert _is_empty_answer_local(answer) is False

    def test_short_but_valid_answer(self):
        # 6 words exactly — boundary case, no substance signal needed
        assert _is_empty_answer_local(
            "arrays store elements in contiguous memory") is False

    def test_behavioural_answer(self):
        answer = (
            "In my previous role I had a conflict with a teammate about code review standards. "
            "I suggested we hold a team meeting to establish shared guidelines."
        )
        assert _is_empty_answer_local(answer) is False

    def test_vague_but_long_enough(self):
        # Vague but has enough words — should NOT be caught by local check
        # (LLM check handles this case)
        assert _is_empty_answer_local(
            "I think it depends on the situation and context") is False

    def test_answer_starting_with_no(self):
        # "no" as standalone is caught, but "no, " + content is not
        assert _is_empty_answer_local(
            "no, a queue uses FIFO not LIFO") is False

    # ── Edge cases ──────────────────────────────────────────────────────────

    def test_number_only(self):
        assert _is_empty_answer_local("42") is True

    def test_punctuation_only(self):
        assert _is_empty_answer_local("...") is True

    def test_very_long_answer_not_caught(self):
        answer = " ".join(["word"] * 100)
        assert _is_empty_answer_local(answer) is False

    def test_non_answer_with_trailing_punctuation(self):
        # "idk." — strip should handle this via .lower() but punctuation stays
        # "idk." is NOT in _NON_ANSWER_EXACT so falls to word count check
        # 1 word, no substance signal → True
        assert _is_empty_answer_local("idk.") is True


# ─────────────────────────────────────────────────────────────────────────────
# _compute_communication_score
# Imported from routers.interview to avoid circular imports
# ─────────────────────────────────────────────────────────────────────────────

# Import the function directly — it's a module-level helper, not a route
from routers.interview import _compute_communication_score  # noqa: E402


class TestComputeCommunicationScore:

    def _answer(
        self,
        wpm=140, ttr=0.6, hedging=0.1,
        fillers=None, word_count=60, avg_sentence_len=12.0
    ) -> dict:
        """Build a sample answer dict with sensible defaults."""
        return {
            "wpm":              wpm,
            "ttr":              ttr,
            "hedging_ratio":    hedging,
            "filler_words":     fillers or [],
            "word_count":       word_count,
            "avg_sentence_len": avg_sentence_len,
        }

    # ── Returns None for insufficient data ─────────────────────────────────

    def test_returns_none_for_zero_wpm(self):
        assert _compute_communication_score(self._answer(wpm=0)) is None

    def test_returns_none_for_low_word_count(self):
        assert _compute_communication_score(
            self._answer(word_count=19)) is None

    def test_returns_none_for_word_count_exactly_19(self):
        assert _compute_communication_score(
            self._answer(word_count=19)) is None

    def test_returns_float_for_word_count_20(self):
        result = _compute_communication_score(self._answer(word_count=20))
        assert result is not None
        assert isinstance(result, float)

    # ── Output range ────────────────────────────────────────────────────────

    def test_score_always_between_0_and_100(self):
        extreme_cases = [
            self._answer(wpm=30, ttr=0.1, hedging=1.0, fillers=[
                         "um"]*20, avg_sentence_len=2),
            self._answer(wpm=250, ttr=0.9, hedging=0.0,
                         fillers=[], avg_sentence_len=25),
            self._answer(wpm=140, ttr=0.6, hedging=0.1,
                         fillers=[], avg_sentence_len=12),
        ]
        for ans in extreme_cases:
            score = _compute_communication_score(ans)
            if score is not None:
                assert 0.0 <= score <= 100.0

    # ── WPM scoring ─────────────────────────────────────────────────────────

    def test_ideal_wpm_no_penalty(self):
        # 110–170 WPM is ideal — no WPM penalty applied
        base = _compute_communication_score(self._answer(wpm=140))
        slow = _compute_communication_score(self._answer(wpm=70))
        assert base > slow

    def test_very_slow_wpm_penalised(self):
        base = _compute_communication_score(self._answer(wpm=140))
        slow = _compute_communication_score(self._answer(wpm=70))
        assert base - slow >= 15

    def test_slow_wpm_small_penalty(self):
        ideal = _compute_communication_score(self._answer(wpm=140))
        slow = _compute_communication_score(self._answer(wpm=95))
        assert ideal - slow >= 5

    def test_very_fast_wpm_penalised(self):
        ideal = _compute_communication_score(self._answer(wpm=140))
        fast = _compute_communication_score(self._answer(wpm=210))
        assert ideal - fast >= 10

    def test_slightly_fast_wpm_small_penalty(self):
        ideal = _compute_communication_score(self._answer(wpm=140))
        fast = _compute_communication_score(self._answer(wpm=185))
        assert fast >= ideal  # 180-200 is minor — no penalty at this threshold

    # ── TTR scoring ─────────────────────────────────────────────────────────

    def test_high_ttr_gives_bonus(self):
        # ttr bonus (+5) is capped at 100 when base is already 100
        # Verify bonus shows when other penalties exist
        rich = _compute_communication_score(self._answer(ttr=0.70, wpm=95))
        avg = _compute_communication_score(self._answer(ttr=0.55, wpm=95))
        assert rich > avg

    def test_low_ttr_penalised(self):
        rich = _compute_communication_score(self._answer(ttr=0.70))
        poor = _compute_communication_score(self._answer(ttr=0.30))
        assert rich - poor >= 15

    def test_medium_ttr_moderate_penalty(self):
        rich = _compute_communication_score(self._answer(ttr=0.70))
        medium = _compute_communication_score(self._answer(ttr=0.45))
        assert rich - medium >= 5

    # ── Hedging scoring ──────────────────────────────────────────────────────

    def test_no_hedging_no_penalty(self):
        confident = _compute_communication_score(self._answer(hedging=0.0))
        hedgy = _compute_communication_score(self._answer(hedging=0.6))
        assert confident > hedgy

    def test_high_hedging_large_penalty(self):
        confident = _compute_communication_score(self._answer(hedging=0.0))
        hedgy = _compute_communication_score(self._answer(hedging=0.6))
        assert confident - hedgy >= 15

    def test_medium_hedging_moderate_penalty(self):
        confident = _compute_communication_score(self._answer(hedging=0.0))
        medium = _compute_communication_score(self._answer(hedging=0.35))
        assert confident - medium >= 5

    def test_slight_hedging_small_penalty(self):
        # hedging=0.2 incurs -5 but sent_len bonus can offset it
        # test with no sentence bonus to isolate hedging penalty
        confident = _compute_communication_score(
            self._answer(hedging=0.0, avg_sentence_len=7.0))
        slight = _compute_communication_score(
            self._answer(hedging=0.2, avg_sentence_len=7.0))
        assert confident - slight >= 5

    # ── Filler word scoring ──────────────────────────────────────────────────

    def test_no_fillers_no_penalty(self):
        clean = _compute_communication_score(
            self._answer(fillers=[], word_count=60))
        filled = _compute_communication_score(
            self._answer(fillers=["um"]*15, word_count=60))
        assert clean > filled

    def test_many_fillers_large_penalty(self):
        clean = _compute_communication_score(
            self._answer(fillers=[], word_count=60))
        filled = _compute_communication_score(
            self._answer(fillers=["um"]*15, word_count=60))
        assert clean - filled >= 10

    def test_moderate_fillers_small_penalty(self):
        clean = _compute_communication_score(
            self._answer(fillers=[], word_count=60))
        moderate = _compute_communication_score(
            self._answer(fillers=["um"]*7, word_count=60))
        assert clean - moderate >= 2

    # ── Sentence length scoring ──────────────────────────────────────────────

    def test_good_sentence_length_bonus(self):
        good = _compute_communication_score(
            self._answer(avg_sentence_len=12.0))
        short = _compute_communication_score(
            self._answer(avg_sentence_len=3.0))
        assert good > short

    def test_very_short_sentences_penalised(self):
        good = _compute_communication_score(
            self._answer(avg_sentence_len=12.0))
        short = _compute_communication_score(
            self._answer(avg_sentence_len=3.0))
        assert good - short >= 10  # -10 penalty for short sentences

    def test_sentence_length_at_boundary(self):
        # avg_sentence_len=5 is exactly the threshold — no penalty
        result = _compute_communication_score(
            self._answer(avg_sentence_len=5.0))
        assert result is not None

    # ── Perfect answer ───────────────────────────────────────────────────────

    def test_perfect_inputs_give_high_score(self):
        # All signals ideal — score is capped at 100 even with bonuses
        perfect = _compute_communication_score(
            self._answer(wpm=140, ttr=0.70, hedging=0.0,
                         fillers=[], avg_sentence_len=12.0)
        )
        assert perfect == 100.0

    def test_worst_inputs_give_low_score(self):
        worst = _compute_communication_score(self._answer(
            wpm=50, ttr=0.2, hedging=0.8,
            fillers=["um"]*20, word_count=60, avg_sentence_len=2.0
        ))
        assert worst <= 25

    # ── Cumulative penalties ─────────────────────────────────────────────────

    def test_multiple_penalties_stack(self):
        good = _compute_communication_score(
            self._answer(wpm=140, ttr=0.65, hedging=0.0, fillers=[])
        )
        bad = _compute_communication_score(
            self._answer(wpm=70, ttr=0.3, hedging=0.6, fillers=["um"]*15)
        )
        assert good - bad >= 50
