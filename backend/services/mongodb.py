"""
MongoDB Atlas Service for User Authentication, Chat Sessions, and Message History.
Supports cloud MongoDB Atlas (via motor.motor_asyncio) with a resilient
in-memory fallback when MONGODB_URI is not yet configured.
"""
from __future__ import annotations

import asyncio
import datetime
import logging
import uuid
from typing import Any, Dict, List, Optional

from config import get_settings

logger = logging.getLogger(__name__)


class MongoDBService:
    def __init__(self) -> None:
        settings = get_settings()
        self._uri = settings.mongodb_uri.strip() if settings.mongodb_uri else ""
        self._db_name = settings.mongodb_db_name
        self._client = None
        self._db = None
        self._is_connected = False

        # In-memory fallback stores
        self._users: Dict[str, Dict[str, Any]] = {}  # email -> user
        self._users_by_id: Dict[str, Dict[str, Any]] = {}  # id -> user
        self._sessions: Dict[str, Dict[str, Any]] = {}  # session_id -> session
        self._messages: Dict[str, List[Dict[str, Any]]] = {}  # session_id -> [messages]

    async def init(self) -> None:
        if self._uri and self._uri.startswith("mongodb"):
            try:
                from motor.motor_asyncio import AsyncIOMotorClient

                self._client = AsyncIOMotorClient(
                    self._uri,
                    serverSelectionTimeoutMS=15000,
                )
                self._db = self._client[self._db_name]

                # Ping to verify connectivity
                await self._client.admin.command("ping")
                self._is_connected = True

                # Ensure indexes
                await self._db.users.create_index("email", unique=True)
                await self._db.chat_sessions.create_index("user_id")
                await self._db.messages.create_index("session_id")

                logger.info("MongoDB Atlas connected successfully to database '%s'", self._db_name)
                return
            except Exception as e:
                logger.warning("MongoDB Atlas connection failed (%s); operating in in-memory mode", e)
                self._is_connected = False
        else:
            logger.info("MONGODB_URI not configured; operating in high-performance in-memory mode")
            self._is_connected = False

    @property
    def is_connected(self) -> bool:
        return self._is_connected

    # -----------------------------------------------------------------------
    # Users
    # -----------------------------------------------------------------------

    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        norm_email = email.lower().strip()
        if self._is_connected and self._db is not None:
            try:
                user = await self._db.users.find_one({"email": norm_email})
                if user:
                    user["id"] = str(user.get("_id", user.get("id")))
                return user
            except Exception as e:
                logger.error("MongoDB get_user_by_email error: %s", e)

        return self._users.get(norm_email)

    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        if self._is_connected and self._db is not None:
            try:
                user = await self._db.users.find_one({"_id": user_id})
                if not user:
                    user = await self._db.users.find_one({"id": user_id})
                if user:
                    user["id"] = str(user.get("_id", user.get("id")))
                return user
            except Exception as e:
                logger.error("MongoDB get_user_by_id error: %s", e)

        return self._users_by_id.get(user_id)

    async def create_user(
        self, email: str, name: str, hashed_password: str, tenant_id: str = "default"
    ) -> Dict[str, Any]:
        norm_email = email.lower().strip()
        user_id = f"usr_{uuid.uuid4().hex[:12]}"
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        user_doc = {
            "id": user_id,
            "email": norm_email,
            "name": name.strip(),
            "hashed_password": hashed_password,
            "tenant_id": tenant_id,
            "created_at": now,
        }

        if self._is_connected and self._db is not None:
            try:
                doc = dict(user_doc)
                doc["_id"] = user_id
                await self._db.users.insert_one(doc)
                return user_doc
            except Exception as e:
                logger.error("MongoDB create_user error: %s; saving in-memory", e)

        self._users[norm_email] = user_doc
        self._users_by_id[user_id] = user_doc
        return user_doc

    # -----------------------------------------------------------------------
    # Chat Sessions
    # -----------------------------------------------------------------------

    async def create_session(
        self, user_id: str, title: str = "New Conversation", tenant_id: str = "default"
    ) -> Dict[str, Any]:
        session_id = f"sess_{uuid.uuid4().hex[:12]}"
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        session_doc = {
            "id": session_id,
            "user_id": user_id,
            "title": title,
            "tenant_id": tenant_id,
            "created_at": now,
            "updated_at": now,
            "message_count": 0,
        }

        if self._is_connected and self._db is not None:
            try:
                doc = dict(session_doc)
                doc["_id"] = session_id
                await self._db.chat_sessions.insert_one(doc)
                return session_doc
            except Exception as e:
                logger.error("MongoDB create_session error: %s", e)

        self._sessions[session_id] = session_doc
        self._messages[session_id] = []
        return session_doc

    async def get_session_by_id(self, session_id: str) -> Optional[Dict[str, Any]]:
        if self._is_connected and self._db is not None:
            try:
                session = await self._db.chat_sessions.find_one({"$or": [{"_id": session_id}, {"id": session_id}]})
                if session:
                    session["id"] = str(session.get("_id", session.get("id")))
                    session.pop("_id", None)
                return session
            except Exception as e:
                logger.error("MongoDB get_session_by_id error: %s", e)

        return self._sessions.get(session_id)

    async def get_user_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        if self._is_connected and self._db is not None:
            try:
                cursor = self._db.chat_sessions.find({"user_id": user_id}).sort("updated_at", -1)
                sessions = []
                async for s in cursor:
                    s["id"] = str(s.get("_id", s.get("id")))
                    s.pop("_id", None)
                    sessions.append(s)
                return sessions
            except Exception as e:
                logger.error("MongoDB get_user_sessions error: %s", e)

        user_sess = [s for s in self._sessions.values() if s.get("user_id") == user_id]
        return sorted(user_sess, key=lambda x: x.get("updated_at", ""), reverse=True)

    async def update_session_title(self, session_id: str, new_title: str) -> None:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        if self._is_connected and self._db is not None:
            try:
                await self._db.chat_sessions.update_one(
                    {"$or": [{"_id": session_id}, {"id": session_id}]},
                    {"$set": {"title": new_title, "updated_at": now}},
                )
                return
            except Exception as e:
                logger.error("MongoDB update_session_title error: %s", e)

        if session_id in self._sessions:
            self._sessions[session_id]["title"] = new_title
            self._sessions[session_id]["updated_at"] = now

    async def delete_session(self, session_id: str, user_id: str) -> bool:
        if self._is_connected and self._db is not None:
            try:
                res = await self._db.chat_sessions.delete_one(
                    {"$or": [{"_id": session_id}, {"id": session_id}], "user_id": user_id}
                )
                await self._db.messages.delete_many({"session_id": session_id})
                return res.deleted_count > 0
            except Exception as e:
                logger.error("MongoDB delete_session error: %s", e)

        if session_id in self._sessions and self._sessions[session_id].get("user_id") == user_id:
            del self._sessions[session_id]
            self._messages.pop(session_id, None)
            return True
        return False

    # -----------------------------------------------------------------------
    # Messages
    # -----------------------------------------------------------------------

    async def add_message(
        self,
        session_id: str,
        user_id: str,
        role: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        msg_id = f"msg_{uuid.uuid4().hex[:12]}"
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        msg_doc = {
            "id": msg_id,
            "session_id": session_id,
            "user_id": user_id,
            "role": role,
            "content": content,
            "timestamp": now,
        }
        if metadata:
            msg_doc.update(metadata)

        if self._is_connected and self._db is not None:
            try:
                doc = dict(msg_doc)
                doc["_id"] = msg_id
                await self._db.messages.insert_one(doc)
                # Update session timestamp & count
                await self._db.chat_sessions.update_one(
                    {"$or": [{"_id": session_id}, {"id": session_id}]},
                    {"$set": {"updated_at": now}, "$inc": {"message_count": 1}},
                )
                return msg_doc
            except Exception as e:
                logger.error("MongoDB add_message error: %s", e)

        if session_id not in self._messages:
            self._messages[session_id] = []
        self._messages[session_id].append(msg_doc)

        if session_id in self._sessions:
            self._sessions[session_id]["updated_at"] = now
            self._sessions[session_id]["message_count"] = len(self._messages[session_id])

        return msg_doc

    async def get_session_messages(self, session_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        if self._is_connected and self._db is not None:
            try:
                cursor = self._db.messages.find({"session_id": session_id}).sort("timestamp", 1).limit(limit)
                messages = []
                async for m in cursor:
                    m["id"] = str(m.get("_id", m.get("id")))
                    m.pop("_id", None)
                    messages.append(m)
                return messages
            except Exception as e:
                logger.error("MongoDB get_session_messages error: %s", e)

        return self._messages.get(session_id, [])
