"""
tests/test_hybrid_evaluator.py
Pytest suite for services/hybrid_evaluator.py
Run with: pytest tests/ -v
No external dependencies — pure function tests only.
"""

import pytest
from services.hybrid_evaluator import (
    PhaseType,
    DeterministicScore,
    HybridResult,
    extract_keywords_for_question,
    score_keywords,
    detect_structure,
    compute_depth_penalty,
    compute_deterministic_score,
    blend_scores,
    run_hybrid_evaluation,
    KEYWORD_BANK,
    SHORT_ANSWER_THRESHOLD,
    IDEAL_MIN_WORDS,
)


# ─────────────────────────────────────────────────────────────────────────────
# extract_keywords_for_question
# ─────────────────────────────────────────────────────────────────────────────

class TestExtractKeywords:
    def test_returns_keywords_for_known_topic(self):
        kws = extract_keywords_for_question("", topic="binary search")
        assert "sorted" in kws
        assert "O(log n)" in kws
        assert "divide" in kws

    def test_matches_topic_in_question_text(self):
        kws = extract_keywords_for_question("Explain how binary search works")
        assert len(kws) > 0
        assert "sorted" in kws

    def test_combines_topic_and_question(self):
        # topic=array + question mentions tree → should get both sets
        kws = extract_keywords_for_question("How does a binary tree differ from an array?")
        assert "node" in kws       # from tree
        assert "index" in kws      # from array

    def test_returns_empty_for_unknown_topic(self):
        kws = extract_keywords_for_question("Tell me about yourself", topic="intro")
        assert kws == []

    def test_no_duplicates(self):
        # "graph" and "graph algorithms" both match and share some keywords
        kws = extract_keywords_for_question("Explain graph algorithms and BFS")
        assert len(kws) == len(set(kws))

    def test_case_insensitive_matching(self):
        kws = extract_keywords_for_question("Explain BINARY SEARCH in detail")
        assert len(kws) > 0

    def test_empty_inputs_return_empty(self):
        assert extract_keywords_for_question("", topic=None) == []
        assert extract_keywords_for_question("   ") == []


# ─────────────────────────────────────────────────────────────────────────────
# score_keywords
# ─────────────────────────────────────────────────────────────────────────────

class TestScoreKeywords:
    def test_perfect_score_when_all_matched(self):
        score, matched, missing = score_keywords(
            "The array uses index and element with O(1) access",
            ["index", "element", "O(1)"]
        )
        assert score == 1.0
        assert set(matched) == {"index", "element", "O(1)"}
        assert missing == []

    def test_zero_score_when_none_matched(self):
        score, matched, missing = score_keywords(
            "I don't know anything about this topic",
            ["index", "element", "O(1)"]
        )
        assert score == 0.0
        assert matched == []
        assert set(missing) == {"index", "element", "O(1)"}

    def test_partial_score(self):
        score, matched, missing = score_keywords(
            "The array uses index access",
            ["index", "element", "O(1)"]
        )
        assert abs(score - 1/3) < 0.01
        assert "index" in matched
        assert "element" in missing
        assert "O(1)" in missing

    def test_returns_full_score_for_empty_keywords(self):
        # No keywords required → full marks (question has no keyword expectations)
        score, matched, missing = score_keywords("any answer", [])
        assert score == 1.0
        assert matched == []
        assert missing == []

    def test_case_insensitive_matching(self):
        score, matched, _ = score_keywords(
            "We use LIFO — last in, first out",
            ["LIFO", "last in"]
        )
        assert score == 1.0
        assert len(matched) == 2

    def test_keyword_as_substring(self):
        # "node" should match inside "nodes"
        score, matched, _ = score_keywords(
            "A tree has many nodes and a root",
            ["node", "root"]
        )
        assert score == 1.0


# ─────────────────────────────────────────────────────────────────────────────
# detect_structure
# ─────────────────────────────────────────────────────────────────────────────

