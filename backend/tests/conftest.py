"""
tests/conftest.py
Adds the backend root to sys.path so imports like
`from services.hybrid_evaluator import ...` work from the tests folder.
"""

import sys
import os

# Allow `from services.xxx import ...` to resolve from backend/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
