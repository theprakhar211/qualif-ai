"""
tests/test_skill_graph.py
Pytest suite for services/skill_graph.py
Run with: pytest tests/ -v
No external dependencies — all MongoDB functions are excluded from unit tests.
"""

from services.skill_graph import (
    infer_skill,
    SkillNode,
    SkillGraph,
    TOPIC_TO_SKILL,
    SKILL_TREE,
    ALL_SKILLS,
)


# ─────────────────────────────────────────────────────────────────────────────
# infer_skill
# ─────────────────────────────────────────────────────────────────────────────

class TestInferSkill:
    def test_exact_topic_match(self):
        assert infer_skill("", topic="array") == "Arrays"
        assert infer_skill("", topic="binary search") == "Binary Search"
        assert infer_skill("", topic="recursion") == "Recursion"

    def test_question_text_match(self):
        assert infer_skill("How does binary search work?") == "Binary Search"
        assert infer_skill("Explain recursion and base cases") == "Recursion"
        assert infer_skill("What is a linked list?") == "Linked Lists"

    def test_topic_takes_priority_over_question(self):
        # topic="graph" should match first, even if question mentions other topics
        # Use a question that has NO graph-related words so only topic fires
        result = infer_skill("Explain the concept of traversal", topic="graph")
        assert result == "Graphs"

    def test_longer_fragment_wins(self):
        # "binary search" is longer than "search" — should match Binary Search not Searching
        result = infer_skill("How does binary search work?")
        assert result == "Binary Search"

    def test_returns_none_for_unknown(self):
        assert infer_skill("What is your favourite colour?") is None
        assert infer_skill("", topic=None) is None
        assert infer_skill("") is None

    def test_case_insensitive(self):
        assert infer_skill("BINARY SEARCH algorithm") == "Binary Search"
        assert infer_skill("", topic="ARRAY") == "Arrays"

    def test_common_question_phrasings(self):
        cases = [
            ("Explain how a hash map works", "Hash Tables"),
            ("What is the time complexity of sorting algorithms?", "Sorting"),
            ("How do you detect a cycle in a graph?", "Graphs"),
            ("Describe dynamic programming with an example", "Dynamic Programming"),
            ("What is object oriented programming?", "OOP"),
            ("How does caching improve performance?", "Caching"),
            ("Tell me about a conflict you had with a teammate", "Conflict Resolution"),
            ("Describe a time you showed leadership", "Leadership"),
        ]
        for question, expected_skill in cases:
            result = infer_skill(question)
            assert result == expected_skill, \
                f"'{question}' → got '{result}', expected '{expected_skill}'"

    def test_all_mapped_skills_are_in_skill_tree(self):
        for fragment, skill in TOPIC_TO_SKILL.items():
            assert skill in ALL_SKILLS, \
                f"TOPIC_TO_SKILL maps '{fragment}' → '{skill}' but '{skill}' not in SKILL_TREE"


# ─────────────────────────────────────────────────────────────────────────────
# SkillNode
# ─────────────────────────────────────────────────────────────────────────────

class TestSkillNode:
    def test_initial_mastery_is_zero(self):
        node = SkillNode(name="Arrays")
        assert node.mastery == 0.0

    def test_mastery_after_one_score(self):
        node = SkillNode(name="Arrays")
        node.record(80.0)
        assert node.mastery == 80.0

    def test_mastery_is_weighted_toward_recent(self):
        node = SkillNode(name="Arrays")
        node.record(20.0)   # old score
        node.record(20.0)
        node.record(20.0)
        node.record(90.0)   # recent improvement
        # Weighted average should be higher than simple average (32.5)
        simple_avg = (20 + 20 + 20 + 90) / 4  # = 37.5
        assert node.mastery > simple_avg

    def test_recent_scores_capped_at_five(self):
        node = SkillNode(name="Arrays")
        for score in [10, 20, 30, 40, 50, 60, 70]:
            node.record(score)
        assert len(node.recent_scores) == 5
        assert node.recent_scores == [30, 40, 50, 60, 70]

    def test_attempts_increments(self):
        node = SkillNode(name="Arrays")
        node.record(50.0)
        node.record(60.0)
        assert node.attempts == 2

    def test_total_score_accumulates(self):
        node = SkillNode(name="Arrays")
        node.record(40.0)
        node.record(60.0)
        assert node.total_score == 100.0

    def test_confidence_scales_with_attempts(self):
        node = SkillNode(name="Arrays")
        assert node.confidence == 0.0
        node.record(50.0)
        assert 0.0 < node.confidence <= 1.0
        for _ in range(10):
            node.record(50.0)
        assert node.confidence == 1.0

    def test_last_seen_set_after_record(self):
        node = SkillNode(name="Arrays")
        assert node.last_seen is None
        node.record(70.0)
        assert node.last_seen is not None

    def test_to_dict_has_correct_keys(self):
        node = SkillNode(name="Arrays")
        node.record(75.0)
        d = node.to_dict()
        assert set(d.keys()) == {
            "name", "attempts", "total_score", "last_seen",
            "recent_scores", "mastery", "confidence"
        }

    def test_roundtrip_serialisation(self):
        node = SkillNode(name="Trees")
        node.record(65.0)
        node.record(80.0)
        restored = SkillNode.from_dict(node.to_dict())
        assert restored.name == node.name
        assert restored.attempts == node.attempts
        assert restored.recent_scores == node.recent_scores
        assert abs(restored.mastery - node.mastery) < 0.1

    def test_mastery_always_between_0_and_100(self):
        node = SkillNode(name="Test")
        for score in [0, 50, 100, 75, 25]:
            node.record(float(score))
            assert 0.0 <= node.mastery <= 100.0


