from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
import secrets
from models.share import ShareCardCreate, ShareCardResponse
from database import db_instance

router = APIRouter(tags=["share"])


@router.post("", response_model=ShareCardResponse)
async def create_share_card(data: ShareCardCreate):
    share_id = secrets.token_urlsafe(8)
    doc = data.model_dump()
    doc["share_id"] = share_id
    doc["created_at"] = datetime.now(timezone.utc)
    await db_instance.share_cards_col.insert_one(doc)
    return ShareCardResponse(
        share_id=share_id,
        url=f"https://qualif-smart-ai.vercel.app/share/{share_id}"
    )


@router.get("/{share_id}")
async def get_share_card(share_id: str):
    doc = await db_instance.share_cards_col.find_one(
        {"share_id": share_id},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Share card not found")
    return doc
