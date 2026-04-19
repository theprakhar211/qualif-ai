"""
services/skill_graph.py
Skill graph with mastery tracking and adaptive targeting logic.
"""

from __future__ import annotations
import math
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Skill taxonomy
# ---------------------------------------------------------------------------

SKILL_TREE: dict[str, list[str]] = {
    # CS Fundamentals
    "Data Structures": ["Arrays", "Linked Lists", "Stacks & Queues", "Hash Tables", "Trees", "Graphs", "Heaps"],
    "Algorithms": ["Sorting", "Searching", "Binary Search", "Recursion", "Dynamic Programming", "Greedy", "Graph Algorithms"],
    "System Design": ["Caching", "Load Balancing", "Databases", "APIs & REST", "Microservices", "Message Queues", "CDN"],
    "Languages": ["Python", "JavaScript", "TypeScript", "Java", "Go", "SQL"],
    "Concepts": ["OOP", "Functional Programming", "Concurrency", "Memory Management", "Networking", "Security"],
    # Soft skills
    "Communication": ["Clarity", "Structure", "Brevity", "Technical Vocabulary"],
    "Behavioural": ["STAR Format", "Conflict Resolution", "Leadership", "Failure & Growth", "Teamwork"],
}

# Flat lookup
ALL_SKILLS: set[str] = {s for subs in SKILL_TREE.values() for s in subs}

# Prerequisite edges (skill → [must know these first])
PREREQUISITES: dict[str, list[str]] = {
    "Binary Search": ["Arrays", "Sorting"],
    "Dynamic Programming": ["Recursion", "Arrays"],
    "Graph Algorithms": ["Graphs", "Recursion"],
    "Microservices": ["APIs & REST", "Databases"],
    "STAR Format": [],
}

# Question topic → skill mapping
# Keys are substrings matched against (topic + question_text).lower()
# Longer/more specific keys are matched first (see infer_skill)
TOPIC_TO_SKILL: dict[str, str] = {
    # Data Structures — specific first
    "binary search": "Binary Search",
    "linked list":   "Linked Lists",
    "dynamic programming": "Dynamic Programming",
    "hash table":    "Hash Tables",
    "hash map":      "Hash Tables",
    "hashmap":       "Hash Tables",
    "hashtable":     "Hash Tables",
    "binary tree":   "Trees",
    "bst":           "Trees",
    "graph":         "Graphs",
    "heap":          "Heaps",
    "priority queue":"Heaps",
    "stack":         "Stacks & Queues",
    "queue":         "Stacks & Queues",
    "array":         "Arrays",
    "list":          "Arrays",
    "tree":          "Trees",
    "hash":          "Hash Tables",
    # Algorithms
    "sorting":       "Sorting",
    "sort":          "Sorting",
    "searching":     "Searching",
    "search":        "Searching",
    "recursion":     "Recursion",
    "recursive":     "Recursion",
    "memoization":   "Dynamic Programming",
    "tabulation":    "Dynamic Programming",
    "greedy":        "Greedy",
    "bfs":           "Graph Algorithms",
    "dfs":           "Graph Algorithms",
    "dijkstra":      "Graph Algorithms",
    "shortest path": "Graph Algorithms",
    "traversal":     "Graph Algorithms",
    "dp":            "Dynamic Programming",
    "time complexity": "Sorting",     # most time complexity Qs are about sorting/searching
    "space complexity": "Recursion",   # most space complexity Qs are about recursion
    "big o":           "Sorting",
    "algorithm":       "Searching",
    # System Design
    "microservice":  "Microservices",
    "load balanc":   "Load Balancing",
    "message queue": "Message Queues",
    "caching":       "Caching",
    "cache":         "Caching",
    "database":      "Databases",
    "sql":           "SQL",
    "nosql":         "Databases",
    "mongodb":       "Databases",
    "postgres":      "Databases",
    "api":           "APIs & REST",
    "rest":          "APIs & REST",
    "graphql":       "APIs & REST",
    "scalab":        "Microservices",  # scalability questions → Microservices
    "system design": "Databases",      # general system design → Databases as anchor skill
    "cdn":           "CDN",
    "distributed":   "Databases",
    # Languages
    "python":        "Python",
    "javascript":    "JavaScript",
    "typescript":    "TypeScript",
    "java":          "Java",
    "golang":        "Go",
    # Concepts
    "concurren":     "Concurrency",
    "thread":        "Concurrency",
    "async":         "Concurrency",
    "parallel":      "Concurrency",
    "deadlock":      "Concurrency",
    "mutex":         "Concurrency",
    "object oriented": "OOP",
    "oop":           "OOP",
    "inheritance":   "OOP",
    "polymorphism":  "OOP",
    "encapsulation": "OOP",
    "design pattern":"OOP",
    "memory":        "Memory Management",
    "garbage":       "Memory Management",
    "pointer":       "Memory Management",
    "network":       "Networking",
    "http":          "Networking",
    "tcp":           "Networking",
    "security":      "Security",
    "auth":          "Security",
    "encryption":    "Security",
    # Behavioural
    "star":          "STAR Format",
    "conflict":      "Conflict Resolution",
    "disagree":      "Conflict Resolution",
    "leadership":    "Leadership",
    "led a":         "Leadership",
    "failure":       "Failure & Growth",
    "mistake":       "Failure & Growth",
    "team":          "Teamwork",
    "collaborat":    "Teamwork",
    "communic":      "Clarity",
    "explain":       "Clarity",
}