# ─────────────────────────────────────────────────────────────────────────────
# SkillGraph
# ─────────────────────────────────────────────────────────────────────────────

class TestSkillGraph:
    def _graph_with_scores(self, skill_scores: dict) -> SkillGraph:
        """Helper — builds a graph with given {skill: [scores]} dict."""
        graph = SkillGraph()
        for skill, scores in skill_scores.items():
            for score in scores:
                graph.record_answer(skill, score)
        return graph

    def test_empty_graph_has_no_nodes(self):
        graph = SkillGraph()
        assert len(graph.nodes) == 0

    def test_record_answer_creates_node(self):
        graph = SkillGraph()
        graph.record_answer("Arrays", 70.0)
        assert "Arrays" in graph.nodes

    def test_record_answer_updates_mastery(self):
        graph = SkillGraph()
        graph.record_answer("Arrays", 80.0)
        assert graph.mastery_for("Arrays") == 80.0

    def test_mastery_for_unknown_skill_returns_zero(self):
        graph = SkillGraph()
        assert graph.mastery_for("Unknown Skill") == 0.0

    def test_multiple_records_same_skill(self):
        graph = SkillGraph()
        graph.record_answer("Arrays", 60.0)
        graph.record_answer("Arrays", 80.0)
        assert graph.nodes["Arrays"].attempts == 2

    def test_get_weakest_skills_ordering(self):
        graph = self._graph_with_scores({
            "Arrays":     [90.0],
            "Trees":      [40.0],
            "Graphs":     [60.0],
            "Recursion":  [20.0],
        })
        weakest = graph.get_weakest_skills(n=2)
        assert weakest[0] == "Recursion"   # lowest mastery first
        assert weakest[1] == "Trees"

    def test_get_weakest_skills_respects_n(self):
        graph = self._graph_with_scores({
            "Arrays": [80.0], "Trees": [40.0],
            "Graphs": [60.0], "Recursion": [20.0],
        })
        assert len(graph.get_weakest_skills(n=2)) == 2
        assert len(graph.get_weakest_skills(n=4)) == 4

    def test_get_weakest_skills_min_attempts_filter(self):
        graph = SkillGraph()
        graph.record_answer("Arrays", 30.0)   # 1 attempt
        graph.record_answer("Trees",  90.0)   # 1 attempt
        # With min_attempts=2, nothing qualifies
        assert graph.get_weakest_skills(n=3, min_attempts=2) == []

    def test_get_weakest_skills_empty_graph(self):
        graph = SkillGraph()
        assert graph.get_weakest_skills() == []

    def test_get_target_skill_returns_weakest(self):
        graph = self._graph_with_scores({
            "Arrays":    [90.0],
            "Recursion": [20.0],
            "Trees":     [60.0],
        })
        assert graph.get_target_skill() == "Recursion"

    def test_get_target_skill_avoids_session_skills(self):
        graph = self._graph_with_scores({
            "Arrays":    [90.0],
            "Recursion": [20.0],   # weakest but already attempted this session
            "Trees":     [60.0],
        })
        target = graph.get_target_skill(attempted_this_session=["Recursion"])
        assert target == "Trees"   # next weakest not in session

    def test_get_target_skill_falls_back_when_all_attempted(self):
        graph = self._graph_with_scores({
            "Arrays": [90.0], "Trees": [50.0],
        })
        # All skills attempted this session → returns weakest overall
        target = graph.get_target_skill(attempted_this_session=["Arrays", "Trees"])
        assert target == "Trees"   # weakest overall

    def test_get_target_skill_returns_none_for_empty_graph(self):
        graph = SkillGraph()
        assert graph.get_target_skill() is None

    def test_category_breakdown_structure(self):
        graph = self._graph_with_scores({"Arrays": [70.0], "Trees": [80.0]})
        breakdown = graph.category_breakdown()
        assert "Data Structures" in breakdown
        ds = breakdown["Data Structures"]
        assert "mastery" in ds
        assert "skills" in ds
        assert "Arrays" in ds["skills"]
        assert "Trees" in ds["skills"]

    def test_category_breakdown_mastery_is_average(self):
        graph = self._graph_with_scores({
            "Arrays": [60.0],
            "Trees":  [80.0],
        })
        breakdown = graph.category_breakdown()
        ds_mastery = breakdown["Data Structures"]["mastery"]
        assert abs(ds_mastery - 70.0) < 1.0   # avg of 60 and 80

    def test_category_breakdown_null_mastery_for_empty_category(self):
        graph = SkillGraph()
        breakdown = graph.category_breakdown()
        # No skills recorded → all categories have mastery=None
        for cat_data in breakdown.values():
            assert cat_data["mastery"] is None

    def test_category_breakdown_only_includes_practiced_skills(self):
        graph = self._graph_with_scores({"Arrays": [70.0]})
        breakdown = graph.category_breakdown()
        ds_skills = breakdown["Data Structures"]["skills"]
        assert "Arrays" in ds_skills
        assert "Trees" not in ds_skills   # not practiced

    def test_to_dict_roundtrip(self):
        graph = self._graph_with_scores({
            "Arrays":    [70.0, 80.0],
            "Recursion": [50.0],
        })
        restored = SkillGraph.from_dict(graph.to_dict())
        assert set(restored.nodes.keys()) == {"Arrays", "Recursion"}
        assert restored.nodes["Arrays"].attempts == 2
        assert abs(restored.mastery_for("Recursion") - 50.0) < 0.1

    def test_from_dict_empty(self):
        graph = SkillGraph.from_dict({})
        assert len(graph.nodes) == 0

    def test_graph_handles_multiple_categories(self):
        graph = self._graph_with_scores({
            "Arrays":           [80.0],  # Data Structures
            "Sorting":          [70.0],  # Algorithms
            "Caching":          [60.0],  # System Design
            "Conflict Resolution": [50.0],  # Behavioural
        })
        breakdown = graph.category_breakdown()
        assert breakdown["Data Structures"]["mastery"] is not None
        assert breakdown["Algorithms"]["mastery"] is not None
        assert breakdown["System Design"]["mastery"] is not None
        assert breakdown["Behavioural"]["mastery"] is not None


