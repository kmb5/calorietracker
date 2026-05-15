from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Required — no defaults so the app crashes loudly if these are missing.
    DATABASE_URL: str
    SECRET_KEY: str

    ENVIRONMENT: str = "development"
    TEST_DATABASE_URL: str = (
        "postgresql+asyncpg://calorietracker:secret@localhost:5432/calorietracker_test"
    )

    @model_validator(mode="after")
    def _check_production_secrets(self) -> "Settings":
        """Prevent known-insecure placeholder values from reaching production."""
        if self.ENVIRONMENT == "production":
            if self.SECRET_KEY == "change-me-in-production":
                raise ValueError(
                    "SECRET_KEY must be set to a strong random value in production. "
                    'Generate one with: python -c "import secrets; print(secrets.token_hex(32))"'
                )
        return self


settings = Settings()  # ty: ignore[missing-argument]  # fields resolved from env/.env by pydantic-settings
