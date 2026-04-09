from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://grindstone:grindstone@postgres:5432/grindstone"
    REDIS_URL: str = "redis://redis:6379/0"

    JWT_SECRET: str = "change_this_to_a_long_random_string"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 10080  # 7 days

    FERNET_KEY: str = ""

    ENVIRONMENT: str = "development"
    BACKEND_URL: str = "http://backend:8000"


settings = Settings()