# ─────────────────────────────────────────────────────────────────────────────
# SKILL_TREE integrity
# ─────────────────────────────────────────────────────────────────────────────

class TestSkillTreeIntegrity:
    def test_all_skills_categories_present(self):
        expected_categories = [
            "Data Structures", "Algorithms", "System Design",
            "Languages", "Concepts", "Communication", "Behavioural"
        ]
        for cat in expected_categories:
            assert cat in SKILL_TREE, f"Category '{cat}' missing from SKILL_TREE"

    def test_no_empty_categories(self):
        for cat, skills in SKILL_TREE.items():
            assert len(skills) > 0, f"Category '{cat}' has no skills"

    def test_all_skills_set_matches_tree(self):
        all_from_tree = {s for skills in SKILL_TREE.values() for s in skills}
        assert all_from_tree == ALL_SKILLS

    def test_no_duplicate_skills_across_categories(self):
        all_skills = []
        for skills in SKILL_TREE.values():
            all_skills.extend(skills)
        assert len(all_skills) == len(set(all_skills)), \
            "Duplicate skill found across categories"

    def test_topic_to_skill_values_all_valid(self):
        for fragment, skill in TOPIC_TO_SKILL.items():
            assert skill in ALL_SKILLS, \
                f"'{fragment}' maps to '{skill}' which is not in SKILL_TREE"
