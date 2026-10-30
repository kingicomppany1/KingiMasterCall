import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from .config import settings
from .db import fetch_one

bearer = HTTPBearer(auto_error=False)
_jwks = PyJWKClient(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json")


def _decode(token: str) -> dict:
    try:
        alg = jwt.get_unverified_header(token).get("alg", "")
        if alg.startswith("HS"):
            return jwt.decode(token, settings.supabase_jwt_secret, algorithms=[alg], audience="authenticated")
        key = _jwks.get_signing_key_from_jwt(token).key
        return jwt.decode(token, key, algorithms=[alg], audience="authenticated")
    except Exception:
        raise HTTPException(401, "Invalid or expired session")


async def current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if not creds:
        raise HTTPException(401, "Not signed in")
    claims = _decode(creds.credentials)
    me = await fetch_one("select * from profiles where id = %s", (claims["sub"],))
    if not me:
        raise HTTPException(401, "No profile for this user")
    return me


async def require_agent(me: dict = Depends(current_user)) -> dict:
    if me["role"] != "sales_agent":
        raise HTTPException(403, "Agents only")
    return me


async def require_admin(me: dict = Depends(current_user)) -> dict:
    if me["role"] != "admin":
        raise HTTPException(403, "Admins only")
    return me
