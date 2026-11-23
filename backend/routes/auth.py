"""
Authentication router – Sign Up, Sign In, and current user profile with JWT and MongoDB Atlas.
"""
from __future__ import annotations

import datetime
import logging
import re
from typing import Any, Dict, Optional

import bcrypt
import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field

from config import get_settings
from services.mongodb import MongoDBService

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / Response Schemas
# ---------------------------------------------------------------------------

class SignUpRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    email: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6, max_length=100)
    tenant_id: Optional[str] = "default"


class SignInRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)


class UserProfile(BaseModel):
    id: str
    name: str
    email: str
    tenant_id: str
    created_at: str


class AuthResponse(BaseModel):
    token: str
    user: UserProfile
    mongodb_connected: bool


# ---------------------------------------------------------------------------
# JWT Helpers
# ---------------------------------------------------------------------------

def create_access_token(user: Dict[str, Any]) -> str:
    settings = get_settings()
    exp = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=settings.jwt_expiry_hours)
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "name": user["name"],
        "tenant_id": user.get("tenant_id", "default"),
        "exp": exp,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> Dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired. Please sign in again.")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token.")


def _get_mongodb(request: Request) -> MongoDBService:
    return request.app.state.mongodb


async def get_current_user_optional(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> Optional[Dict[str, Any]]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_access_token(token)
        mongodb = _get_mongodb(request)
        user = await mongodb.get_user_by_id(payload["sub"])
        return user
    except Exception:
        return None


async def get_current_user_required(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:
    user = await get_current_user_optional(request, authorization)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
        )
    return user


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/signup", response_model=AuthResponse)
async def signup(body: SignUpRequest, mongodb: MongoDBService = Depends(_get_mongodb)) -> AuthResponse:
    norm_email = body.email.lower().strip()
    existing = await mongodb.get_user_by_email(norm_email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please sign in.",
        )

    # Hash password using bcrypt
    hashed = bcrypt.hashpw(body.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user = await mongodb.create_user(
        email=norm_email,
        name=body.name.strip(),
        hashed_password=hashed,
        tenant_id=body.tenant_id or "default",
    )

    token = create_access_token(user)
    return AuthResponse(
        token=token,
        user=UserProfile(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            tenant_id=user["tenant_id"],
            created_at=user["created_at"],
        ),
        mongodb_connected=mongodb.is_connected,
    )


@router.post("/signin", response_model=AuthResponse)
async def signin(body: SignInRequest, mongodb: MongoDBService = Depends(_get_mongodb)) -> AuthResponse:
    norm_email = body.email.lower().strip()
    user = await mongodb.get_user_by_email(norm_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # Verify password
    hashed = user.get("hashed_password", "")
    try:
        valid = bcrypt.checkpw(body.password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        valid = False

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token(user)
    return AuthResponse(
        token=token,
        user=UserProfile(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            tenant_id=user.get("tenant_id", "default"),
            created_at=user.get("created_at", ""),
        ),
        mongodb_connected=mongodb.is_connected,
    )


@router.get("/me")
async def get_me(
    user: Dict[str, Any] = Depends(get_current_user_required),
    mongodb: MongoDBService = Depends(_get_mongodb),
) -> Dict[str, Any]:
    return {
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "tenant_id": user.get("tenant_id", "default"),
            "created_at": user.get("created_at", ""),
        },
        "mongodb_connected": mongodb.is_connected,
    }
