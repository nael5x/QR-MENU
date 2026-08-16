import os
import uuid
import logging
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any

import jwt
import bcrypt
import requests
from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel, EmailStr, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
TOKEN_DAYS = 30

EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "qr-menu-saas"

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("qr_menu")

app = FastAPI(title="QR Menu SaaS API")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

# ---------------------------------------------------------------------------
# Object storage helpers
# ---------------------------------------------------------------------------
_storage_key: Optional[str] = None


def _init_storage() -> Optional[str]:
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_KEY:
        return None
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
        return _storage_key
    except Exception as e:
        logger.error(f"storage init failed: {e}")
        return None


def _put_object(path: str, data: bytes, content_type: str) -> dict:
    global _storage_key
    key = _init_storage()
    if not key:
        raise HTTPException(500, "Storage not configured")
    r = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if r.status_code == 503:
        _storage_key = None
        key = _init_storage()
        r = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    r.raise_for_status()
    return r.json()


def _get_object(path: str) -> tuple[bytes, str]:
    global _storage_key
    key = _init_storage()
    if not key:
        raise HTTPException(404, "Not found")
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if r.status_code == 503:
        _storage_key = None
        key = _init_storage()
        r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if r.status_code >= 400:
        raise HTTPException(404, "Not found")
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


# ---------------------------------------------------------------------------
# Utils
# ---------------------------------------------------------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return uuid.uuid4().hex


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def make_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "sub": user["id"],
        "tenant_id": user["tenant_id"],
        "role": user["role"],
        "iat": now,
        "exp": now + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(claims, JWT_SECRET, algorithm=JWT_ALG)


