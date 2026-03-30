from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGO_URI:        str = "mongodb://localhost:27017"
    DB_NAME:          str = "qualifai"
    JWT_SECRET:       str = "change-this-in-production"
    JWT_EXPIRE_HOURS: int = 24
    GROQ_API_KEY:     str = ""
    GROQ_FAST_MODEL:  str = "llama-3.1-8b-instant"
    GROQ_SMART_MODEL: str = "llama-3.3-70b-versatile"

    class Config:
        env_file = ".env"


settings = Settings()
