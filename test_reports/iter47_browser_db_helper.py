import sys
from datetime import datetime, timezone

from pymongo import MongoClient


def normalize(phone: str) -> str:
    digits = "".join(ch for ch in (phone or "") if ch.isdigit())
    if len(digits) == 10:
        return "91" + digits
    return digits


def main():
    if len(sys.argv) < 3:
        raise SystemExit("usage: iter47_browser_db_helper.py cleanup|seed <phone>")
    action, phone = sys.argv[1], sys.argv[2]
    phone_12 = normalize(phone)
    phone_10 = phone_12[2:] if phone_12.startswith("91") and len(phone_12) == 12 else phone_12
    client = MongoClient("mongodb://localhost:27017")
    db = client["test_database"]
    if action == "cleanup":
        db.users.delete_many({"role": "receptionist", "phone": {"$in": [phone_10, phone_12]}})
        db.otps.delete_many({"phone": phone_12})
        print(f"cleaned {phone_10}/{phone_12}")
    elif action == "seed":
        db.otps.update_one(
            {"phone": phone_12},
            {"$set": {"phone": phone_12, "otp": "123456", "created_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        print(f"seeded otp for {phone_12}")
    else:
        raise SystemExit(f"unknown action: {action}")
    client.close()


if __name__ == "__main__":
    main()