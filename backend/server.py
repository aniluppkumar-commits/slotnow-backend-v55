from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Query, Request
from fastapi.security import HTTPBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta, date as date_cls
import jwt
import random
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
MOCK_OTP = os.environ.get("MOCK_OTP", "123456")

app = FastAPI()
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

Role = Literal["customer", "provider", "admin", "receptionist"]


# ---------- Models ----------
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    phone: str
    role: Role = "customer"
    name: Optional[str] = None
    email: Optional[str] = None
    avatar: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    language: Literal["en", "hi"] = "en"
    linked_provider_id: Optional[str] = None  # for receptionist / service assistant
    via_referral: bool = False  # signed up through a referral/share link
    referred_by: Optional[str] = None  # provider id or "app" the referral came from
    designation: Optional[str] = None  # for assistants: free-text role e.g. "Front Desk"
    is_blocked: bool = False  # provider can block an assistant's system access
    has_pin: bool = False  # whether a 4-digit PIN has been set (pin_hash kept out of model)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OTPRequest(BaseModel):
    phone: str
    role: Role = "customer"


class OTPVerify(BaseModel):
    phone: str
    otp: str
    role: Role = "customer"
    via_referral: bool = False
    ref: Optional[str] = None


class SetPinRequest(BaseModel):
    pin: str


class PinLoginRequest(BaseModel):
    phone: str
    role: Role = "customer"
    pin: str


class CreateAssistantRequest(BaseModel):
    name: str
    phone: str
    designation: Optional[str] = ""


class BlockToggleRequest(BaseModel):
    is_blocked: bool


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    avatar: Optional[str] = None
    address: Optional[str] = None
    language: Optional[Literal["en", "hi"]] = None


class LinkProviderRequest(BaseModel):
    provider_id: str


class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    name_hi: str
    icon: str
    color: str
    active: bool = True


class CategoryCreate(BaseModel):
    name: str
    name_hi: str
    icon: str
    color: str


class ProviderProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    business_name: str
    category_id: str
    # Sub-type inside a category (esp. Healthcare):
    #   "hospital" | "doctor_clinic" | "diagnostic_center" | "" (legacy / other categories)
    provider_type: str = ""
    # Doctor specialization (for doctor_clinic only, e.g. "Neurologist")
    specialization: str = ""
    # Free-form service tags used for search (e.g. ["X-ray", "MRI", "Blood test"])
    service_tags: List[str] = []
    bio: Optional[str] = ""
    city: str
    address: str  # now required
    contact_phone: Optional[str] = ""  # public number customers can call
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    image: Optional[str] = None
    rating: float = 0.0
    reviews_count: int = 0
    starting_price: int = 0
    approved: bool = False
    on_duty: bool = True
    daily_slot_limit: Optional[int] = None  # None = unlimited
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProviderProfileUpsert(BaseModel):
    business_name: str
    category_id: str
    provider_type: Optional[str] = ""
    specialization: Optional[str] = ""
    service_tags: Optional[List[str]] = None
    bio: Optional[str] = ""
    city: str
    address: str
    contact_phone: Optional[str] = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    image: Optional[str] = None


class DutyUpdate(BaseModel):
    on_duty: bool


class CapacityUpdate(BaseModel):
    daily_slot_limit: Optional[int] = None


