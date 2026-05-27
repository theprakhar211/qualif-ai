from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env")

    MONGO_URI:        str = "mongodb://localhost:27017"
    DB_NAME:          str = "qualifai"
    JWT_SECRET:       str = "change-this-in-production"
    JWT_EXPIRE_HOURS: int = 24
    GROQ_API_KEY:     str = ""
    GROQ_FAST_MODEL:  str = "llama-3.1-8b-instant"
    GROQ_SMART_MODEL: str = "llama-3.3-70b-versatile"


settings = Settings()