def infer_skill(question_text: str, topic: str | None = None) -> str | None:
    """
    Map a question/topic string to a canonical skill name.
    Topic is checked first with exact/prefix match.
    Falls back to searching full question text if topic yields nothing.
    """
    # 1. Try topic first (strict — longer fragments first)
    if topic:
        topic_lower = topic.strip().lower()
        sorted_fragments = sorted(TOPIC_TO_SKILL.keys(), key=len, reverse=True)
        for fragment in sorted_fragments:
            if fragment in topic_lower:
                return TOPIC_TO_SKILL[fragment]

    # 2. Fall back to searching question text
    if question_text:
        q_lower = question_text.lower()
        sorted_fragments = sorted(TOPIC_TO_SKILL.keys(), key=len, reverse=True)
        for fragment in sorted_fragments:
            if fragment in q_lower:
                return TOPIC_TO_SKILL[fragment]

    return None


# ---------------------------------------------------------------------------
# Mastery model (stored per-user in MongoDB)
# ---------------------------------------------------------------------------

@dataclass
class SkillNode:
    name: str
    attempts: int = 0
    total_score: float = 0.0        # cumulative (0–100 per attempt)
    last_seen: Optional[str] = None  # ISO timestamp
    recent_scores: list[float] = field(default_factory=list)  # last 5

    @property
    def mastery(self) -> float:
        """Exponentially weighted recent mastery 0–100."""
        if not self.recent_scores:
            return 0.0
        # More weight to recent scores
        weights = [0.5 ** i for i in range(len(self.recent_scores))]
        total_w = sum(weights)
        weighted = sum(s * w for s, w in zip(reversed(self.recent_scores), weights))
        return round(weighted / total_w, 1)

    @property
    def confidence(self) -> float:
        """0–1: how confident we are in the mastery estimate (more attempts = higher)."""
        return round(min(1.0, self.attempts / 5), 2)

    def record(self, score: float) -> None:
        self.attempts += 1
        self.total_score += score
        self.recent_scores.append(score)
        if len(self.recent_scores) > 5:
            self.recent_scores.pop(0)
        self.last_seen = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "attempts": self.attempts,
            "total_score": self.total_score,
            "last_seen": self.last_seen,
            "recent_scores": self.recent_scores,
            "mastery": self.mastery,
            "confidence": self.confidence,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "SkillNode":
        obj = cls(name=d["name"])
        obj.attempts = d.get("attempts", 0)
        obj.total_score = d.get("total_score", 0.0)
        obj.last_seen = d.get("last_seen")
        obj.recent_scores = d.get("recent_scores", [])
        return obj