class Service(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    provider_id: str
    name: str
    service_type: Optional[str] = "Consultation"
    description: Optional[str] = ""
    duration_min: int = 30
    price: int
    active: bool = True


class ServiceCreate(BaseModel):
    name: str
    service_type: Optional[str] = "Consultation"
    description: Optional[str] = ""
    duration_min: int = 30
    price: int


class AvailabilityRule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    provider_id: str
    weekday: int
    start_time: str
    end_time: str
    slot_duration: int = 30
    max_bookings: Optional[int] = None  # max bookings allowed for this shift (None = unlimited)


class AvailabilityCreate(BaseModel):
    weekday: int
    start_time: str
    end_time: str
    slot_duration: int = 30
    max_bookings: Optional[int] = None


class Booking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: Optional[str] = None
    customer_name: Optional[str] = ""
    customer_phone: Optional[str] = ""
    customer_address: Optional[str] = ""
    is_walkin: bool = False
    provider_id: str
    service_id: Optional[str] = None
    service_name: str
    price: int
    date: str
    start_time: str
    end_time: str
    status: Literal["pending", "confirmed", "rejected", "cancelled", "completed"] = "pending"
    notes: Optional[str] = ""
    # Automobile-category specific (None for all other categories)
    service_type: Optional[str] = None  # "Paid" | "Free"
    vehicle_reg_no: Optional[str] = None
    vehicle_model: Optional[str] = None
    # Hospital sub-doctor / sub-service (HospitalStaff.id) when booked under a hospital
    staff_id: Optional[str] = None
    staff_name: Optional[str] = ""
    staff_kind: Optional[str] = None  # "doctor" | "service"
    token_number: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BookingCreate(BaseModel):
    provider_id: str
    service_id: str
    date: str
    start_time: str
    notes: Optional[str] = ""
    service_type: Optional[str] = None  # Automobile only: "Paid" | "Free"
    vehicle_reg_no: Optional[str] = None
    vehicle_model: Optional[str] = None
    staff_id: Optional[str] = None  # optional hospital sub-doctor/service


class BookingUpdate(BaseModel):
    status: Optional[Literal["confirmed", "rejected", "cancelled", "completed"]] = None
    date: Optional[str] = None
    start_time: Optional[str] = None


class WalkinCreate(BaseModel):
    name: str
    phone: Optional[str] = ""
    address: Optional[str] = ""
    service_id: Optional[str] = None
    service_type: Optional[str] = None  # Automobile only: "Paid" | "Free"
    vehicle_reg_no: Optional[str] = None
    vehicle_model: Optional[str] = None


class Review(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    booking_id: str
    customer_id: str
    customer_name: str
    provider_id: str
    rating: int
    comment: Optional[str] = ""
    photos: List[str] = []  # up to 3 data-URL images (client-compressed)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReviewCreate(BaseModel):
    booking_id: str
    rating: int
    comment: Optional[str] = ""
    photos: Optional[List[str]] = None  # up to 3 data-URLs; enforced server-side


class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    body: str
    type: str = "info"
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# --- Hospital-managed staff (doctors + service centers) ---------------
class HospitalStaff(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    hospital_id: str  # parent ProviderProfile.id (must be provider_type=hospital)
    kind: Literal["doctor", "service"]
    name: str
    specialization: Optional[str] = ""  # only for doctors
    service_tags: List[str] = []  # only for service centers
    photo: Optional[str] = None
    address: Optional[str] = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class HospitalStaffUpsert(BaseModel):
    kind: Literal["doctor", "service"]
    name: str
    specialization: Optional[str] = ""
    service_tags: Optional[List[str]] = None
    photo: Optional[str] = None
    address: Optional[str] = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    active: Optional[bool] = True


# --- Assistant staff assignment ---------------------------------------
class AssistantAssignmentUpdate(BaseModel):
    staff_ids: List[str] = []  # HospitalStaff ids the assistant can manage


# --- Provider subscription plans (Razorpay) --------------------------
SUBSCRIPTION_PLANS = [
    {
        "id": "basic",
        "name": "Basic",
        "price_paise": 49900,
        "duration_days": 30,
        "features": ["Public page", "Up to 50 bookings / mo", "Email support"],
    },
    {
        "id": "pro",
        "name": "Pro",
        "price_paise": 129900,
        "duration_days": 90,
        "features": ["Everything in Basic", "Unlimited bookings", "Priority support", "Featured placement"],
    },
    {
        "id": "yearly",
        "name": "Business (Yearly)",
        "price_paise": 399900,
        "duration_days": 365,
        "features": ["Everything in Pro", "Custom branding", "Dedicated account manager"],
    },
]


class ProviderSubscription(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    provider_id: str
    plan_id: str
    status: Literal["created", "active", "expired", "cancelled", "failed"] = "created"
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    activated_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    amount_paise: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CreateOrderRequest(BaseModel):
    plan_id: str


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class SmsSettings(BaseModel):
    provider: Literal["mock", "twilio", "msg91", "whatsapp"] = "mock"
    api_key: str = ""
    sender_id: str = ""
    dlt_template_id: str = ""
    dlt_entity_id: str = ""
    dlt_variable_name: str = "num"
    enabled: bool = False


class PaymentSettings(BaseModel):
    provider: Literal["mock", "razorpay", "stripe", "paytm", "phonepe", "cashfree"] = "mock"
    api_key: str = ""
    api_secret: str = ""
    webhook_secret: str = ""
    enabled: bool = False


# ---------- Helpers ----------
def normalize_indian_phone(phone: str) -> str:
    """Normalize any Indian mobile format to 91XXXXXXXXXX (12 digits).

    Rules (in order): strip non-digits; 10-digit → prepend 91;
    12-digit starting 91 → unchanged; 11-digit starting 0 → drop 0 and add 91;
    anything else → returned as digits-only (caller may still reject).
    """
    digits = "".join(c for c in (phone or "") if c.isdigit())
    if len(digits) == 10:
        return f"91{digits}"
    if len(digits) == 12 and digits.startswith("91"):
        return digits
    if len(digits) == 11 and digits.startswith("0"):
        return f"91{digits[1:]}"
    return digits


def _generate_otp(digits: int = 4) -> str:
    import secrets
    return "".join(str(secrets.randbelow(10)) for _ in range(digits))


def _build_msg91_payload(settings: dict, phone_12: str, otp: str) -> dict:
    """Build the exact payload we will POST to MSG91 v5 /flow endpoint.

    Kept as a pure function so dry-run and test-send can share it.
    Any DLT variables the customer's template needs are populated
    from settings.dlt_variable_name (defaults to `num`).
    """
    var_name = settings.get("dlt_variable_name") or "num"
    return {
        "endpoint": "https://control.msg91.com/api/v5/flow/",
        "headers": {
            "authkey": settings.get("api_key", ""),
            "Content-Type": "application/json",
        },
        "body": {
            "template_id": settings.get("dlt_template_id", ""),
            "sender": settings.get("sender_id", ""),
            "short_url": "0",
            "recipients": [
                {"mobiles": phone_12, var_name: otp},
            ],
        },
    }


async def _dispatch_msg91(settings: dict, phone_12: str, otp: str) -> tuple[bool, str, dict | None]:
    """Fire a real MSG91 request. Returns (ok, message, raw_response)."""
    payload = _build_msg91_payload(settings, phone_12, otp)
    try:
        import httpx  # already a FastAPI runtime dep
    except ImportError:
        return False, "httpx not installed on backend", None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                payload["endpoint"], headers=payload["headers"], json=payload["body"]
            )
        raw = None
        try:
            raw = resp.json()
        except Exception:
            raw = {"text": resp.text}
        if resp.status_code == 200 and (raw or {}).get("type") == "success":
            return True, f"OTP sent to +{phone_12} via MSG91", raw
        return False, f"MSG91 responded HTTP {resp.status_code}: {raw}", raw
    except Exception as e:  # network error, DNS, timeout
        return False, f"MSG91 network error: {e}", None


def make_token(user_id: str, role: str) -> str:
    payload = {"uid": user_id, "role": role, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_pin(pin: str, pin_hash: str) -> bool:
    try:
        return bcrypt.checkpw(pin.encode("utf-8"), pin_hash.encode("utf-8"))
    except Exception:
        return False


async def current_user(authorization: Optional[str] = Header(default=None)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["uid"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    if user.get("is_blocked"):
        raise HTTPException(403, "Your access has been blocked. Please contact your provider.")
    return User(**user)


async def require_role(user: User, *roles: str) -> User:
    if user.role not in roles:
        raise HTTPException(403, "Forbidden")
    return user


async def push_notification(user_id: str, title: str, body: str, type_: str = "info"):
    n = Notification(user_id=user_id, title=title, body=body, type=type_)
    await db.notifications.insert_one(n.model_dump())


async def get_today_str() -> str:
    return datetime.now(timezone.utc).date().isoformat()


async def next_token_for(provider_id: str, date: str) -> int:
    """Atomic-ish token counter per provider+date."""
    state = await db.queue_state.find_one({"provider_id": provider_id, "date": date}, {"_id": 0})
    if not state:
        await db.queue_state.insert_one({
            "provider_id": provider_id, "date": date, "current_token": 0, "last_assigned": 0
        })
        last = 0
    else:
        last = state.get("last_assigned", 0)
    new_token = last + 1
    await db.queue_state.update_one(
        {"provider_id": provider_id, "date": date},
        {"$set": {"last_assigned": new_token}},
    )
    return new_token


async def seed_default_availability(provider_id: str):
    """Auto-create Mon–Sat 09:00–18:00 availability for a new provider."""
    existing = await db.availability.count_documents({"provider_id": provider_id})
    if existing > 0:
        return
    for wd in range(0, 6):  # Mon–Sat
        await db.availability.insert_one(
            AvailabilityRule(
                provider_id=provider_id, weekday=wd,
                start_time="09:00", end_time="18:00", slot_duration=30,
            ).model_dump()
        )


def _time_to_min(t: str) -> int:
    try:
        h, m = (t or "").split(":")
        return int(h) * 60 + int(m)
    except Exception:
        return 0


# App operates in India Standard Time (UTC+5:30). Slot/past-time checks must be
# evaluated in IST, not server UTC, otherwise same-day past slots leak through.
IST = timezone(timedelta(hours=5, minutes=30))


def _now_ist_naive() -> datetime:
    return datetime.now(IST).replace(tzinfo=None)


def _min_to_time(m: int) -> str:
    return f"{m//60:02d}:{m%60:02d}"


# ---------- Auth ----------
@api.post("/auth/send-otp")
async def send_otp(req: OTPRequest):
    """Send an OTP.

    - Always normalizes the phone to `91XXXXXXXXXX` before delivery.
    - When SMS settings row has `enabled: true` and provider `msg91` with
      a non-empty api_key, we generate a random 4-digit OTP, store it,
      and fire a real MSG91 request. `demo_otp` is NOT returned in this mode.
    - Otherwise we fall back to the fixed MOCK_OTP for dev — and return
      `demo_otp` in the response so preview logins keep working.
    """
    phone_12 = normalize_indian_phone(req.phone)
    settings = await db.settings.find_one({"key": "sms"}, {"_id": 0}) or {}
    live = bool(
        settings.get("enabled")
        and settings.get("provider") == "msg91"
        and settings.get("api_key")
    )
    if live:
        otp = _generate_otp(4)
        # Store the OTP so verify_otp can check against it
        await db.otps.update_one(
            {"phone": phone_12},
            {"$set": {"phone": phone_12, "otp": otp, "created_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        ok, note, _raw = await _dispatch_msg91(settings, phone_12, otp)
        if not ok:
            raise HTTPException(502, f"SMS provider error: {note}")
        return {"ok": True, "message": note, "channel": "sms", "provider_used": "msg91"}
    # Mock / demo path — kept only when no MSG91 config is enabled
    return {"ok": True, "message": "OTP sent (demo: use 123456)", "demo_otp": MOCK_OTP}


@api.post("/auth/verify-otp")
async def verify_otp(req: OTPVerify):
    phone_12 = normalize_indian_phone(req.phone)
    settings = await db.settings.find_one({"key": "sms"}, {"_id": 0}) or {}
    live_mode = bool(
        settings.get("enabled")
        and settings.get("provider") == "msg91"
        and settings.get("api_key")
    )
    stored = await db.otps.find_one({"phone": phone_12}, {"_id": 0})
    live_match = bool(stored and stored.get("otp") and req.otp == stored.get("otp"))
    if live_mode:
        # In live mode ONLY the stored OTP counts — no mock/demo fallback.
        if not live_match:
            raise HTTPException(400, "Invalid OTP")
    else:
        # Demo / dev mode — accept MOCK_OTP or any digit OTP (matches legacy behavior).
        if not (
            live_match
            or req.otp == MOCK_OTP
            or (len(req.otp) == 6 and req.otp.isdigit())
        ):
            raise HTTPException(400, "Invalid OTP")
    if live_match:
        await db.otps.delete_one({"phone": phone_12})
    user_doc = await db.users.find_one({"phone": {"$in": [req.phone, phone_12]}, "role": req.role}, {"_id": 0})
    if not user_doc:
        # Service Assistants cannot self-register. They must be created by a Provider.
        if req.role == "receptionist":
            raise HTTPException(403, "Unauthorized. Ask your service provider to add you as an assistant.")
        user = User(
            phone=req.phone,
            role=req.role,
            via_referral=bool(req.via_referral or req.ref),
            referred_by=req.ref if (req.via_referral or req.ref) else None,
        )
        await db.users.insert_one(user.model_dump())
        user_doc = user.model_dump()
    if user_doc.get("is_blocked"):
        raise HTTPException(403, "Your access has been blocked. Please contact your provider.")
    if req.role == "receptionist" and not user_doc.get("linked_provider_id"):
        raise HTTPException(403, "Unauthorized. Ask your service provider to add you as an assistant.")
    token = make_token(user_doc["id"], user_doc["role"])
    return {"token": token, "user": User(**user_doc).model_dump(mode="json")}


@api.post("/auth/set-pin")
async def set_pin(req: SetPinRequest, user: User = Depends(current_user)):
    """Authenticated user sets/changes their 4-digit PIN. Pass empty pin to remove."""
    if req.pin == "":
        await db.users.update_one({"id": user.id}, {"$set": {"has_pin": False}, "$unset": {"pin_hash": ""}})
        return {"ok": True, "has_pin": False}
    if not (len(req.pin) == 4 and req.pin.isdigit()):
        raise HTTPException(400, "PIN must be exactly 4 digits")
    await db.users.update_one(
        {"id": user.id},
        {"$set": {"pin_hash": hash_pin(req.pin), "has_pin": True}},
    )
    return {"ok": True, "has_pin": True}


@api.post("/auth/pin-login")
async def pin_login(req: PinLoginRequest):
    """Login with phone + role + 4-digit PIN (no OTP).

    Also honors a bootstrap PIN via env `BOOTSTRAP_ADMIN_PHONE` +
    `BOOTSTRAP_ADMIN_PIN` for the admin role — so an operator locked out by
    SMS failures can always regain access. On successful bootstrap match we
    ensure the admin user exists and lazily persist the pin_hash.
    """
    invalid = HTTPException(401, "Invalid phone or PIN")
    if not (len(req.pin) >= 4 and req.pin.isdigit()):
        raise invalid
    phone_12 = normalize_indian_phone(req.phone)

    # Bootstrap PIN check (admin role only, env-gated)
    boot_phone_raw = os.environ.get("BOOTSTRAP_ADMIN_PHONE", "").strip()
    boot_pin = os.environ.get("BOOTSTRAP_ADMIN_PIN", "").strip()
    if req.role == "admin" and boot_phone_raw and boot_pin:
        boot_phone_12 = normalize_indian_phone(boot_phone_raw)
        if phone_12 == boot_phone_12 and req.pin == boot_pin:
            admin_doc = await db.users.find_one(
                {"phone": {"$in": [boot_phone_raw, boot_phone_12]}, "role": "admin"},
                {"_id": 0},
            )
            if not admin_doc:
                admin = User(phone=boot_phone_12, role="admin", name="Bootstrap Admin", has_pin=True)
                doc = admin.model_dump()
                doc["pin_hash"] = hash_pin(boot_pin)
                await db.users.insert_one(doc)
                admin_doc = doc
            elif not admin_doc.get("pin_hash"):
                await db.users.update_one(
                    {"id": admin_doc["id"]},
                    {"$set": {"pin_hash": hash_pin(boot_pin), "has_pin": True}},
                )
                admin_doc["has_pin"] = True
            token = make_token(admin_doc["id"], admin_doc["role"])
            return {"token": token, "user": User(**admin_doc).model_dump(mode="json")}

    user_doc = await db.users.find_one(
        {
            "phone": {
                "$in": [
                    req.phone,
                    phone_12,
                    phone_12[2:] if phone_12.startswith("91") and len(phone_12) == 12 else phone_12,
                ]
            },
            "role": req.role,
        },
        {"_id": 0},
    )
    if not user_doc or not user_doc.get("pin_hash"):
        raise invalid
    if user_doc.get("is_blocked"):
        raise HTTPException(403, "Your access has been blocked. Please contact your provider.")
    if req.role == "receptionist" and not user_doc.get("linked_provider_id"):
        raise HTTPException(403, "Unauthorized. Ask your service provider to add you as an assistant.")
    if not verify_pin(req.pin, user_doc["pin_hash"]):
        raise invalid
    token = make_token(user_doc["id"], user_doc["role"])
    return {"token": token, "user": User(**user_doc).model_dump(mode="json")}


@api.get("/users/me")
async def get_me(user: User = Depends(current_user)):
    return user.model_dump(mode="json")


@api.put("/users/me")
async def update_me(data: UserUpdate, user: User = Depends(current_user)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        await db.users.update_one({"id": user.id}, {"$set": updates})
    fresh = await db.users.find_one({"id": user.id}, {"_id": 0})
    return User(**fresh).model_dump(mode="json")


@api.put("/users/me/link-provider")
async def link_provider(req: LinkProviderRequest, user: User = Depends(current_user)):
    """Receptionist links themselves to a provider."""
    await require_role(user, "receptionist")
    prov = await db.providers.find_one({"id": req.provider_id}, {"_id": 0})
    if not prov:
        raise HTTPException(404, "Provider not found")
    await db.users.update_one({"id": user.id}, {"$set": {"linked_provider_id": req.provider_id}})
    fresh = await db.users.find_one({"id": user.id}, {"_id": 0})
    return User(**fresh).model_dump(mode="json")


# ---------- Categories ----------
@api.get("/categories")
async def list_categories():
    docs = await db.categories.find({"active": True}, {"_id": 0}).to_list(100)
    # Healthcare always first; rest preserves insertion order
    docs.sort(key=lambda c: 0 if c["name"] == "Healthcare" else 1)
    return docs


def _slugify(name: str) -> str:
    s = (name or "").lower().strip()
    out = []
    prev_dash = False
    for ch in s:
        if ch.isalnum():
            out.append(ch)
            prev_dash = False
        elif not prev_dash:
            out.append("-")
            prev_dash = True
    return "".join(out).strip("-") or "cat"


# Default lists for the healthcare vertical — used both by the frontend
# dropdowns and by the customer search page.
DOCTOR_SPECIALIZATIONS = [
    "Physician", "Neurologist", "Cardiologist", "Orthopedic", "Gynecologist",
    "Pediatrician", "ENT Specialist", "Dermatologist", "Dentist",
    "Psychiatrist", "General Surgeon", "Ophthalmologist", "Urologist",
    "Gastroenterologist", "Endocrinologist", "Oncologist",
]

DIAGNOSTIC_SERVICES = [
    "X-ray", "MRI", "CT scan", "Ultrasound / USG", "ECG",
    "Blood test / Pathology", "Sonography", "Endoscopy",
    "Mammography", "PET scan", "Dialysis", "Vaccination",
]


@api.get("/reference/healthcare")
async def healthcare_reference():
    """Static reference lists used by provider onboarding and customer search."""
    return {
        "provider_types": [
            {"key": "hospital", "label": "Hospital"},
            {"key": "doctor_clinic", "label": "Doctor / Clinic"},
            {"key": "diagnostic_center", "label": "Diagnostic Center"},
        ],
        "specializations": DOCTOR_SPECIALIZATIONS,
        "services": DIAGNOSTIC_SERVICES,
    }


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    import math
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


@api.get("/search/providers")
async def search_providers(
    q: Optional[str] = None,
    city: Optional[str] = None,
    category_id: Optional[str] = None,
    specialization: Optional[str] = None,
    service: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    max_km: Optional[float] = None,
    limit: int = 50,
):
    """Public provider search + optional Haversine-based nearby sort.

    Any combination of filters can be used. When lat+lng are provided, results
    are enriched with a `distance_km` field and sorted by distance ascending
    (max_km defaults to 25 km when lat/lng given).
    """
    query: dict = {"approved": True}
    if city:
        query["city"] = {"$regex": f"^{city}$", "$options": "i"}
    if category_id:
        query["category_id"] = category_id
    if specialization:
        query["specialization"] = {"$regex": f"^{specialization}$", "$options": "i"}
    if service:
        query["service_tags"] = {"$regex": service, "$options": "i"}
    if q:
        query["$or"] = [
            {"business_name": {"$regex": q, "$options": "i"}},
            {"specialization": {"$regex": q, "$options": "i"}},
            {"bio": {"$regex": q, "$options": "i"}},
            {"service_tags": {"$regex": q, "$options": "i"}},
        ]
    if lat is not None and lng is not None:
        radius_m = float(max_km if max_km is not None else 25.0) * 1000
        pipeline = [
            {
                "$geoNear": {
                    "near": {"type": "Point", "coordinates": [float(lng), float(lat)]},
                    "distanceField": "distance_m",
                    "maxDistance": radius_m,
                    "spherical": True,
                    "query": query,
                }
            },
            {"$limit": max(1, limit)},
            {"$project": {"_id": 0}},
        ]
        try:
            docs = await db.providers.aggregate(pipeline).to_list(limit)
            for d in docs:
                if "distance_m" in d:
                    d["distance_km"] = round(d.pop("distance_m") / 1000.0, 2)
            return docs
        except Exception as e:
            # Fallback to Python Haversine loop if index missing or Mongo doesn't support $geoNear (rare)
            logger.warning(f"$geoNear failed, falling back to Haversine: {e}")
            providers = await db.providers.find(query, {"_id": 0}).to_list(500)
            radius = float(max_km if max_km is not None else 25.0)
            enriched = []
            for p in providers:
                plat, plng = p.get("latitude"), p.get("longitude")
                if plat is None or plng is None:
                    continue
                d = _haversine_km(float(lat), float(lng), float(plat), float(plng))
                if d <= radius:
                    p["distance_km"] = round(d, 2)
                    enriched.append(p)
            enriched.sort(key=lambda r: r["distance_km"])
            return enriched[:limit]

    providers = await db.providers.find(query, {"_id": 0}).to_list(500)
    providers.sort(key=lambda r: (-(r.get("rating") or 0), r.get("business_name") or ""))
    return providers[:limit]


@api.get("/city/{city_slug}")
async def city_public_page(city_slug: str):
    """Public endpoint powering `/city/:cityName` SEO pages. Groups all approved
    providers in the given city by category so the page can render a directory."""
    city_slug = city_slug.lower()
    all_providers = await db.providers.find({"approved": True}, {"_id": 0}).to_list(2000)
    matches = [p for p in all_providers if _slugify(p.get("city", "")) == city_slug]
    if not matches:
        raise HTTPException(404, "City not found")
    display_city = matches[0].get("city", city_slug.replace("-", " ").title())
    cats = await db.categories.find({"active": True}, {"_id": 0}).to_list(100)
    cat_by_id = {c["id"]: c for c in cats}
    groups = {}
    for p in matches:
        cid = p.get("category_id")
        if cid not in cat_by_id:
            continue
        groups.setdefault(cid, []).append(p)
    grouped = [
        {
            "category": cat_by_id[cid],
            "providers": sorted(ps, key=lambda r: -(r.get("rating") or 0))[:12],
            "total": len(ps),
        }
        for cid, ps in groups.items()
    ]
    grouped.sort(key=lambda g: -g["total"])
    return {"city": display_city, "slug": city_slug, "groups": grouped, "total": len(matches)}


@api.get("/categories/by-slug/{slug}")
async def category_by_slug(slug: str, city: Optional[str] = None):
    """Public endpoint for /c/:slug pages. Returns the category and its approved
    providers (optionally filtered by city for long-tail SEO)."""
    slug = slug.lower()
    cats = await db.categories.find({"active": True}, {"_id": 0}).to_list(100)
    match = next((c for c in cats if _slugify(c["name"]) == slug or _slugify(c.get("name_hi", "")) == slug), None)
    if not match:
        raise HTTPException(404, "Category not found")
    query = {"category_id": match["id"], "approved": True}
    if city:
        query["city"] = {"$regex": f"^{city}$", "$options": "i"}
    providers = await db.providers.find(query, {"_id": 0}).sort("rating", -1).to_list(200)
    cities_agg = await db.providers.aggregate([
        {"$match": {"category_id": match["id"], "approved": True, "city": {"$exists": True, "$nin": [None, ""]}}},
        {"$group": {"_id": "$city", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]).to_list(20)
    cities = [{"name": c["_id"], "count": c["count"]} for c in cities_agg if c["_id"]]
    return {"category": match, "providers": providers, "cities": cities, "slug": slug}


@api.post("/categories")
async def create_category(c: CategoryCreate, user: User = Depends(current_user)):
    await require_role(user, "admin")
    cat = Category(**c.model_dump())
    await db.categories.insert_one(cat.model_dump())
    return cat.model_dump(mode="json")


# ---------- Providers ----------
@api.get("/providers")
async def list_providers(
    category_id: Optional[str] = None,
    q: Optional[str] = None,
    city: Optional[str] = None,
    min_rating: Optional[float] = None,
    max_price: Optional[int] = None,
):
    query = {"approved": True}
    if category_id:
        query["category_id"] = category_id
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if min_rating is not None:
        query["rating"] = {"$gte": min_rating}
    if max_price is not None:
        query["starting_price"] = {"$lte": max_price}
    if q:
        query["business_name"] = {"$regex": q, "$options": "i"}
    return await db.providers.find(query, {"_id": 0}).sort("rating", -1).to_list(200)


@api.get("/providers/{provider_id}")
async def get_provider(provider_id: str):
    p = await db.providers.find_one({"id": provider_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Not found")
    services = await db.services.find({"provider_id": provider_id, "active": True}, {"_id": 0}).to_list(100)
    reviews = await db.reviews.find({"provider_id": provider_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    cat = await db.categories.find_one({"id": p["category_id"]}, {"_id": 0})
    has_availability = (await db.availability.count_documents({"provider_id": provider_id})) > 0
    return {"provider": p, "services": services, "reviews": reviews, "category": cat, "has_availability": has_availability}


@api.get("/providers/me/profile")
async def my_provider_profile(user: User = Depends(current_user)):
    await require_role(user, "provider")
    return await db.providers.find_one({"user_id": user.id}, {"_id": 0})


@api.post("/providers/me/profile")
async def upsert_my_provider(data: ProviderProfileUpsert, user: User = Depends(current_user)):
    await require_role(user, "provider")
    if not (data.address or "").strip():
        raise HTTPException(400, "Address is required")
    payload = data.model_dump()
    # Mirror lat/lng into a GeoJSON `location` field for MongoDB 2dsphere index.
    if payload.get("latitude") is not None and payload.get("longitude") is not None:
        payload["location"] = {"type": "Point", "coordinates": [float(payload["longitude"]), float(payload["latitude"])]}
    existing = await db.providers.find_one({"user_id": user.id}, {"_id": 0})
    if existing:
        await db.providers.update_one({"id": existing["id"]}, {"$set": payload})
        return await db.providers.find_one({"id": existing["id"]}, {"_id": 0})
    profile = ProviderProfile(user_id=user.id, **data.model_dump())
    doc = profile.model_dump()
    if payload.get("location"):
        doc["location"] = payload["location"]
    await db.providers.insert_one(doc)
    await seed_default_availability(profile.id)
    return profile.model_dump(mode="json")


@api.put("/providers/me/duty")
async def set_duty(d: DutyUpdate, user: User = Depends(current_user)):
    await require_role(user, "provider")
    p = await db.providers.find_one({"user_id": user.id}, {"_id": 0})
    if not p:
        raise HTTPException(400, "Set up provider profile first")
    await db.providers.update_one({"id": p["id"]}, {"$set": {"on_duty": d.on_duty}})
    return await db.providers.find_one({"id": p["id"]}, {"_id": 0})


@api.put("/providers/me/capacity")
async def set_capacity(c: CapacityUpdate, user: User = Depends(current_user)):
    await require_role(user, "provider")
    p = await db.providers.find_one({"user_id": user.id}, {"_id": 0})
    if not p:
        raise HTTPException(400, "Set up provider profile first")
    await db.providers.update_one({"id": p["id"]}, {"$set": {"daily_slot_limit": c.daily_slot_limit}})
    return await db.providers.find_one({"id": p["id"]}, {"_id": 0})


# ---------- Services ----------
@api.get("/providers/me/services")
async def my_services(user: User = Depends(current_user)):
    await require_role(user, "provider")
    p = await db.providers.find_one({"user_id": user.id}, {"_id": 0})
    if not p:
        return []
    return await db.services.find({"provider_id": p["id"]}, {"_id": 0}).to_list(100)


@api.post("/providers/me/services")
async def add_service(s: ServiceCreate, user: User = Depends(current_user)):
    await require_role(user, "provider")
    p = await db.providers.find_one({"user_id": user.id}, {"_id": 0})
    if not p:
        raise HTTPException(400, "Set up provider profile first")
    svc = Service(provider_id=p["id"], **s.model_dump())
    await db.services.insert_one(svc.model_dump())
    prices = await db.services.find({"provider_id": p["id"], "active": True}, {"_id": 0}).to_list(100)
    if prices:
        await db.providers.update_one({"id": p["id"]}, {"$set": {"starting_price": min(x["price"] for x in prices)}})
    # Defensive: ensure default availability exists so new services aren't instantly "Fully booked"
    await seed_default_availability(p["id"])
    return svc.model_dump(mode="json")


@api.delete("/providers/me/services/{service_id}")
async def del_service(service_id: str, user: User = Depends(current_user)):
    await require_role(user, "provider")
    await db.services.delete_one({"id": service_id})
    return {"ok": True}


# ---------- Availability ----------
@api.get("/providers/me/availability")
async def my_availability(user: User = Depends(current_user)):
    await require_role(user, "provider")
    p = await db.providers.find_one({"user_id": user.id}, {"_id": 0})
    if not p:
        return []
    return await db.availability.find({"provider_id": p["id"]}, {"_id": 0}).to_list(100)


@api.post("/providers/me/availability")
async def add_availability(a: AvailabilityCreate, user: User = Depends(current_user)):
    await require_role(user, "provider")
    p = await db.providers.find_one({"user_id": user.id}, {"_id": 0})
    if not p:
        raise HTTPException(400, "Set up provider profile first")
    rule = AvailabilityRule(provider_id=p["id"], **a.model_dump())
    await db.availability.insert_one(rule.model_dump())
    return rule.model_dump(mode="json")


@api.delete("/providers/me/availability/{rule_id}")
async def del_availability(rule_id: str, user: User = Depends(current_user)):
    await require_role(user, "provider")
    await db.availability.delete_one({"id": rule_id})
    return {"ok": True}


# ---------- Service Assistant Management (Provider-controlled) ----------
async def _my_provider_or_400(user: User) -> dict:
    p = await db.providers.find_one({"user_id": user.id}, {"_id": 0})
    if not p:
        raise HTTPException(400, "Set up provider profile first")
    return p


@api.get("/providers/me/assistants")
async def list_my_assistants(user: User = Depends(current_user)):
    await require_role(user, "provider")
    p = await _my_provider_or_400(user)
    docs = await db.users.find(
        {"role": "receptionist", "linked_provider_id": p["id"]}, {"_id": 0, "pin_hash": 0}
    ).to_list(200)
    return [User(**d).model_dump(mode="json") for d in docs]


@api.post("/providers/me/assistants")
async def create_assistant(req: CreateAssistantRequest, user: User = Depends(current_user)):
    await require_role(user, "provider")
    p = await _my_provider_or_400(user)
    phone = (req.phone or "").strip()
    if not (req.name or "").strip() or not phone:
        raise HTTPException(400, "Name and mobile are required")
    existing = await db.users.find_one({"phone": phone, "role": "receptionist"}, {"_id": 0})
    if existing:
        if existing.get("linked_provider_id") and existing["linked_provider_id"] != p["id"]:
            raise HTTPException(409, "This mobile is already an assistant for another provider")
        await db.users.update_one(
            {"id": existing["id"]},
            {"$set": {
                "name": req.name.strip(),
                "designation": (req.designation or "").strip(),
                "linked_provider_id": p["id"],
                "is_blocked": False,
            }},
        )
        fresh = await db.users.find_one({"id": existing["id"]}, {"_id": 0, "pin_hash": 0})
        return User(**fresh).model_dump(mode="json")
    assistant = User(
        phone=phone,
        role="receptionist",
        name=req.name.strip(),
        designation=(req.designation or "").strip(),
        linked_provider_id=p["id"],
    )
    await db.users.insert_one(assistant.model_dump())
    return assistant.model_dump(mode="json")


@api.put("/providers/me/assistants/{assistant_id}/block")
async def toggle_assistant_block(assistant_id: str, req: BlockToggleRequest, user: User = Depends(current_user)):
    await require_role(user, "provider")
    p = await _my_provider_or_400(user)
    target = await db.users.find_one({"id": assistant_id, "role": "receptionist", "linked_provider_id": p["id"]}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Assistant not found")
    await db.users.update_one({"id": assistant_id}, {"$set": {"is_blocked": req.is_blocked}})
    fresh = await db.users.find_one({"id": assistant_id}, {"_id": 0, "pin_hash": 0})
    return User(**fresh).model_dump(mode="json")


@api.delete("/providers/me/assistants/{assistant_id}")
async def remove_assistant(assistant_id: str, user: User = Depends(current_user)):
    await require_role(user, "provider")
    p = await _my_provider_or_400(user)
    target = await db.users.find_one({"id": assistant_id, "role": "receptionist", "linked_provider_id": p["id"]}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Assistant not found")
    # Unlink + block rather than hard-delete to preserve any history references
    await db.users.update_one({"id": assistant_id}, {"$set": {"is_blocked": True, "linked_provider_id": None}})
    return {"ok": True}


@api.put("/providers/me/assistants/{assistant_id}/staff")
async def assign_assistant_staff(
    assistant_id: str,
    body: AssistantAssignmentUpdate,
    user: User = Depends(current_user),
):
    """Provider assigns the specific hospital staff (doctors / service centers)
    this assistant is allowed to manage. Empty list = all staff (default)."""
    await require_role(user, "provider")
    p = await _my_provider_or_400(user)
    target = await db.users.find_one(
        {"id": assistant_id, "role": "receptionist", "linked_provider_id": p["id"]},
        {"_id": 0},
    )
    if not target:
        raise HTTPException(404, "Assistant not found")
    # Validate every id belongs to this hospital
    if body.staff_ids:
        valid = await db.hospital_staff.count_documents(
            {"hospital_id": p["id"], "id": {"$in": body.staff_ids}}
        )
        if valid != len(body.staff_ids):
            raise HTTPException(400, "Some staff ids are invalid")
    await db.users.update_one(
        {"id": assistant_id},
        {"$set": {"assigned_staff_ids": body.staff_ids}},
    )
    return {"ok": True, "assigned_staff_ids": body.staff_ids}


# ---------- Hospital-managed staff (doctors + service centers) ----------
async def _my_hospital_or_400(user: User) -> dict:
    p = await _my_provider_or_400(user)
    if p.get("provider_type") != "hospital":
        raise HTTPException(400, "Only hospital-type providers can manage staff")
    return p


@api.get("/providers/me/staff")
async def list_my_staff(user: User = Depends(current_user)):
    await require_role(user, "provider")
    p = await _my_hospital_or_400(user)
    rows = await db.hospital_staff.find({"hospital_id": p["id"]}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return rows


@api.post("/providers/me/staff")
async def add_my_staff(body: HospitalStaffUpsert, user: User = Depends(current_user)):
    await require_role(user, "provider")
    p = await _my_hospital_or_400(user)
    doc = HospitalStaff(
        hospital_id=p["id"],
        kind=body.kind,
        name=body.name.strip(),
        specialization=(body.specialization or "").strip(),
        service_tags=body.service_tags or [],
        photo=body.photo,
        address=(body.address or "").strip(),
        latitude=body.latitude,
        longitude=body.longitude,
    )
    await db.hospital_staff.insert_one(doc.model_dump())
    return doc.model_dump(mode="json")


@api.patch("/providers/me/staff/{staff_id}")
async def update_my_staff(staff_id: str, body: HospitalStaffUpsert, user: User = Depends(current_user)):
    await require_role(user, "provider")
    p = await _my_hospital_or_400(user)
    exists = await db.hospital_staff.find_one({"id": staff_id, "hospital_id": p["id"]}, {"_id": 0})
    if not exists:
        raise HTTPException(404, "Staff not found")
    update = {
        "kind": body.kind,
        "name": body.name.strip(),
        "specialization": (body.specialization or "").strip(),
        "service_tags": body.service_tags or [],
        "photo": body.photo,
        "address": (body.address or "").strip(),
        "latitude": body.latitude,
        "longitude": body.longitude,
        "active": bool(body.active),
    }
    await db.hospital_staff.update_one({"id": staff_id}, {"$set": update})
    fresh = await db.hospital_staff.find_one({"id": staff_id}, {"_id": 0})
    return fresh


@api.delete("/providers/me/staff/{staff_id}")
async def delete_my_staff(staff_id: str, user: User = Depends(current_user)):
    await require_role(user, "provider")
    p = await _my_hospital_or_400(user)
    r = await db.hospital_staff.delete_one({"id": staff_id, "hospital_id": p["id"]})
    return {"ok": r.deleted_count > 0}


@api.get("/providers/{provider_id}/staff")
async def public_hospital_staff(provider_id: str):
    """Public list of a hospital's doctors + service centers (only active)."""
    p = await db.providers.find_one({"id": provider_id, "approved": True}, {"_id": 0})
    if not p or p.get("provider_type") != "hospital":
        return []
    rows = await db.hospital_staff.find(
        {"hospital_id": provider_id, "active": True}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return rows


# ---------- Razorpay subscriptions (providers only) ----------
def _razorpay_client():
    key = os.environ.get("RAZORPAY_KEY_ID", "").strip()
    secret = os.environ.get("RAZORPAY_KEY_SECRET", "").strip()
    if not key or not secret:
        raise HTTPException(503, "Payments not configured — set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET")
    import razorpay
    return razorpay.Client(auth=(key, secret))


@api.get("/subscriptions/plans")
async def subscription_plans():
    return SUBSCRIPTION_PLANS


@api.get("/subscriptions/me")
async def my_subscription(user: User = Depends(current_user)):
    await require_role(user, "provider")
    p = await _my_provider_or_400(user)
    active = await db.subscriptions.find_one(
        {"provider_id": p["id"], "status": "active"},
        {"_id": 0},
        sort=[("expires_at", -1)],
    )
    return {"active": bool(active), "subscription": active}


@api.post("/subscriptions/create-order")
async def create_subscription_order(body: CreateOrderRequest, user: User = Depends(current_user)):
    await require_role(user, "provider")
    p = await _my_provider_or_400(user)
    plan = next((pl for pl in SUBSCRIPTION_PLANS if pl["id"] == body.plan_id), None)
    if not plan:
        raise HTTPException(400, "Invalid plan")
    client = _razorpay_client()
    receipt = f"sub_{p['id'][:12]}_{uuid.uuid4().hex[:6]}"[:40]
    order = client.order.create({
        "amount": plan["price_paise"],
        "currency": "INR",
        "receipt": receipt,
        "notes": {"provider_id": p["id"], "plan_id": plan["id"]},
    })
    sub = ProviderSubscription(
        provider_id=p["id"], plan_id=plan["id"],
        amount_paise=plan["price_paise"], status="created",
        razorpay_order_id=order["id"],
    )
    await db.subscriptions.insert_one(sub.model_dump())
    return {
        "order_id": order["id"],
        "amount": plan["price_paise"],
        "currency": "INR",
        "key_id": os.environ.get("RAZORPAY_KEY_ID", ""),
        "plan": plan,
    }


@api.post("/subscriptions/verify")
async def verify_subscription(body: VerifyPaymentRequest, user: User = Depends(current_user)):
    await require_role(user, "provider")
    client = _razorpay_client()
    try:
        client.utility.verify_payment_signature({
            "razorpay_order_id": body.razorpay_order_id,
            "razorpay_payment_id": body.razorpay_payment_id,
            "razorpay_signature": body.razorpay_signature,
        })
    except razorpay_errors_module().SignatureVerificationError:
        raise HTTPException(400, "Invalid payment signature")
    sub = await db.subscriptions.find_one({"razorpay_order_id": body.razorpay_order_id}, {"_id": 0})
    if not sub:
        raise HTTPException(404, "Order not found")
    plan = next((pl for pl in SUBSCRIPTION_PLANS if pl["id"] == sub["plan_id"]), None)
    if not plan:
        raise HTTPException(400, "Plan missing")
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=plan["duration_days"])
    await db.subscriptions.update_one(
        {"id": sub["id"]},
        {"$set": {
            "status": "active",
            "razorpay_payment_id": body.razorpay_payment_id,
            "activated_at": now,
            "expires_at": expires,
        }},
    )
    return {"ok": True, "expires_at": expires.isoformat()}


def razorpay_errors_module():
    import razorpay
    return razorpay.errors


@app.post("/api/subscriptions/webhook", include_in_schema=False)
async def subscription_webhook(request: Request):
    """Razorpay webhook. Verifies signature and updates subscription status."""
    payload = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")
    if not secret:
        raise HTTPException(503, "Webhook secret not configured")
    try:
        import razorpay
        razorpay.Client(auth=("dummy", "dummy")).utility.verify_webhook_signature(
            payload.decode(), signature, secret
        )
    except Exception:
        raise HTTPException(400, "Invalid webhook signature")
    import json as _json
    data = _json.loads(payload.decode())
    event = data.get("event", "")
    entity = (data.get("payload") or {}).get("payment", {}).get("entity") or {}
    order_id = entity.get("order_id")
    if order_id:
        if event == "payment.captured":
            await db.subscriptions.update_one(
                {"razorpay_order_id": order_id},
                {"$set": {"razorpay_payment_id": entity.get("id")}},
            )
        elif event == "payment.failed":
            await db.subscriptions.update_one(
                {"razorpay_order_id": order_id},
                {"$set": {"status": "failed"}},
            )
    return {"ok": True}


# ---------- Slots ----------
@api.get("/providers/{provider_id}/slots")
async def get_slots(provider_id: str, date: str = Query(...), service_id: Optional[str] = None):
    """Shift-based availability. Returns the full shifts defined by the provider for that
    weekday (no 30-min sub-slots). `has_schedule` distinguishes 'No Schedule' from a day
    where all shifts are past/full."""
    try:
        d = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Bad date")
    weekday = d.weekday()
    rules = await db.availability.find({"provider_id": provider_id, "weekday": weekday}, {"_id": 0}).to_list(20)
    rules.sort(key=lambda r: _time_to_min(r["start_time"]))

    # Count non-walk-in bookings per shift start_time for this date
    bookings = await db.bookings.find(
        {"provider_id": provider_id, "date": date, "status": {"$in": ["pending", "confirmed"]}, "is_walkin": False}, {"_id": 0}
    ).to_list(500)
    booked_by_start: dict = {}
    for b in bookings:
        booked_by_start[b["start_time"]] = booked_by_start.get(b["start_time"], 0) + 1

    now = _now_ist_naive()
    today = now.date()
    current_min_today = now.hour * 60 + now.minute

    shifts = []
    for r in rules:
        s = _time_to_min(r["start_time"])
        e = _time_to_min(r["end_time"])
        # A shift is bookable until it ends (you can still join the queue mid-shift)
        in_past = d == today and e <= current_min_today
        booked = booked_by_start.get(r["start_time"], 0)
        max_b = r.get("max_bookings")
        is_full = max_b is not None and booked >= max_b
        shifts.append({
            "start_time": r["start_time"],
            "end_time": r["end_time"],
            "max_bookings": max_b,
            "booked": booked,
            "available": (not in_past) and (not is_full),
            "is_past": in_past,
            "is_full": is_full,
        })
    return {"has_schedule": len(rules) > 0, "shifts": shifts}



# ---------- Bookings ----------
async def _enrich_bookings(items: List[dict]) -> List[dict]:
    """Batch-enrich a list of bookings with provider and customer info in O(2) queries."""
    if not items:
        return []
    provider_ids = list({b["provider_id"] for b in items if b.get("provider_id")})
    customer_ids = list({b["customer_id"] for b in items if b.get("customer_id")})
    provs = {p["id"]: p for p in await db.providers.find({"id": {"$in": provider_ids}}, {"_id": 0}).to_list(len(provider_ids) or 1)}
    custs = {c["id"]: c for c in (await db.users.find({"id": {"$in": customer_ids}}, {"_id": 0}).to_list(len(customer_ids) or 1) if customer_ids else [])}
    out = []
    for b in items:
        b.setdefault("is_walkin", False)
        prov = provs.get(b.get("provider_id", ""), {})
        b["provider"] = {
            "business_name": prov.get("business_name", ""),
            "image": prov.get("image"),
            "city": prov.get("city", ""),
            "address": prov.get("address", ""),
        }
        if b.get("is_walkin"):
            b["customer"] = {"name": b.get("customer_name", "Walk-in"), "phone": b.get("customer_phone", ""), "address": b.get("customer_address", ""), "via_referral": False}
        elif b.get("customer_id"):
            cust = custs.get(b["customer_id"], {})
            b["customer"] = {"name": cust.get("name") or "Guest", "phone": cust.get("phone", ""), "address": cust.get("address", ""), "via_referral": bool(cust.get("via_referral"))}
        else:
            b["customer"] = {"name": "Guest", "phone": "", "address": "", "via_referral": False}
        out.append(b)
    return out


async def _enrich_booking(b: dict) -> dict:
    """Single-booking convenience wrapper around _enrich_bookings."""
    out = await _enrich_bookings([b])
    return out[0]


@api.post("/bookings")
async def create_booking(b: BookingCreate, user: User = Depends(current_user)):
    await require_role(user, "customer")
    try:
        datetime.strptime(f"{b.date} {b.start_time}", "%Y-%m-%d %H:%M")
    except ValueError:
        raise HTTPException(400, "Invalid date/time")
    svc = await db.services.find_one({"id": b.service_id}, {"_id": 0})
    if not svc:
        raise HTTPException(404, "Service not found")
    prov = await db.providers.find_one({"id": b.provider_id}, {"_id": 0})
    if not prov:
        raise HTTPException(404, "Provider not found")
    if not prov.get("on_duty", True):
        raise HTTPException(400, "Provider is off-duty. Try again later.")

    # Automobile-category specific required fields
    cat = await db.categories.find_one({"id": prov.get("category_id")}, {"_id": 0})
    is_auto = bool(cat and cat.get("name") == "Automobile")
    service_type = vehicle_reg_no = vehicle_model = None
    if is_auto:
        if b.service_type not in ("Paid", "Free"):
            raise HTTPException(400, "Select a Service Type (Paid or Free)")
        if not (b.vehicle_reg_no or "").strip():
            raise HTTPException(400, "Vehicle Registration Number is required")
        if not (b.vehicle_model or "").strip():
            raise HTTPException(400, "Model Number is required")
        service_type = b.service_type
        vehicle_reg_no = b.vehicle_reg_no.strip()
        vehicle_model = b.vehicle_model.strip()

    # Validate the chosen shift exists for this weekday (shift-based booking)
    try:
        bd = datetime.strptime(b.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Invalid date")
    shift = await db.availability.find_one(
        {"provider_id": b.provider_id, "weekday": bd.weekday(), "start_time": b.start_time}, {"_id": 0}
    )
    if not shift:
        raise HTTPException(400, "Selected shift is not available")
    shift_end = shift["end_time"]
    # Reject only if the entire shift is already over (mid-shift joining is allowed)
    now_ist = _now_ist_naive()
    if bd == now_ist.date() and _time_to_min(shift_end) <= (now_ist.hour * 60 + now_ist.minute):
        raise HTTPException(400, "This shift has already ended")

    # Per-shift capacity (None = unlimited)
    max_b = shift.get("max_bookings")
    if max_b is not None:
        shift_count = await db.bookings.count_documents({
            "provider_id": b.provider_id, "date": b.date, "start_time": b.start_time,
            "is_walkin": False, "status": {"$in": ["pending", "confirmed"]},
        })
        if shift_count >= max_b:
            raise HTTPException(409, "This shift is fully booked")

    # Daily slot limit (None = unlimited)
    limit = prov.get("daily_slot_limit")
    if limit is not None:
        count_today = await db.bookings.count_documents({
            "provider_id": b.provider_id, "date": b.date,
            "status": {"$in": ["confirmed", "completed"]},
        })
        if count_today >= limit:
            raise HTTPException(409, f"Daily capacity ({limit}) reached for {b.date}")

    # Multi-booking guard: same customer + same provider + same date + same shift
    duplicate = await db.bookings.find_one({
        "customer_id": user.id, "provider_id": b.provider_id,
        "date": b.date, "start_time": b.start_time,
        "status": {"$in": ["pending", "confirmed"]},
    }, {"_id": 0})
    if duplicate:
        raise HTTPException(409, "You already have a booking with this provider in this shift")

    token = await next_token_for(b.provider_id, b.date)
    staff_name = ""
    staff_kind = None
    if b.staff_id:
        st = await db.hospital_staff.find_one(
            {"id": b.staff_id, "hospital_id": b.provider_id, "active": True}, {"_id": 0}
        )
        if st:
            staff_name = st.get("name", "")
            staff_kind = st.get("kind")
    booking = Booking(
        customer_id=user.id,
        customer_name=user.name or "",
        customer_phone=user.phone,
        provider_id=b.provider_id,
        service_id=b.service_id,
        service_name=svc["name"],
        price=svc["price"],
        date=b.date,
        start_time=b.start_time,
        end_time=shift_end,
        notes=b.notes or "",
        status="confirmed",  # Direct booking — no pending step
        service_type=service_type,
        vehicle_reg_no=vehicle_reg_no,
        vehicle_model=vehicle_model,
        staff_id=b.staff_id,
        staff_name=staff_name,
        staff_kind=staff_kind,
        token_number=token,
    )
    await db.bookings.insert_one(booking.model_dump())
    await push_notification(prov["user_id"], "New confirmed booking", f"{svc['name']} on {b.date} at {b.start_time} • Token #{token}", "booking")
    await push_notification(user.id, "Booking confirmed", f"Token #{token} • {svc['name']} on {b.date} at {b.start_time}", "booking")
    return booking.model_dump(mode="json")


@api.get("/bookings")
async def list_bookings(user: User = Depends(current_user), status: Optional[str] = None, include_archived: bool = False):
    if user.role == "customer":
        query = {"customer_id": user.id}
    elif user.role == "provider":
        p = await db.providers.find_one({"user_id": user.id}, {"_id": 0})
        if not p:
            return []
        query = {"provider_id": p["id"]}
    else:
        query = {}
    if status:
        query["status"] = status
    if not include_archived:
        query["archived"] = {"$ne": True}
    items = await db.bookings.find(query, {"_id": 0}).sort([("date", -1), ("token_number", 1)]).to_list(500)
    return await _enrich_bookings(items)


@api.delete("/bookings/{booking_id}")
async def delete_booking(booking_id: str, user: User = Depends(current_user)):
    """Hard-delete a booking — fully releases the slot (no 'cancelled' record left)."""
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Not found")
    if user.role == "customer" and b.get("customer_id") != user.id:
        raise HTTPException(403, "Forbidden")
    if user.role == "provider":
        p = await db.providers.find_one({"user_id": user.id}, {"_id": 0})
        if not p or p["id"] != b["provider_id"]:
            raise HTTPException(403, "Forbidden")
    await db.bookings.delete_one({"id": booking_id})
    return {"ok": True, "id": booking_id}


@api.post("/bookings/archive")
async def archive_history(user: User = Depends(current_user)):
    """Provider clears their history — soft-archives completed/cancelled/rejected."""
    await require_role(user, "provider")
    p = await db.providers.find_one({"user_id": user.id}, {"_id": 0})
    if not p:
        raise HTTPException(400, "No profile")
    res = await db.bookings.update_many(
        {"provider_id": p["id"], "status": {"$in": ["completed", "cancelled", "rejected"]}, "archived": {"$ne": True}},
        {"$set": {"archived": True}},
    )
    return {"archived": res.modified_count}


@api.post("/bookings/{booking_id}/reorder")
async def reorder_booking(booking_id: str, direction: str = Query("up"), user: User = Depends(current_user)):
    """Receptionist/provider swaps token_number with the adjacent booking."""
    pid = await _provider_id_for_user(user)
    b = await db.bookings.find_one({"id": booking_id, "provider_id": pid}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Not found")
    tn = b.get("token_number", 0)
    if tn <= 0:
        raise HTTPException(400, "Booking has no token")
    op = "$lt" if direction == "up" else "$gt"
    sort_dir = -1 if direction == "up" else 1
    neighbor = await db.bookings.find_one(
        {"provider_id": pid, "date": b["date"], "token_number": {op: tn}},
        {"_id": 0},
        sort=[("token_number", sort_dir)],
    )
    if not neighbor:
        return {"ok": False, "reason": "At edge"}
    n_tn = neighbor["token_number"]
    await db.bookings.update_one({"id": b["id"]}, {"$set": {"token_number": n_tn}})
    await db.bookings.update_one({"id": neighbor["id"]}, {"$set": {"token_number": tn}})
    return {"ok": True}


class ReorderBulk(BaseModel):
    date: str
    ordered_ids: List[str]


@api.post("/queue/reorder")
async def queue_reorder_bulk(req: ReorderBulk, user: User = Depends(current_user)):
    """Drag-and-drop bulk reorder: assigns token_number 1..N in the given order."""
    pid = await _provider_id_for_user(user)
    # Verify all ids belong to this provider+date
    existing = await db.bookings.find(
        {"provider_id": pid, "date": req.date, "id": {"$in": req.ordered_ids}}, {"_id": 0}
    ).to_list(500)
    valid_ids = {b["id"] for b in existing}
    for i, bid in enumerate(req.ordered_ids):
        if bid in valid_ids:
            await db.bookings.update_one({"id": bid}, {"$set": {"token_number": i + 1}})
    # last_assigned in queue_state stays the same
    return {"ok": True, "count": len([i for i in req.ordered_ids if i in valid_ids])}


@api.put("/bookings/{booking_id}")
async def update_booking(booking_id: str, u: BookingUpdate, user: User = Depends(current_user)):
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Not found")
    updates = {k: v for k, v in u.model_dump().items() if v is not None}
    if user.role == "customer" and b.get("customer_id") != user.id:
        raise HTTPException(403, "Forbidden")
    if user.role == "provider":
        p = await db.providers.find_one({"user_id": user.id}, {"_id": 0})
        if not p or p["id"] != b["provider_id"]:
            raise HTTPException(403, "Forbidden")
    if u.start_time and u.date:
        svc = await db.services.find_one({"id": b.get("service_id", "")}, {"_id": 0})
        dur = svc["duration_min"] if svc else 30
        updates["end_time"] = _min_to_time(_time_to_min(u.start_time) + dur)
    await db.bookings.update_one({"id": booking_id}, {"$set": updates})
    fresh = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if u.status == "confirmed" and b.get("customer_id"):
        await push_notification(b["customer_id"], "Booking confirmed", f"{b['service_name']} on {b['date']} at {b['start_time']} • Token #{b.get('token_number', '-')}", "booking")
    elif u.status == "rejected" and b.get("customer_id"):
        await push_notification(b["customer_id"], "Booking rejected", f"{b['service_name']} on {b['date']}", "booking")
    elif u.status == "cancelled":
        prov = await db.providers.find_one({"id": b["provider_id"]}, {"_id": 0})
        if prov:
            await push_notification(prov["user_id"], "Booking cancelled", f"{b['service_name']} on {b['date']} cancelled", "booking")
    return fresh


# ---------- Reviews ----------
@api.post("/reviews")
async def add_review(r: ReviewCreate, user: User = Depends(current_user)):
    await require_role(user, "customer")
    b = await db.bookings.find_one({"id": r.booking_id, "customer_id": user.id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Booking not found")
    existing = await db.reviews.find_one({"booking_id": r.booking_id}, {"_id": 0})
    if existing:
        raise HTTPException(400, "Already reviewed")
    rev = Review(
        booking_id=r.booking_id, customer_id=user.id,
        customer_name=user.name or "Customer", provider_id=b["provider_id"],
        rating=max(1, min(5, r.rating)), comment=(r.comment or "").strip()[:1000],
        photos=[p for p in (r.photos or []) if isinstance(p, str) and p.startswith("data:image/")][:3],
    )
    await db.reviews.insert_one(rev.model_dump())
    all_reviews = await db.reviews.find({"provider_id": b["provider_id"]}, {"_id": 0}).to_list(1000)
    avg = sum(x["rating"] for x in all_reviews) / len(all_reviews)
    await db.providers.update_one(
        {"id": b["provider_id"]}, {"$set": {"rating": round(avg, 1), "reviews_count": len(all_reviews)}}
    )
    return rev.model_dump(mode="json")


@api.get("/providers/{provider_id}/reviewable-booking")
async def reviewable_booking(provider_id: str, user: User = Depends(current_user)):
    """Return the most recent completed booking of the current customer with this
    provider that has NOT been reviewed yet. Used by the public provider page to
    show a personalised "Leave a review" CTA only to eligible customers."""
    if user.role != "customer":
        return {"eligible": False, "reason": "not_customer"}
    booking = await db.bookings.find_one(
        {"customer_id": user.id, "provider_id": provider_id, "status": "completed"},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    if not booking:
        return {"eligible": False, "reason": "no_completed_booking"}
    already = await db.reviews.find_one({"booking_id": booking["id"]}, {"_id": 0})
    if already:
        return {"eligible": False, "reason": "already_reviewed", "review_id": already.get("id")}
    return {"eligible": True, "booking_id": booking["id"]}


# ---------- Notifications ----------
@api.get("/notifications")
async def list_notifications(user: User = Depends(current_user)):
    return await db.notifications.find({"user_id": user.id}, {"_id": 0}).sort("created_at", -1).to_list(100)


@api.put("/notifications/{nid}/read")
async def mark_read(nid: str, user: User = Depends(current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user.id}, {"$set": {"read": True}})
    return {"ok": True}


# ---------- Queue / Walk-ins ----------
async def _provider_id_for_user(user: User) -> str:
    if user.role == "receptionist":
        if not user.linked_provider_id:
            raise HTTPException(400, "Receptionist not linked to a provider yet")
        return user.linked_provider_id
    if user.role == "provider":
        p = await db.providers.find_one({"user_id": user.id}, {"_id": 0})
        if not p:
            raise HTTPException(400, "Provider profile not set up")
        return p["id"]
    raise HTTPException(403, "Forbidden")


@api.get("/queue/today")
async def queue_today(user: User = Depends(current_user), date: Optional[str] = None):
    """Receptionist/provider: live queue list."""
    pid = await _provider_id_for_user(user)
    d = date or await get_today_str()
    items = await db.bookings.find(
        {"provider_id": pid, "date": d, "status": {"$nin": ["rejected"]}}, {"_id": 0}
    ).sort("token_number", 1).to_list(500)
    state = await db.queue_state.find_one({"provider_id": pid, "date": d}, {"_id": 0}) or {"current_token": 0, "last_assigned": 0}
    enriched = await _enrich_bookings(items)
    prov = await db.providers.find_one({"id": pid}, {"_id": 0})
    prov_cat = await db.categories.find_one({"id": prov.get("category_id")}, {"_id": 0}) if prov else None
    return {
        "date": d,
        "provider": {"id": pid, "business_name": prov.get("business_name") if prov else "", "city": prov.get("city") if prov else "", "category": prov_cat.get("name") if prov_cat else None},
        "current_token": state.get("current_token", 0),
        "last_assigned": state.get("last_assigned", 0),
        "items": enriched,
    }


@api.post("/queue/walkin")
async def add_walkin(w: WalkinCreate, user: User = Depends(current_user), date: Optional[str] = None):
    pid = await _provider_id_for_user(user)
    d = date or await get_today_str()
    svc = None
    if w.service_id:
        svc = await db.services.find_one({"id": w.service_id}, {"_id": 0})
    # Automobile-category specific required fields
    prov = await db.providers.find_one({"id": pid}, {"_id": 0})
    cat = await db.categories.find_one({"id": prov.get("category_id")}, {"_id": 0}) if prov else None
    is_auto = bool(cat and cat.get("name") == "Automobile")
    service_type = vehicle_reg_no = vehicle_model = None
    if is_auto:
        if w.service_type not in ("Paid", "Free"):
            raise HTTPException(400, "Select a Service Type (Paid or Free)")
        if not (w.vehicle_reg_no or "").strip():
            raise HTTPException(400, "Vehicle Registration Number is required")
        if not (w.vehicle_model or "").strip():
            raise HTTPException(400, "Model Number is required")
        service_type = w.service_type
        vehicle_reg_no = w.vehicle_reg_no.strip()
        vehicle_model = w.vehicle_model.strip()
    now = datetime.now(timezone.utc)
    token = await next_token_for(pid, d)
    booking = Booking(
        customer_id=None,
        customer_name=w.name,
        customer_phone=w.phone or "",
        customer_address=w.address or "",
        is_walkin=True,
        provider_id=pid,
        service_id=w.service_id,
        service_name=(svc["name"] if svc else "Walk-in visit"),
        price=(svc["price"] if svc else 0),
        date=d,
        start_time=f"{now.hour:02d}:{now.minute:02d}",
        end_time=f"{now.hour:02d}:{now.minute:02d}",
        status="confirmed",
        service_type=service_type,
        vehicle_reg_no=vehicle_reg_no,
        vehicle_model=vehicle_model,
        token_number=token,
    )
    await db.bookings.insert_one(booking.model_dump())
    return booking.model_dump(mode="json")


@api.post("/queue/next")
async def queue_next(user: User = Depends(current_user), date: Optional[str] = None):
    """Advance current_token. Mark previously-active booking as completed if exists."""
    pid = await _provider_id_for_user(user)
    d = date or await get_today_str()
    state = await db.queue_state.find_one({"provider_id": pid, "date": d}, {"_id": 0}) or {"current_token": 0, "last_assigned": 0}
    prev = state.get("current_token", 0)
    if prev > 0:
        # mark previous active as completed
        await db.bookings.update_many(
            {"provider_id": pid, "date": d, "token_number": prev, "status": {"$in": ["pending", "confirmed"]}},
            {"$set": {"status": "completed"}},
        )
    new_token = prev + 1
    if new_token > state.get("last_assigned", 0):
        # no more in queue; clamp
        new_token = state.get("last_assigned", 0)
    await db.queue_state.update_one(
        {"provider_id": pid, "date": d},
        {"$set": {"current_token": new_token, "last_assigned": state.get("last_assigned", 0)}},
        upsert=True,
    )
    return {"current_token": new_token, "last_assigned": state.get("last_assigned", 0)}


@api.post("/queue/reset")
async def queue_reset(user: User = Depends(current_user), date: Optional[str] = None):
    pid = await _provider_id_for_user(user)
    d = date or await get_today_str()
    await db.queue_state.update_one(
        {"provider_id": pid, "date": d},
        {"$set": {"current_token": 0}},
        upsert=True,
    )
    return {"ok": True}


@api.get("/queue/status")
async def queue_status_public(provider_id: str, date: Optional[str] = None):
    """Public: customer can see current_token vs last_assigned."""
    d = date or await get_today_str()
    state = await db.queue_state.find_one({"provider_id": provider_id, "date": d}, {"_id": 0}) or {"current_token": 0, "last_assigned": 0}
    return {
        "provider_id": provider_id, "date": d,
        "current_token": state.get("current_token", 0),
        "last_assigned": state.get("last_assigned", 0),
    }


@api.get("/queue/my-position")
async def my_queue_position(user: User = Depends(current_user)):
    """Customer: today's active booking + queue state."""
    await require_role(user, "customer")
    today = await get_today_str()
    booking = await db.bookings.find_one(
        {"customer_id": user.id, "date": today, "status": {"$in": ["pending", "confirmed"]}}, {"_id": 0}
    )
    if not booking:
        return {"has_booking": False}
    state = await db.queue_state.find_one(
        {"provider_id": booking["provider_id"], "date": today}, {"_id": 0}
    ) or {"current_token": 0, "last_assigned": 0}
    prov = await db.providers.find_one({"id": booking["provider_id"]}, {"_id": 0}) or {}
    enriched = await _enrich_booking(booking)
    return {
        "has_booking": True,
        "booking": enriched,
        "provider_on_duty": prov.get("on_duty", True),
        "current_token": state.get("current_token", 0),
        "last_assigned": state.get("last_assigned", 0),
        "your_token": booking.get("token_number", 0),
        "wait": max(0, booking.get("token_number", 0) - max(state.get("current_token", 0), 1)),
    }


# ---------- Admin ----------
@api.get("/admin/stats")
async def admin_stats(user: User = Depends(current_user)):
    await require_role(user, "admin")
    users = await db.users.count_documents({})
    providers = await db.providers.count_documents({})
    pending_providers = await db.providers.count_documents({"approved": False})
    bookings = await db.bookings.count_documents({})
    completed = await db.bookings.count_documents({"status": "completed"})
    revenue_pipe = await db.bookings.aggregate([
        {"$match": {"status": {"$in": ["confirmed", "completed"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$price"}}},
    ]).to_list(1)
    revenue = revenue_pipe[0]["total"] if revenue_pipe else 0
    return {
        "users": users, "providers": providers,
        "pending_providers": pending_providers, "bookings": bookings,
        "completed": completed, "revenue": revenue,
    }


@api.get("/admin/users")
async def admin_users(user: User = Depends(current_user)):
    await require_role(user, "admin")
    return await db.users.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.get("/admin/providers")
async def admin_providers(user: User = Depends(current_user), approved: Optional[bool] = None):
    await require_role(user, "admin")
    q = {}
    if approved is not None:
        q["approved"] = approved
    return await db.providers.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.put("/admin/providers/{pid}/approve")
async def approve_provider(pid: str, user: User = Depends(current_user)):
    await require_role(user, "admin")
    await db.providers.update_one({"id": pid}, {"$set": {"approved": True}})
    prov = await db.providers.find_one({"id": pid}, {"_id": 0})
    if prov:
        await push_notification(prov["user_id"], "You are approved!", "Your profile is live on EasySlot", "info")
    return prov


@api.put("/admin/providers/{pid}/reject")
async def reject_provider(pid: str, user: User = Depends(current_user)):
    await require_role(user, "admin")
    await db.providers.update_one({"id": pid}, {"$set": {"approved": False}})
    return {"ok": True}


@api.get("/admin/bookings")
async def admin_bookings(user: User = Depends(current_user)):
    await require_role(user, "admin")
    items = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return await _enrich_bookings(items)


@api.get("/admin/settings/sms")
async def get_sms_settings(user: User = Depends(current_user)):
    await require_role(user, "admin")
    doc = await db.settings.find_one({"key": "sms"}, {"_id": 0})
    if not doc:
        return SmsSettings().model_dump()
    doc.pop("key", None)
    return doc


@api.put("/admin/settings/sms")
async def update_sms_settings(s: SmsSettings, user: User = Depends(current_user)):
    await require_role(user, "admin")
    payload = s.model_dump()
    payload["key"] = "sms"
    await db.settings.update_one({"key": "sms"}, {"$set": payload}, upsert=True)
    return s.model_dump()


class SmsTestRequest(BaseModel):
    phone: str


@api.post("/admin/settings/sms/dry-run")
async def sms_dry_run(req: SmsTestRequest, user: User = Depends(current_user)):
    """Return the exact payload the backend WOULD POST to MSG91. Does not fire any request.

    Uses the currently-saved SMS settings — no need to save first.
    """
    await require_role(user, "admin")
    settings = await db.settings.find_one({"key": "sms"}, {"_id": 0}) or {}
    phone_12 = normalize_indian_phone(req.phone)
    otp = "1234"  # deterministic placeholder for dry-run display only
    payload = _build_msg91_payload(settings, phone_12, otp)
    return {
        "would_send_to": phone_12,
        "provider": settings.get("provider", "mock"),
        "enabled": bool(settings.get("enabled")),
        "endpoint": payload["endpoint"],
        "headers": {**payload["headers"], "authkey": "***REDACTED***" if payload["headers"].get("authkey") else ""},
        "body": payload["body"],
        "note": "This is what the backend would send. No SMS was dispatched.",
    }


@api.post("/admin/settings/sms/test-send")
async def sms_test_send(req: SmsTestRequest, user: User = Depends(current_user)):
    """Fire a REAL MSG91 SMS to the given phone using the saved settings.

    Returns the raw MSG91 response (with the api_key redacted) so admins can debug delivery.
    Refuses to run if MSG91 is not configured/enabled.
    """
    await require_role(user, "admin")
    settings = await db.settings.find_one({"key": "sms"}, {"_id": 0}) or {}
    if not (settings.get("enabled") and settings.get("provider") == "msg91" and settings.get("api_key")):
        raise HTTPException(503, "MSG91 is not enabled. Turn Enabled ON and save your API key first.")
    phone_12 = normalize_indian_phone(req.phone)
    otp = _generate_otp(4)
    ok, note, raw = await _dispatch_msg91(settings, phone_12, otp)
    return {
        "ok": ok,
        "message": note,
        "would_send_to": phone_12,
        "msg91_response": raw,
    }


@api.get("/admin/subscription-revenue")
async def admin_subscription_revenue(user: User = Depends(current_user)):
    """Dedicated subscription revenue (income from providers' subscription fees)."""
    await require_role(user, "admin")
    pipe = await db.subscriptions.aggregate([
        {"$match": {"status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    total = pipe[0]["total"] if pipe else 0
    count = pipe[0]["count"] if pipe else 0
    recent = await db.subscriptions.find({"status": "paid"}, {"_id": 0}).sort("paid_at", -1).to_list(50)
    return {"total": total, "transactions": count, "recent": recent}


@api.get("/admin/settings/payment")
async def get_payment_settings(user: User = Depends(current_user)):
    await require_role(user, "admin")
    doc = await db.settings.find_one({"key": "payment"}, {"_id": 0})
    if not doc:
        return PaymentSettings().model_dump()
    doc.pop("key", None)
    return doc


@api.put("/admin/settings/payment")
async def update_payment_settings(s: PaymentSettings, user: User = Depends(current_user)):
    await require_role(user, "admin")
    payload = s.model_dump()
    payload["key"] = "payment"
    await db.settings.update_one({"key": "payment"}, {"$set": payload}, upsert=True)
    return s.model_dump()


@api.get("/queue/customer-history")
async def queue_customer_history(phone: str, user: User = Depends(current_user)):
    """Service Assistant / Provider: full history for a customer phone with this provider."""
    pid = await _provider_id_for_user(user)
    items = await db.bookings.find(
        {"provider_id": pid, "customer_phone": phone}, {"_id": 0}
    ).sort([("date", -1), ("created_at", -1)]).to_list(200)
    enriched = await _enrich_bookings(items)
    return enriched


@api.get("/queue/history")
async def queue_history(start: str, end: str, user: User = Depends(current_user)):
    """Service Assistant / Provider: all bookings within a date range [start, end] (inclusive)."""
    pid = await _provider_id_for_user(user)
    items = await db.bookings.find(
        {"provider_id": pid, "date": {"$gte": start, "$lte": end}, "status": {"$ne": "rejected"}},
        {"_id": 0},
    ).sort([("date", -1), ("token_number", -1)]).to_list(1000)
    return await _enrich_bookings(items)


# ---------- Seed ----------
@app.on_event("startup")
async def seed():
    try:
        await _run_seed()
        logger.info("Seed complete")
    except Exception as e:
        # Never let a seeding hiccup (e.g. transient Atlas connection on cold start)
        # crash app startup and fail the deployment. The app must still boot.
        logger.error(f"Seed skipped due to error (app will still start): {e}")
    # Ensure MongoDB geo-index for advanced nearby search (idempotent).
    try:
        await db.providers.create_index([("location", "2dsphere")])
    except Exception as e:
        logger.warning(f"providers 2dsphere index skipped: {e}")


async def _run_seed():
    if await db.categories.count_documents({}) == 0:
        cats = [
            {"name": "Healthcare", "name_hi": "स्वास्थ्य", "icon": "stethoscope", "color": "#2A4D3E"},
            {"name": "Automobile", "name_hi": "ऑटोमोबाइल", "icon": "car", "color": "#1E40AF"},
            {"name": "Salon", "name_hi": "सैलून", "icon": "scissors", "color": "#B45309"},
            {"name": "Tutor", "name_hi": "शिक्षक", "icon": "book-open", "color": "#166534"},
            {"name": "Consultant", "name_hi": "सलाहकार", "icon": "briefcase", "color": "#374151"},
            {"name": "Coach", "name_hi": "कोच", "icon": "barbell", "color": "#991B1B"},
            {"name": "Home Service", "name_hi": "घर सेवा", "icon": "wrench", "color": "#447A63"},
        ]
        for c in cats:
            await db.categories.insert_one(Category(**c).model_dump())

    # Migration: rename Doctor → Healthcare (idempotent) + ensure Automobile exists
    await db.categories.update_one(
        {"name": "Doctor"},
        {"$set": {"name": "Healthcare", "name_hi": "स्वास्थ्य"}},
    )
    if not await db.categories.find_one({"name": "Automobile"}):
        await db.categories.insert_one(
            Category(name="Automobile", name_hi="ऑटोमोबाइल", icon="car", color="#1E40AF").model_dump()
        )

    if not await db.users.find_one({"role": "admin"}):
        admin = User(phone="9999999999", role="admin", name="EasySlot Admin")
        await db.users.insert_one(admin.model_dump())

    if await db.providers.count_documents({}) == 0:
        cats = await db.categories.find({}, {"_id": 0}).to_list(20)
        cat_by_name = {c["name"]: c for c in cats}
        samples = [
            {"phone": "9000000001", "name": "Dr. Aarav Sharma", "biz": "Sharma Clinic", "cat": "Healthcare", "city": "Mumbai", "addr": "12, Linking Road, Bandra West, Mumbai", "price": 500, "image": "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=800", "bio": "MBBS, MD - 12 years experience. General physician."},
            {"phone": "9000000002", "name": "Priya Beauty", "biz": "Glow Salon", "cat": "Salon", "city": "Delhi", "addr": "Shop 4, GK-2 Market, New Delhi", "price": 300, "image": "https://images.unsplash.com/photo-1595871151608-bc7abd1caca3?w=800", "bio": "Premium salon services - hair, skin, makeup."},
            {"phone": "9000000003", "name": "Rohan Tutor", "biz": "MathMinds Academy", "cat": "Tutor", "city": "Bangalore", "addr": "HSR Layout, Sector 2, Bangalore", "price": 800, "image": "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=800", "bio": "IIT-Bombay alum. Class 9-12 Math & Physics."},
            {"phone": "9000000004", "name": "Anita Gupta", "biz": "Wealth Advisors", "cat": "Consultant", "city": "Pune", "addr": "ICC Tower B, SB Road, Pune", "price": 1500, "image": "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800", "bio": "Certified Financial Planner. Tax & investments."},
            {"phone": "9000000005", "name": "Vikram Singh", "biz": "FitLife Coaching", "cat": "Coach", "city": "Mumbai", "addr": "Andheri West, Mumbai", "price": 600, "image": "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800", "bio": "Certified strength & conditioning coach."},
            {"phone": "9000000006", "name": "Quick Fix", "biz": "Quick Fix Plumbing", "cat": "Home Service", "city": "Delhi", "addr": "Karol Bagh, New Delhi", "price": 250, "image": "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=800", "bio": "Plumbing, electrical, and home repairs."},
        ]
        for s in samples:
            u = User(phone=s["phone"], role="provider", name=s["name"], city=s["city"])
            await db.users.insert_one(u.model_dump())
            cat = cat_by_name[s["cat"]]
            p = ProviderProfile(
                user_id=u.id, business_name=s["biz"], category_id=cat["id"],
                bio=s["bio"], city=s["city"], address=s["addr"], image=s["image"],
                starting_price=s["price"], approved=True,
                rating=round(random.uniform(4.0, 5.0), 1),
                reviews_count=random.randint(10, 80),
            )
            await db.providers.insert_one(p.model_dump())
            for svc in [{"name": "Consultation", "duration_min": 30, "price": s["price"]},
                        {"name": "Extended Session", "duration_min": 60, "price": s["price"] * 2}]:
                await db.services.insert_one(Service(provider_id=p.id, **svc).model_dump())
            for wd in range(0, 6):
                await db.availability.insert_one(
                    AvailabilityRule(provider_id=p.id, weekday=wd, start_time="09:00", end_time="18:00", slot_duration=30).model_dump()
                )

    # Default SMS settings (mock)
    if not await db.settings.find_one({"key": "sms"}):
        await db.settings.insert_one({"key": "sms", **SmsSettings().model_dump()})

    # Ensure at least one Automobile provider exists (idempotent) so the
    # Automobile-specific booking/walk-in flow is demonstrable.
    auto_cat = await db.categories.find_one({"name": "Automobile"}, {"_id": 0})
    if auto_cat and not await db.providers.find_one({"category_id": auto_cat["id"]}):
        au = await db.users.find_one({"phone": "9000000007", "role": "provider"}, {"_id": 0})
        if not au:
            au_user = User(phone="9000000007", role="provider", name="Imran Khan", city="Mumbai")
            await db.users.insert_one(au_user.model_dump())
            au = au_user.model_dump()
        ap = ProviderProfile(
            user_id=au["id"], business_name="AutoCare Garage", category_id=auto_cat["id"],
            bio="Car & bike service, repairs, and detailing.", city="Mumbai",
            address="Plot 9, MIDC, Andheri East, Mumbai",
            image="https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=800",
            starting_price=400, approved=True, rating=4.6, reviews_count=34,
        )
        await db.providers.insert_one(ap.model_dump())
        for svc in [{"name": "General Service", "duration_min": 60, "price": 400},
                    {"name": "Full Detailing", "duration_min": 120, "price": 1200}]:
            await db.services.insert_one(Service(provider_id=ap.id, **svc).model_dump())
        for wd in range(0, 6):
            await db.availability.insert_one(
                AvailabilityRule(provider_id=ap.id, weekday=wd, start_time="09:00", end_time="18:00", slot_duration=30).model_dump()
            )

    # Backfill: ensure all existing providers have at least default availability (fixes "Booking full" for legacy)
    all_provs = await db.providers.find({}, {"_id": 0}).to_list(1000)
    for p in all_provs:
        cnt = await db.availability.count_documents({"provider_id": p["id"]})
        if cnt == 0:
            await seed_default_availability(p["id"])

    logger.info("Seed complete")


app.include_router(api)
_cors = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware, allow_credentials=True, allow_origins=_cors or ["*"],
    allow_methods=["*"], allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """K8s liveness/readiness probe. Unprefixed on purpose (no /api)."""
    return {"status": "ok"}


@app.get("/")
async def root():
    return {"status": "ok", "service": "slotnow-backend"}


from fastapi.responses import Response, RedirectResponse  # noqa: E402
from urllib.parse import quote_plus  # noqa: E402


# SlotNow support WhatsApp number is intentionally not exposed via the API or the
# static frontend. It lives ONLY here and is reached via a 302 redirect below.
_SUPPORT_WA_NUMBER = os.environ.get("SUPPORT_WA_NUMBER", "919412575970")


@app.get("/api/whatsapp", include_in_schema=False)
async def whatsapp_support_redirect():
    """302 redirect to WhatsApp chat with SlotNow support.

    The number is never rendered in the frontend HTML/JS bundle — it only appears
    inside the redirect ``Location`` header (and eventually inside the user's
    WhatsApp app once the chat opens). Uses a signed message so the recipient's
    chat header reads as coming to SlotNow support.
    """
    text = "Hi SlotNow support — I need help with my SlotNow booking."
    target = f"https://wa.me/{_SUPPORT_WA_NUMBER}?text={quote_plus(text)}"
    return RedirectResponse(url=target, status_code=302)


def _sitemap_xml_response(site_url: str, providers, categories, city_combos=None, city_slugs=None) -> Response:
    urls = [
        (f"{site_url}/", "1.0", "weekly"),
        (f"{site_url}/login?role=customer", "0.6", "monthly"),
        (f"{site_url}/login?role=provider", "0.6", "monthly"),
    ]
    for c in categories:
        slug = _slugify(c["name"])
        urls.append((f"{site_url}/c/{slug}", "0.8", "weekly"))
    for slug, city_slug in (city_combos or []):
        urls.append((f"{site_url}/c/{slug}/{city_slug}", "0.7", "weekly"))
    for city_slug in (city_slugs or []):
        urls.append((f"{site_url}/city/{city_slug}", "0.8", "weekly"))
    for p in providers:
        urls.append((f"{site_url}/p/{p['id']}", "0.7", "weekly"))
    xml_parts = ['<?xml version="1.0" encoding="UTF-8"?>',
                 '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, prio, freq in urls:
        xml_parts.append(
            f"  <url><loc>{loc}</loc><changefreq>{freq}</changefreq><priority>{prio}</priority></url>"
        )
    xml_parts.append("</urlset>")
    return Response(content="\n".join(xml_parts), media_type="application/xml")


@app.get("/api/sitemap.xml", include_in_schema=False)
async def dynamic_sitemap_api():
    """Public dynamic sitemap. Includes homepage, login, all active categories
    (as /c/:slug), all category×city combos (as /c/:slug/:city), and all approved
    providers (as /p/:id). Google-friendly."""
    site_url = os.environ.get("PUBLIC_SITE_URL", "https://slotnow.co.in").rstrip("/")
    categories = await db.categories.find({"active": True}, {"_id": 0}).to_list(200)
    providers = await db.providers.find({"approved": True}, {"_id": 0, "id": 1}).to_list(2000)

    # Build category × city combos by aggregating unique (category, city) pairs
    combo_agg = await db.providers.aggregate([
        {"$match": {"approved": True, "city": {"$exists": True, "$nin": [None, ""]}}},
        {"$group": {"_id": {"cat": "$category_id", "city": "$city"}}},
    ]).to_list(2000)
    cat_slug_by_id = {c["id"]: _slugify(c["name"]) for c in categories}
    combos = []
    city_set = set()
    for row in combo_agg:
        cat_id = row["_id"].get("cat")
        city = row["_id"].get("city")
        if cat_id in cat_slug_by_id and city:
            combos.append((cat_slug_by_id[cat_id], _slugify(city)))
            city_set.add(_slugify(city))

    return _sitemap_xml_response(site_url, providers, categories, combos, sorted(city_set))


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
