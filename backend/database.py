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


db_instance = Database()


async def connect_db():
    logger.info("Connecting to MongoDB...")
    db_instance.client = AsyncIOMotorClient(settings.MONGO_URI)

    # Create indexes
    await db_instance.users_col.create_index("email", unique=True)
    await db_instance.sessions_col.create_index("user_id")
    await db_instance.questions_col.create_index([("role", 1), ("difficulty", 1)])

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
