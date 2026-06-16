from motor.motor_asyncio import AsyncIOMotorClient
from loguru import logger
from config import settings


class Database:
    client: AsyncIOMotorClient = None

    @property
    def users_col(self):
        return self.client[settings.DB_NAME]["users"]

    @property
    def sessions_col(self):
        return self.client[settings.DB_NAME]["sessions"]

    @property
    def questions_col(self):
        return self.client[settings.DB_NAME]["questions"]

    @property
    def results_col(self):
        return self.client[settings.DB_NAME]["results"]

    @property
    def ideal_answers_col(self):
        return self.client[settings.DB_NAME]["ideal_answers"]

    @property
    def share_cards_col(self):
        return self.client[settings.DB_NAME]["share_cards"]


db_instance = Database()


async def connect_db():
    logger.info("Connecting to MongoDB...")
    db_instance.client = AsyncIOMotorClient(settings.MONGO_URI)

    # Existing indexes
    await db_instance.users_col.create_index("email", unique=True)
    await db_instance.sessions_col.create_index("user_id")
    await db_instance.questions_col.create_index([("role", 1), ("difficulty", 1)])

    # New indexes for skill graph + ideal answer cache
    await db_instance.ideal_answers_col.create_index("fingerprint", unique=True)
    await db_instance.ideal_answers_col.create_index("question_text")
    await db_instance.share_cards_col.create_index("share_id", unique=True)
    await db_instance.share_cards_col.create_index("created_at", expireAfterSeconds=2592000)

    # Guest sessions auto-delete after 24 hours via MongoDB TTL index.
    # The index fires only on documents where is_guest=True using a partial filter expression.
    await db_instance.sessions_col.create_index(
        "created_at",
        expireAfterSeconds=86400,   # 24 hours
        partialFilterExpression={"is_guest": True},
        name="guest_session_ttl"
    )

    logger.success("MongoDB connected.")


async def close_db():
    if db_instance.client:
        db_instance.client.close()
        logger.info("MongoDB connection closed.")


def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB document ObjectIds to strings."""
    if doc is None:
        return None
    doc["id"] = str(doc["_id"])
    del doc["_id"]
    return doc