def clean(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc = {k: v for k, v in doc.items() if k != "_id"}
    return doc


async def log_change(tenant_id: str, user: dict, action: str, entity: str, entity_id: str, details: Dict[str, Any]):
    await db.change_logs.insert_one({
        "id": new_id(),
        "tenant_id": tenant_id,
        "user_id": user["id"],
        "user_email": user["email"],
        "action": action,
        "entity": entity,
        "entity_id": entity_id,
        "details": details,
        "created_at": now_iso(),
    })


# ---------------------------------------------------------------------------
# Auth dependencies
# ---------------------------------------------------------------------------
async def current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token")
    user = await db.users.find_one({"id": payload.get("sub"), "is_active": True})
    if not user:
        raise HTTPException(401, "User inactive or missing")
    return clean(user)


async def require_admin(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(403, "Admin role required")
    return user


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    restaurant_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    languages: Optional[List[str]] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    languages: Optional[List[str]] = None
    orders_enabled: Optional[bool] = None


class StaffIn(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class BranchIn(BaseModel):
    name: str
    address: Optional[str] = ""
    phone: Optional[str] = ""


class BranchUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    orders_enabled: Optional[bool] = None


class TableIn(BaseModel):
    label: str


class CategoryIn(BaseModel):
    branch_id: str
    name: Dict[str, str]
    sort_order: Optional[int] = 0


class CategoryUpdate(BaseModel):
    name: Optional[Dict[str, str]] = None
    sort_order: Optional[int] = None
    visible: Optional[bool] = None


class AddonModel(BaseModel):
    name: Dict[str, str]
    price: float = 0.0


class ItemIn(BaseModel):
    branch_id: str
    category_id: str
    name: Dict[str, str]
    description: Optional[Dict[str, str]] = None
    price: float
    image_url: Optional[str] = None
    addons: Optional[List[AddonModel]] = None
    visible: Optional[bool] = True
    available: Optional[bool] = True


class ItemUpdate(BaseModel):
    name: Optional[Dict[str, str]] = None
    description: Optional[Dict[str, str]] = None
    price: Optional[float] = None
    image_url: Optional[str] = None
    addons: Optional[List[AddonModel]] = None
    category_id: Optional[str] = None


class ToggleIn(BaseModel):
    value: bool


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
def _public_user(u: dict) -> dict:
    return {"id": u["id"], "email": u["email"], "name": u.get("name", ""), "role": u["role"], "tenant_id": u["tenant_id"]}


@api.post("/auth/register")
async def register(data: RegisterIn):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "البريد الإلكتروني مستخدم بالفعل")
    tenant_id = new_id()
    restaurant = {
        "id": tenant_id,
        "name": data.restaurant_name,
        "languages": data.languages or ["ar"],
        "orders_enabled": True,
        "created_at": now_iso(),
    }
    await db.restaurants.insert_one(restaurant)
    user = {
        "id": new_id(),
        "tenant_id": tenant_id,
        "name": "المدير",
        "email": email,
        "password_hash": hash_pw(data.password),
        "role": "admin",
        "is_active": True,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    token = make_token(user)
    return {"access_token": token, "user": _public_user(user), "restaurant": clean(restaurant)}


@api.post("/auth/login")
async def login(data: LoginIn):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_pw(data.password, user["password_hash"]) or not user.get("is_active", True):
        raise HTTPException(401, "بيانات الدخول غير صحيحة")
    restaurant = await db.restaurants.find_one({"id": user["tenant_id"]})
    token = make_token(user)
    return {"access_token": token, "user": _public_user(user), "restaurant": clean(restaurant)}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    restaurant = await db.restaurants.find_one({"id": user["tenant_id"]})
    return {"user": _public_user(user), "restaurant": clean(restaurant)}


# ---------------------------------------------------------------------------
# Restaurant
# ---------------------------------------------------------------------------
@api.get("/restaurant")
async def get_restaurant(user: dict = Depends(current_user)):
    r = await db.restaurants.find_one({"id": user["tenant_id"]})
    return clean(r)


@api.patch("/restaurant")
async def update_restaurant(data: RestaurantUpdate, admin: dict = Depends(require_admin)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields")
    await db.restaurants.update_one({"id": admin["tenant_id"]}, {"$set": updates})
    if "orders_enabled" in updates:
        await log_change(admin["tenant_id"], admin, "toggle_orders", "restaurant", admin["tenant_id"], {"orders_enabled": updates["orders_enabled"]})
    if "languages" in updates:
        await log_change(admin["tenant_id"], admin, "update_languages", "restaurant", admin["tenant_id"], {"languages": updates["languages"]})
    r = await db.restaurants.find_one({"id": admin["tenant_id"]})
    return clean(r)


# ---------------------------------------------------------------------------
# Staff
# ---------------------------------------------------------------------------
@api.get("/staff")
async def list_staff(admin: dict = Depends(require_admin)):
    cursor = db.users.find({"tenant_id": admin["tenant_id"], "role": "staff"})
    return [_public_user(u) async for u in cursor]


@api.post("/staff", status_code=201)
async def create_staff(data: StaffIn, admin: dict = Depends(require_admin)):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "البريد الإلكتروني مستخدم بالفعل")
    user = {
        "id": new_id(),
        "tenant_id": admin["tenant_id"],
        "name": data.name,
        "email": email,
        "password_hash": hash_pw(data.password),
        "role": "staff",
        "is_active": True,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    await log_change(admin["tenant_id"], admin, "create_staff", "user", user["id"], {"email": email})
    return _public_user(user)


@api.delete("/staff/{staff_id}")
async def delete_staff(staff_id: str, admin: dict = Depends(require_admin)):
    res = await db.users.delete_one({"id": staff_id, "tenant_id": admin["tenant_id"], "role": "staff"})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    await log_change(admin["tenant_id"], admin, "delete_staff", "user", staff_id, {})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Branches
# ---------------------------------------------------------------------------
@api.get("/branches")
async def list_branches(user: dict = Depends(current_user)):
    cursor = db.branches.find({"tenant_id": user["tenant_id"]}).sort("created_at", 1)
    out = []
    async for b in cursor:
        b = clean(b)
        b["table_count"] = await db.tables.count_documents({"branch_id": b["id"]})
        out.append(b)
    return out


@api.post("/branches", status_code=201)
async def create_branch(data: BranchIn, admin: dict = Depends(require_admin)):
    branch = {
        "id": new_id(),
        "tenant_id": admin["tenant_id"],
        "name": data.name,
        "address": data.address or "",
        "phone": data.phone or "",
        "orders_enabled": True,
        "created_at": now_iso(),
    }
    await db.branches.insert_one(branch)
    await log_change(admin["tenant_id"], admin, "create_branch", "branch", branch["id"], {"name": data.name})
    return clean(branch)


@api.patch("/branches/{branch_id}")
async def update_branch(branch_id: str, data: BranchUpdate, admin: dict = Depends(require_admin)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    res = await db.branches.update_one({"id": branch_id, "tenant_id": admin["tenant_id"]}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    if "orders_enabled" in updates:
        await log_change(admin["tenant_id"], admin, "toggle_branch_orders", "branch", branch_id, {"orders_enabled": updates["orders_enabled"]})
    b = await db.branches.find_one({"id": branch_id})
    return clean(b)


@api.delete("/branches/{branch_id}")
async def delete_branch(branch_id: str, admin: dict = Depends(require_admin)):
    res = await db.branches.delete_one({"id": branch_id, "tenant_id": admin["tenant_id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    await db.tables.delete_many({"branch_id": branch_id})
    await db.menu_categories.delete_many({"branch_id": branch_id})
    await db.menu_items.delete_many({"branch_id": branch_id})
    await log_change(admin["tenant_id"], admin, "delete_branch", "branch", branch_id, {})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------
@api.get("/branches/{branch_id}/tables")
async def list_tables(branch_id: str, user: dict = Depends(current_user)):
    branch = await db.branches.find_one({"id": branch_id, "tenant_id": user["tenant_id"]})
    if not branch:
        raise HTTPException(404, "Branch not found")
    cursor = db.tables.find({"branch_id": branch_id}).sort("created_at", 1)
    return [clean(t) async for t in cursor]


@api.post("/branches/{branch_id}/tables", status_code=201)
async def create_table(branch_id: str, data: TableIn, admin: dict = Depends(require_admin)):
    branch = await db.branches.find_one({"id": branch_id, "tenant_id": admin["tenant_id"]})
    if not branch:
        raise HTTPException(404, "Branch not found")
    table = {
        "id": new_id(),
        "tenant_id": admin["tenant_id"],
        "branch_id": branch_id,
        "label": data.label,
        "qr_token": new_id(),
        "created_at": now_iso(),
    }
    await db.tables.insert_one(table)
    await log_change(admin["tenant_id"], admin, "create_table", "table", table["id"], {"label": data.label, "branch_id": branch_id})
    return clean(table)


@api.delete("/tables/{table_id}")
async def delete_table(table_id: str, admin: dict = Depends(require_admin)):
    res = await db.tables.delete_one({"id": table_id, "tenant_id": admin["tenant_id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    await log_change(admin["tenant_id"], admin, "delete_table", "table", table_id, {})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Menu categories
# ---------------------------------------------------------------------------
@api.get("/branches/{branch_id}/categories")
async def list_categories(branch_id: str, user: dict = Depends(current_user)):
    cursor = db.menu_categories.find({"branch_id": branch_id, "tenant_id": user["tenant_id"]}).sort("sort_order", 1)
    return [clean(c) async for c in cursor]


@api.post("/categories", status_code=201)
async def create_category(data: CategoryIn, admin: dict = Depends(require_admin)):
    branch = await db.branches.find_one({"id": data.branch_id, "tenant_id": admin["tenant_id"]})
    if not branch:
        raise HTTPException(404, "Branch not found")
    cat = {
        "id": new_id(),
        "tenant_id": admin["tenant_id"],
        "branch_id": data.branch_id,
        "name": data.name,
        "sort_order": data.sort_order or 0,
        "visible": True,
        "created_at": now_iso(),
    }
    await db.menu_categories.insert_one(cat)
    await log_change(admin["tenant_id"], admin, "create_category", "category", cat["id"], {"name": data.name})
    return clean(cat)


@api.patch("/categories/{cat_id}")
async def update_category(cat_id: str, data: CategoryUpdate, admin: dict = Depends(require_admin)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    res = await db.menu_categories.update_one({"id": cat_id, "tenant_id": admin["tenant_id"]}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    if "visible" in updates:
        await log_change(admin["tenant_id"], admin, "toggle_category_visibility", "category", cat_id, {"visible": updates["visible"]})
    c = await db.menu_categories.find_one({"id": cat_id})
    return clean(c)


@api.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, admin: dict = Depends(require_admin)):
    res = await db.menu_categories.delete_one({"id": cat_id, "tenant_id": admin["tenant_id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    await db.menu_items.delete_many({"category_id": cat_id})
    await log_change(admin["tenant_id"], admin, "delete_category", "category", cat_id, {})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Menu items
# ---------------------------------------------------------------------------
@api.get("/branches/{branch_id}/items")
async def list_items(branch_id: str, user: dict = Depends(current_user)):
    cursor = db.menu_items.find({"branch_id": branch_id, "tenant_id": user["tenant_id"]}).sort("created_at", 1)
    return [clean(i) async for i in cursor]


@api.post("/items", status_code=201)
async def create_item(data: ItemIn, admin: dict = Depends(require_admin)):
    branch = await db.branches.find_one({"id": data.branch_id, "tenant_id": admin["tenant_id"]})
    if not branch:
        raise HTTPException(404, "Branch not found")
    item = {
        "id": new_id(),
        "tenant_id": admin["tenant_id"],
        "branch_id": data.branch_id,
        "category_id": data.category_id,
        "name": data.name,
        "description": data.description or {},
        "price": data.price,
        "image_url": data.image_url,
        "addons": [a.model_dump() for a in (data.addons or [])],
        "visible": data.visible if data.visible is not None else True,
        "available": data.available if data.available is not None else True,
        "created_at": now_iso(),
    }
    await db.menu_items.insert_one(item)
    await log_change(admin["tenant_id"], admin, "create_item", "item", item["id"], {"name": data.name, "price": data.price})
    return clean(item)


@api.patch("/items/{item_id}")
async def update_item(item_id: str, data: ItemUpdate, admin: dict = Depends(require_admin)):
    existing = await db.menu_items.find_one({"id": item_id, "tenant_id": admin["tenant_id"]})
    if not existing:
        raise HTTPException(404, "Not found")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    await db.menu_items.update_one({"id": item_id}, {"$set": updates})
    if "price" in updates and updates["price"] != existing.get("price"):
        await log_change(admin["tenant_id"], admin, "update_price", "item", item_id, {"old": existing.get("price"), "new": updates["price"]})
    i = await db.menu_items.find_one({"id": item_id})
    return clean(i)


@api.patch("/items/{item_id}/availability")
async def toggle_availability(item_id: str, data: ToggleIn, admin: dict = Depends(require_admin)):
    res = await db.menu_items.update_one({"id": item_id, "tenant_id": admin["tenant_id"]}, {"$set": {"available": data.value}})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    await log_change(admin["tenant_id"], admin, "toggle_availability", "item", item_id, {"available": data.value})
    i = await db.menu_items.find_one({"id": item_id})
    return clean(i)


@api.patch("/items/{item_id}/visibility")
async def toggle_visibility(item_id: str, data: ToggleIn, admin: dict = Depends(require_admin)):
    res = await db.menu_items.update_one({"id": item_id, "tenant_id": admin["tenant_id"]}, {"$set": {"visible": data.value}})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    await log_change(admin["tenant_id"], admin, "toggle_visibility", "item", item_id, {"visible": data.value})
    i = await db.menu_items.find_one({"id": item_id})
    return clean(i)


@api.delete("/items/{item_id}")
async def delete_item(item_id: str, admin: dict = Depends(require_admin)):
    res = await db.menu_items.delete_one({"id": item_id, "tenant_id": admin["tenant_id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    await log_change(admin["tenant_id"], admin, "delete_item", "item", item_id, {})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Change logs & dashboard
# ---------------------------------------------------------------------------
@api.get("/change-logs")
async def get_change_logs(admin: dict = Depends(require_admin)):
    cursor = db.change_logs.find({"tenant_id": admin["tenant_id"]}).sort("created_at", -1).limit(100)
    return [clean(c) async for c in cursor]


@api.get("/dashboard")
async def dashboard(user: dict = Depends(current_user)):
    tid = user["tenant_id"]
    restaurant = await db.restaurants.find_one({"id": tid})
    return {
        "branches": await db.branches.count_documents({"tenant_id": tid}),
        "tables": await db.tables.count_documents({"tenant_id": tid}),
        "categories": await db.menu_categories.count_documents({"tenant_id": tid}),
        "items": await db.menu_items.count_documents({"tenant_id": tid}),
        "unavailable_items": await db.menu_items.count_documents({"tenant_id": tid, "available": False}),
        "orders_enabled": restaurant.get("orders_enabled", True) if restaurant else True,
    }


# ---------------------------------------------------------------------------
# Image upload / serving
# ---------------------------------------------------------------------------
@api.post("/upload")
async def upload(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    data = await file.read()
    ext = (file.filename or "img.jpg").split(".")[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp", "heic"):
        ext = "jpg"
    path = f"{APP_NAME}/uploads/{admin['tenant_id']}/{new_id()}.{ext}"
    content_type = file.content_type or "image/jpeg"
    await run_in_threadpool(_put_object, path, data, content_type)
    await db.files.insert_one({
        "id": new_id(),
        "tenant_id": admin["tenant_id"],
        "storage_path": path,
        "content_type": content_type,
        "created_at": now_iso(),
    })
    return {"url": f"/api/files/{path}"}


@api.get("/files/{path:path}")
async def serve_file(path: str):
    content, content_type = await run_in_threadpool(_get_object, path)
    return Response(content=content, media_type=content_type, headers={"Cache-Control": "public, max-age=31536000"})


# ---------------------------------------------------------------------------
# Public customer menu (no auth)
# ---------------------------------------------------------------------------
@api.get("/public/menu/{qr_token}")
async def public_menu(qr_token: str):
    table = await db.tables.find_one({"qr_token": qr_token})
    if not table:
        raise HTTPException(404, "الطاولة غير موجودة أو الرمز غير صحيح")
    branch = await db.branches.find_one({"id": table["branch_id"]})
    restaurant = await db.restaurants.find_one({"id": table["tenant_id"]})
    if not branch or not restaurant:
        raise HTTPException(404, "غير موجود")

    cats_cursor = db.menu_categories.find({"branch_id": branch["id"], "visible": True}).sort("sort_order", 1)
    categories = []
    async for c in cats_cursor:
        c = clean(c)
        items_cursor = db.menu_items.find({"category_id": c["id"], "visible": True}).sort("created_at", 1)
        items = [clean(i) async for i in items_cursor]
        c["items"] = items
        categories.append(c)

    return {
        "restaurant": {"name": restaurant["name"], "languages": restaurant.get("languages", ["ar"])},
        "branch": {"id": branch["id"], "name": branch["name"], "orders_enabled": branch.get("orders_enabled", True) and restaurant.get("orders_enabled", True)},
        "table": {"id": table["id"], "label": table["label"]},
        "categories": categories,
    }


# ---------------------------------------------------------------------------
# App wiring
# ---------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"message": "QR Menu SaaS API"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.tables.create_index("qr_token", unique=True)
        await db.menu_items.create_index([("branch_id", 1), ("category_id", 1)])
    except Exception as e:
        logger.error(f"index creation: {e}")
    await run_in_threadpool(_init_storage)
    await seed_demo()


async def seed_demo():
    """Idempotent demo tenant for testing."""
    if await db.users.find_one({"email": "admin@demo.com"}):
        return
    tenant_id = new_id()
    await db.restaurants.insert_one({
        "id": tenant_id, "name": "مطعم الأصيل", "languages": ["ar", "en"],
        "orders_enabled": True, "created_at": now_iso(),
    })
    admin = {
        "id": new_id(), "tenant_id": tenant_id, "name": "المدير", "email": "admin@demo.com",
        "password_hash": hash_pw("demo1234"), "role": "admin", "is_active": True, "created_at": now_iso(),
    }
    await db.users.insert_one(admin)
    await db.users.insert_one({
        "id": new_id(), "tenant_id": tenant_id, "name": "موظف", "email": "staff@demo.com",
        "password_hash": hash_pw("demo1234"), "role": "staff", "is_active": True, "created_at": now_iso(),
    })
    branch_id = new_id()
    await db.branches.insert_one({
        "id": branch_id, "tenant_id": tenant_id, "name": "الفرع الرئيسي",
        "address": "شارع الملك فهد", "phone": "0500000000", "orders_enabled": True, "created_at": now_iso(),
    })
    await db.tables.insert_one({
        "id": new_id(), "tenant_id": tenant_id, "branch_id": branch_id, "label": "طاولة 1",
        "qr_token": "demo-table-1", "created_at": now_iso(),
    })
    cat_id = new_id()
    await db.menu_categories.insert_one({
        "id": cat_id, "tenant_id": tenant_id, "branch_id": branch_id,
        "name": {"ar": "المشاوي", "en": "Grills"}, "sort_order": 0, "visible": True, "created_at": now_iso(),
    })
    await db.menu_items.insert_one({
        "id": new_id(), "tenant_id": tenant_id, "branch_id": branch_id, "category_id": cat_id,
        "name": {"ar": "شيش طاووق", "en": "Shish Tawook"},
        "description": {"ar": "قطع دجاج متبلة مشوية", "en": "Grilled marinated chicken"},
        "price": 35.0, "image_url": None, "addons": [], "visible": True, "available": True, "created_at": now_iso(),
    })


@app.on_event("shutdown")
async def shutdown():
    client.close()
