from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import ALLOWED_ORIGINS
from .db import init_db
from .routes import chat, files, generate, sessions


def create_app() -> FastAPI:
    init_db()
    app = FastAPI(title="Klarus DD Assistant — backend", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(sessions.router)
    app.include_router(generate.router)
    app.include_router(chat.router)
    app.include_router(files.router)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
