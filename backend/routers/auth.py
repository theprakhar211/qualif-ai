from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime
from loguru import logger

from models.user import UserRegister, UserLogin, UserResponse
from services.auth_service import hash_password, verify_password, create_token
from services.dependencies import get_current_user
from database import db_instance

router = APIRouter()


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user: UserRegister):
    existing = await db_instance.users_col.find_one({"email": user.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    user_doc = {
        "name": user.name,
        "email": user.email,
        "hashed_password": hash_password(user.password),
        "created_at": datetime.utcnow()
    }

    result = await db_instance.users_col.insert_one(user_doc)
    user_id = str(result.inserted_id)
    token = create_token(user_id, user.email)

    logger.info(f"New user registered: {user.email}")
    return {
        "message": "Registration successful",
        "token": token,
        "user": {
            "id": user_id,
            "name": user.name,
            "email": user.email
        }
    }


@router.post("/login")
async def login(credentials: UserLogin):
    user = await db_instance.users_col.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    user_id = str(user["_id"])
    token = create_token(user_id, user["email"])

    logger.info(f"User logged in: {credentials.email}")
    return {
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user_id,
            "name": user["name"],
            "email": user["email"]
        }
    }


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user["_id"]),
        name=current_user["name"],
        email=current_user["email"],
        created_at=current_user["created_at"]
    )