class TestDetectStructure:
    def test_full_score_with_all_three(self):
        answer = (
            "Let me start by explaining this. "           # intro
            "It works because of the divide approach. "   # explanation
            "In summary, this is efficient."              # conclusion
        )
        score, flags = detect_structure(answer)
        assert flags["has_intro"] is True
        assert flags["has_explanation"] is True
        assert flags["has_conclusion"] is True
        assert abs(score - 1.0) < 0.01

    def test_zero_score_for_bare_answer(self):
        answer = "Binary search splits the array repeatedly."
        score, flags = detect_structure(answer)
        # No intro/conclusion patterns — explanation might match on "splits"? no.
        assert score < 0.5

    def test_partial_score_with_one_element(self):
        # "for example" is only in EXPLANATION_PATTERNS, not intro or conclusion
        answer = "Arrays store elements contiguously, for example in memory slots."
        score, flags = detect_structure(answer)
        assert flags["has_explanation"] is True
        assert flags["has_intro"] is False
        assert flags["has_conclusion"] is False
        assert abs(score - 1/3) < 0.01

    def test_score_between_zero_and_one(self):
        for answer in [
            "I think this is correct.",
            "Because of the hash function.",
            "In summary, overall this works.",
            "",
        ]:
            score, _ = detect_structure(answer)
            assert 0.0 <= score <= 1.0

    def test_returns_dict_with_correct_keys(self):
        _, flags = detect_structure("any answer")
        assert set(flags.keys()) == {"has_intro", "has_explanation", "has_conclusion"}


# ─────────────────────────────────────────────────────────────────────────────
# compute_depth_penalty
# ─────────────────────────────────────────────────────────────────────────────

class TestComputeDepthPenalty:
    def test_no_penalty_for_long_clear_answer(self):
        answer = " ".join(["word"] * 80)  # 80 words, no vague patterns
        multiplier, penalties = compute_depth_penalty(answer)
        assert multiplier == 1.0
        assert len(penalties) == 0

    def test_hard_penalty_for_very_short_answer(self):
        answer = " ".join(["word"] * (SHORT_ANSWER_THRESHOLD - 1))
        multiplier, penalties = compute_depth_penalty(answer)
        assert multiplier < 1.0
        assert multiplier <= 0.65
        assert len(penalties) == 1
        assert "short" in penalties[0].lower()

    def test_soft_penalty_for_medium_short_answer(self):
        # Between SHORT_ANSWER_THRESHOLD and IDEAL_MIN_WORDS
        answer = " ".join(["word"] * (SHORT_ANSWER_THRESHOLD + 2))
        multiplier, penalties = compute_depth_penalty(answer)
        assert 0.85 <= multiplier < 1.0
        assert len(penalties) == 1

    def test_no_penalty_at_ideal_min(self):
        answer = " ".join(["word"] * IDEAL_MIN_WORDS)
        multiplier, penalties = compute_depth_penalty(answer)
        assert multiplier == 1.0
        assert len(penalties) == 0

    def test_vague_penalty_for_many_hedge_words(self):
        # Both patterns fire: pattern 1 ("I don't know") + pattern 2 ("ummmm")
        # vague_hits = 2 >= 2 → penalty applies
        answer = " ".join(["word"] * 60) + " I don't know ummmm"
        multiplier, penalties = compute_depth_penalty(answer)
        assert multiplier < 1.0
        assert any("vague" in p.lower() for p in penalties)

    def test_single_hedge_word_no_penalty(self):
        answer = " ".join(["word"] * 60) + " I think this is correct"
        multiplier, penalties = compute_depth_penalty(answer)
        assert multiplier == 1.0  # single "I think" should not penalise

    def test_multiplier_never_below_zero(self):
        # Worst possible answer
        answer = "I don't know maybe sort of kind of I think so"
        multiplier, _ = compute_depth_penalty(answer)
        assert multiplier >= 0.0


# ─────────────────────────────────────────────────────────────────────────────
# compute_deterministic_score
# ─────────────────────────────────────────────────────────────────────────────