@dataclass
class SkillGraph:
    """Per-user skill graph. Serialisable to/from MongoDB document."""
    nodes: dict[str, SkillNode] = field(default_factory=dict)

    def _ensure(self, skill: str) -> SkillNode:
        if skill not in self.nodes:
            self.nodes[skill] = SkillNode(name=skill)
        return self.nodes[skill]

    def record_answer(self, skill: str, score: float) -> None:
        """Update mastery after an answer is evaluated."""
        node = self._ensure(skill)
        node.record(score)

    def mastery_for(self, skill: str) -> float:
        return self.nodes[skill].mastery if skill in self.nodes else 0.0

    def get_weakest_skills(self, n: int = 3, min_attempts: int = 1) -> list[str]:
        """Return top-n weakest skills (with at least min_attempts recorded)."""
        eligible = [
            (name, node.mastery)
            for name, node in self.nodes.items()
            if node.attempts >= min_attempts
        ]
        eligible.sort(key=lambda x: x[1])
        return [name for name, _ in eligible[:n]]

    def get_target_skill(self, attempted_this_session: list[str] | None = None) -> str | None:
        """
        Adaptive targeting: return skill to focus on next.
        Priority: weakest not yet attempted this session → weakest overall.
        """
        session_set = set(attempted_this_session or [])

        candidates = [
            (name, node.mastery)
            for name, node in self.nodes.items()
            if name not in session_set
        ]
        candidates.sort(key=lambda x: x[1])

        if candidates:
            return candidates[0][0]

        # All skills attempted — fall back to weakest overall
        all_skills = [(n, nd.mastery) for n, nd in self.nodes.items()]
        all_skills.sort(key=lambda x: x[1])
        return all_skills[0][0] if all_skills else None

    def category_breakdown(self) -> dict[str, dict]:
        """Group mastery scores by top-level category for dashboard."""
        result: dict[str, dict] = {}
        for category, children in SKILL_TREE.items():
            nodes_in_cat = [self.nodes[s] for s in children if s in self.nodes]
            if not nodes_in_cat:
                result[category] = {"mastery": None, "skills": {}}
                continue
            avg = sum(n.mastery for n in nodes_in_cat) / len(nodes_in_cat)
            result[category] = {
                "mastery": round(avg, 1),
                "skills": {
                    s: self.nodes[s].to_dict()
                    for s in children
                    if s in self.nodes
                },
            }
        return result

    def to_dict(self) -> dict:
        return {name: node.to_dict() for name, node in self.nodes.items()}

    @classmethod
    def from_dict(cls, d: dict) -> "SkillGraph":
        graph = cls()
        for name, node_data in d.items():
            graph.nodes[name] = SkillNode.from_dict(node_data)
        return graph


# ---------------------------------------------------------------------------
# MongoDB helpers (to add to database.py / user document)
# ---------------------------------------------------------------------------

async def load_skill_graph(db, user_id: str) -> SkillGraph:
    """Load skill graph from user document."""
    from bson import ObjectId
    user = await db.users_col.find_one({"_id": ObjectId(user_id)}, {"skill_graph": 1})
    raw = (user or {}).get("skill_graph", {})
    return SkillGraph.from_dict(raw)


async def save_skill_graph(db, user_id: str, graph: SkillGraph) -> None:
    """Persist skill graph back to user document."""
    from bson import ObjectId
    await db.users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"skill_graph": graph.to_dict()}},
    )


async def update_skill_graph_from_session(
    db,
    user_id: str,
    evaluated_answers: list[dict],   # [{question_text, topic, final_score}, ...]
) -> SkillGraph:
    """
    Call after batch evaluation completes.
    Updates graph with all answer scores for this session.
    """
    graph = await load_skill_graph(db, user_id)
    for ans in evaluated_answers:
        skill = infer_skill(ans.get("question_text", ""), ans.get("topic"))
        if skill:
            graph.record_answer(skill, ans["final_score"])
    await save_skill_graph(db, user_id, graph)
    return graph
