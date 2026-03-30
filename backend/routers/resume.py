from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from services.dependencies import get_current_user
from services.resume_parser import parse_resume
from database import db_instance
from bson import ObjectId
from loguru import logger

router = APIRouter()

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    # Read and validate size
    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max size is 5MB.")

    logger.info(f"Parsing resume for user {str(current_user['_id'])} — {len(pdf_bytes)} bytes")

    # Parse with Groq
    parsed = await parse_resume(pdf_bytes)

    # Store in user record
    await db_instance.users_col.update_one(
        {"_id": ObjectId(str(current_user["_id"]))},
        {"$set": {"resume": parsed}}
    )

    return {
        "message": "Resume parsed successfully",
        "parsed":  parsed
    }


@router.get("/me")
async def get_my_resume(current_user: dict = Depends(get_current_user)):
    user = await db_instance.users_col.find_one({
        "_id": ObjectId(str(current_user["_id"]))
    })
    return user.get("resume", {})