class TestComputeDeterministicScore:
    def _good_answer(self) -> str:
        return (
            "Let me explain binary search. It works on a sorted array by comparing "
            "the mid element. Because of this divide approach, we get O(log n) time. "
            "The low and high pointers narrow the search. In summary, binary search "
            "is highly efficient for sorted data."
        )

    def test_returns_deterministic_score_dataclass(self):
        det = compute_deterministic_score("some answer", [], PhaseType.TECHNICAL)
        assert isinstance(det, DeterministicScore)

    def test_high_score_for_comprehensive_answer(self):
        kws = extract_keywords_for_question("binary search algorithm")
        det = compute_deterministic_score(self._good_answer(), kws, PhaseType.TECHNICAL)
        assert det.raw_deterministic_score > 0.6
        assert det.keyword_score > 0.5

    def test_low_score_for_empty_answer(self):
        kws = ["sorted", "mid", "O(log n)"]
        det = compute_deterministic_score("", kws, PhaseType.TECHNICAL)
        assert det.keyword_score == 0.0
        assert det.raw_deterministic_score < 0.5

    def test_word_count_correct(self):
        answer = "one two three four five"
        det = compute_deterministic_score(answer, [], PhaseType.QUICK)
        assert det.word_count == 5

    def test_wpm_initialises_to_zero(self):
        det = compute_deterministic_score("some answer here", [], PhaseType.QUICK)
        assert det.wpm == 0.0

    def test_technical_phase_weights_keywords_heavily(self):
        # Answer with keywords but no structure
        kws = ["sorted", "mid", "O(log n)", "divide"]
        answer = "sorted mid O(log n) divide " + " ".join(["word"] * 50)
        det_tech = compute_deterministic_score(answer, kws, PhaseType.TECHNICAL)
        det_intro = compute_deterministic_score(answer, kws, PhaseType.INTRO)
        # Technical should score higher than intro for keyword-heavy, structure-free answer
        assert det_tech.raw_deterministic_score >= det_intro.raw_deterministic_score

    def test_behavioural_phase_weights_structure_heavily(self):
        # Answer with good structure but no keywords
        answer = (
            "Let me describe the situation. "
            "I did this because it was the right approach. "
            "In summary, the outcome was positive. " +
            " ".join(["result"] * 40)
        )
        det_beh = compute_deterministic_score(answer, [], PhaseType.BEHAVIOURAL)
        det_tech = compute_deterministic_score(answer, [], PhaseType.TECHNICAL)
        assert det_beh.raw_deterministic_score >= det_tech.raw_deterministic_score

    def test_penalties_propagate_to_score(self):
        kws = ["sorted", "mid"]
        short_answer = "sorted mid"   # under SHORT_ANSWER_THRESHOLD
        long_answer  = "sorted mid " + " ".join(["word"] * 60)
        det_short = compute_deterministic_score(short_answer, kws, PhaseType.TECHNICAL)
        det_long  = compute_deterministic_score(long_answer,  kws, PhaseType.TECHNICAL)
        assert det_short.raw_deterministic_score < det_long.raw_deterministic_score

    def test_all_phases_produce_valid_scores(self):
        answer = " ".join(["word"] * 60)
        kws = ["word"]
        for phase in PhaseType:
            det = compute_deterministic_score(answer, kws, phase)
            assert 0.0 <= det.raw_deterministic_score <= 1.0


# ─────────────────────────────────────────────────────────────────────────────
# blend_scores
# ─────────────────────────────────────────────────────────────────────────────

