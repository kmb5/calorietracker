from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.auth.router import router as auth_router
from app.config import get_settings
from app.ingredients.router import router as ingredients_router
from app.limiter import limiter
from app.recipes.router import router as recipes_router

# get_settings() is called here so that CORSMiddleware can be registered
# before the app starts (Starlette forbids add_middleware after startup).
# Tests set the required env vars in conftest.py before importing this module,
# so this call succeeds without a real .env file in CI / test environments.
settings = get_settings()

app = FastAPI(title="CalorieTracker API", version="0.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # ty: ignore[invalid-argument-type]  — slowapi's handler narrows Exception to RateLimitExceeded

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(ingredients_router)
app.include_router(recipes_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
