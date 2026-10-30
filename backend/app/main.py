from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import lifespan
from .routers import admin, agent, calls, webhook

app = FastAPI(title="KingiMaster Sales Calling API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)
for r in (agent.router, calls.router, admin.router, webhook.router):
    app.include_router(r)


@app.get("/health")
async def health():
    return {"ok": True}
