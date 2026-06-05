"""
Rate limiting for Qualif-AI using slowapi.
Keys by authenticated user ID (from JWT) for accuracy over IP-based limiting.
Uses in-memory storage — acceptable for single Render instance on free tier.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request


def get_user_id_key(request: Request) -> str:
    """
    Key rate limits by authenticated user ID extracted from JWT state.
    Falls back to IP address for unauthenticated routes (e.g. /resume/parse
    if ever made public) so limiting always works.

    Depends on the auth middleware having already decoded the JWT and stored
    the user_id on request.state (which your existing get_current_user
    dependency does via request.state.user_id — add that one line if missing).
    """
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return str(user_id)
    return get_remote_address(request)


# Single shared limiter instance — import this everywhere
limiter = Limiter(key_func=get_user_id_key)
