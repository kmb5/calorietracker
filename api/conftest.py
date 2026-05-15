"""
Root conftest — sets test environment variables before any app module is
imported. Pytest processes this file before tests/conftest.py, so
`app.config.settings` is instantiated with these values when no real .env
is present (e.g. in CI or a fresh local checkout).
"""
import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://calorietracker:secret@localhost:5432/calorietracker")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("TEST_DATABASE_URL", "postgresql+asyncpg://calorietracker:secret@localhost:5432/calorietracker_test")
