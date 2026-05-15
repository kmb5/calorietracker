from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = (
        "postgresql+asyncpg://calorietracker:secret@db:5432/calorietracker"
    )
    SECRET_KEY: str = "change-me-in-production"
    ENVIRONMENT: str = "development"


settings = Settings()