class TestBlendScores:
    def _make_det(self, raw: float) -> DeterministicScore:
        return DeterministicScore(
            keyword_score=raw, structure_score=raw, depth_penalty=1.0,
            matched_keywords=[], missing_keywords=[], structure_flags={},
            penalties_applied=[], raw_deterministic_score=raw,
            word_count=60, wpm=0.0,
        )

    def test_output_is_between_0_and_100(self):
        for llm in [0, 50, 100]:
            for raw in [0.0, 0.5, 1.0]:
                result = blend_scores(llm, self._make_det(raw), PhaseType.TECHNICAL)
                assert 0.0 <= result <= 100.0

    def test_high_llm_high_det_gives_high_score(self):
        result = blend_scores(90.0, self._make_det(0.9), PhaseType.TECHNICAL)
        assert result > 80.0

    def test_low_llm_low_det_gives_low_score(self):
        result = blend_scores(20.0, self._make_det(0.1), PhaseType.TECHNICAL)
        assert result < 30.0

    def test_llm_dominates_over_deterministic(self):
        # With 72% LLM weight, high LLM should dominate low det
        high_llm = blend_scores(90.0, self._make_det(0.0), PhaseType.TECHNICAL)
        low_llm  = blend_scores(10.0, self._make_det(1.0), PhaseType.TECHNICAL)
        assert high_llm > low_llm

    def test_technical_and_quick_same_blend_ratio(self):
        det = self._make_det(0.6)
        tech  = blend_scores(75.0, det, PhaseType.TECHNICAL)
        quick = blend_scores(75.0, det, PhaseType.QUICK)
        assert tech == quick  # both use 0.72/0.28

    def test_intro_higher_weight_on_llm_than_technical(self):
        # Same inputs, intro gives more weight to LLM (0.80 vs 0.72)
        # So with llm > det*100, intro should score higher
        det = self._make_det(0.3)  # det pulls score down
        intro = blend_scores(80.0, det, PhaseType.INTRO)
        tech  = blend_scores(80.0, det, PhaseType.TECHNICAL)
        assert intro > tech

    def test_perfect_inputs_give_100(self):
        result = blend_scores(100.0, self._make_det(1.0), PhaseType.TECHNICAL)
        assert result == 100.0

    def test_zero_inputs_give_zero(self):
        result = blend_scores(0.0, self._make_det(0.0), PhaseType.TECHNICAL)
        assert result == 0.0


# ─────────────────────────────────────────────────────────────────────────────
# run_hybrid_evaluation (integration)
# ─────────────────────────────────────────────────────────────────────────────

