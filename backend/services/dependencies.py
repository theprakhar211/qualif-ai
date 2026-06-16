from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from services.auth_service import decode_token
from database import db_instance
from bson import ObjectId

bearer = HTTPBearer()

# Synthetic guest user — same shape as a real user dict so all routes
# work without modification. _id is a fixed ObjectId used as the rate
# limit key; it never maps to a real MongoDB document.
GUEST_USER_OID = ObjectId("000000000000000000000000")
GUEST_USER: dict = {
    "_id":      GUEST_USER_OID,
    "id":       "guest",
    "name":     "Guest",
    "email":    "guest@qualif.ai",
    "resume":   {},
    "is_guest": True,
    "seen_question_hashes": [],
}


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer)
) -> dict:
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )

    # Guest token — skip DB, return synthetic user immediately
    if payload.get("role") == "guest":
        return GUEST_USER

    user = await db_instance.users_col.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    user["id"] = str(user["_id"])
    return user