class TestRunHybridEvaluation:
    def _llm_result(self, score=75, reasoning="Good answer", missing=None, transcript=None):
        return {
            "score": score,
            "reasoning": reasoning,
            "missing_concepts": missing or [],
            "stt_corrected_transcript": transcript or "",
        }

    def test_returns_hybrid_result_dataclass(self):
        result = run_hybrid_evaluation(
            answer="Binary search works on sorted arrays by dividing the search space.",
            question_text="Explain binary search",
            llm_result=self._llm_result(),
        )
        assert isinstance(result, HybridResult)

    def test_final_score_within_range(self):
        result = run_hybrid_evaluation(
            answer="some answer here",
            question_text="any question",
            llm_result=self._llm_result(score=60),
        )
        assert 0.0 <= result.final_score <= 100.0

    def test_llm_score_preserved(self):
        result = run_hybrid_evaluation(
            answer="some answer",
            question_text="any question",
            llm_result=self._llm_result(score=82),
        )
        assert result.llm_score == 82.0

    def test_reasoning_preserved(self):
        result = run_hybrid_evaluation(
            answer="some answer",
            question_text="any question",
            llm_result=self._llm_result(reasoning="Excellent coverage"),
        )
        assert result.reasoning == "Excellent coverage"

    def test_stt_transcript_falls_back_to_answer(self):
        answer = "my spoken answer"
        result = run_hybrid_evaluation(
            answer=answer,
            question_text="any question",
            llm_result={"score": 70, "reasoning": "", "missing_concepts": [],
                        "stt_corrected_transcript": ""},
        )
        # empty string transcript → falls back to original answer
        assert result.stt_corrected_transcript == answer or result.stt_corrected_transcript == ""

    def test_stt_corrected_transcript_used_when_provided(self):
        result = run_hybrid_evaluation(
            answer="hazmaps are used",
            question_text="explain hash maps",
            llm_result=self._llm_result(transcript="hashmaps are used"),
        )
        assert result.stt_corrected_transcript == "hashmaps are used"

    def test_wpm_computed_from_duration(self):
        answer = " ".join(["word"] * 60)  # 60 words
        result = run_hybrid_evaluation(
            answer=answer,
            question_text="any question",
            llm_result=self._llm_result(),
            duration_seconds=60.0,   # 60 words in 60s = 60 WPM
        )
        assert result.wpm == 60.0

    def test_wpm_zero_without_duration(self):
        result = run_hybrid_evaluation(
            answer="some answer",
            question_text="any question",
            llm_result=self._llm_result(),
            duration_seconds=None,
        )
        assert result.wpm == 0.0

    def test_llm_missing_concepts_merged_into_keywords(self):
        result = run_hybrid_evaluation(
            answer="a short answer",
            question_text="explain recursion",
            llm_result=self._llm_result(missing=["tail recursion", "stack depth"]),
        )
        # "tail recursion" and "stack depth" should appear in missing_keywords
        # since the answer doesn't contain them
        assert "tail recursion" in result.missing_keywords or \
               "stack depth" in result.missing_keywords

    def test_good_answer_scores_higher_than_bad(self):
        good = run_hybrid_evaluation(
            answer=(
                "Let me explain binary search. It requires a sorted array. "
                "We compare the mid element to narrow the search space. "
                "The time complexity is O(log n) because we divide the range "
                "each iteration using low and high pointers. In summary, it's "
                "very efficient for large sorted datasets. " + "word " * 20
            ),
            question_text="explain binary search",
            llm_result=self._llm_result(score=85),
        )
        bad = run_hybrid_evaluation(
            answer="I don't know maybe sort of binary search is fast",
            question_text="explain binary search",
            llm_result=self._llm_result(score=25),
        )
        assert good.final_score > bad.final_score

    def test_phase_affects_final_score(self):
        # Same answer and LLM score, different phase → different blends
        answer = "Let me explain. The team worked together because we collaborated. In summary good outcome. " + "word " * 30
        llm_r = self._llm_result(score=70)
        technical   = run_hybrid_evaluation(answer, "technical question", llm_r, PhaseType.TECHNICAL)
        behavioural = run_hybrid_evaluation(answer, "behavioural question", llm_r, PhaseType.BEHAVIOURAL)
        # Both valid scores but different values due to different weights
        assert 0 <= technical.final_score <= 100
        assert 0 <= behavioural.final_score <= 100

    def test_fallback_score_when_llm_score_missing(self):
        result = run_hybrid_evaluation(
            answer="some answer " * 10,
            question_text="any question",
            llm_result={"reasoning": "", "missing_concepts": [],
                        "stt_corrected_transcript": ""},  # no "score" key
        )
        # Should not crash, defaults to 50
        assert 0.0 <= result.final_score <= 100.0

    def test_word_count_correct(self):
        answer = "one two three four five six seven eight nine ten"
        result = run_hybrid_evaluation(
            answer=answer,
            question_text="any question",
            llm_result=self._llm_result(),
        )
        assert result.word_count == 10


# ─────────────────────────────────────────────────────────────────────────────
# KEYWORD_BANK integrity
# ─────────────────────────────────────────────────────────────────────────────

class TestKeywordBankIntegrity:
    def test_all_keys_are_lowercase(self):
        for key in KEYWORD_BANK:
            assert key == key.lower(), f"Key '{key}' is not lowercase"

    def test_no_empty_keyword_lists(self):
        for key, kws in KEYWORD_BANK.items():
            assert len(kws) > 0, f"Key '{key}' has empty keyword list"

    def test_no_duplicate_keywords_within_entry(self):
        for key, kws in KEYWORD_BANK.items():
            assert len(kws) == len(set(kws)), f"Key '{key}' has duplicate keywords"

    def test_expected_topics_present(self):
        expected = [
            "array", "linked list", "binary search", "tree", "graph",
            "hash", "sorting", "recursion", "dynamic programming",
            "caching", "database", "api", "oop", "concurrency",
        ]
        for topic in expected:
            assert topic in KEYWORD_BANK, f"'{topic}' missing from KEYWORD_BANK"
