# Slot Now Web / Book Preview 11 — Redeploy Guide (Feb 2026)

## What this fix does
1. **Real MSG91 SMS** — backend calls `https://control.msg91.com/api/v5/flow/` with the DLT variable name from settings (`num` by default), matching your `##num##` template.
2. **Bootstrap Admin PIN Login** — allows admin to log in with phone + PIN without OTP (for emergency access when MSG91 is misconfigured).
3. **Phone normalization** — all Indian numbers converted to 12-digit `91XXXXXXXXXX` format before hitting MSG91.
4. **New admin endpoints** — `POST /api/admin/settings/sms/dry-run` and `POST /api/admin/settings/sms/test-send` for diagnostics.

---

## Files to push to GitHub (Slot Now Web + Book Preview 11 repos)

| Source (Emergent workspace) | Target (Your repo) |
|---|---|
| `/app/backend/server.py` | `backend/server.py` (full replace, 1676 lines) |

---

## Environment variables to set on the deployment platform

Add these to your backend deployment's env vars (do NOT commit to git):

```
MONGO_URL=<your Atlas connection string>       # do NOT change
DB_NAME=<your db name>                          # do NOT change
JWT_SECRET=<your existing secret>               # keep existing
CORS_ORIGINS=*
MOCK_OTP=123456
BOOTSTRAP_ADMIN_PHONE=9412575970
BOOTSTRAP_ADMIN_PIN=1234
```

The `BOOTSTRAP_*` vars are optional but recommended so you can always log in
as admin (phone `9412575970` + PIN `1234`) even if MSG91 breaks.

---

## SMS Settings (already in DB — no action needed if MongoDB is shared)

These values are already saved in the shared `settings` collection:

```json
{
  "provider": "msg91",
  "api_key": "548721AhSyuiRtc6a547edcP1",
  "sender_id": "SLOTNW",
  "dlt_template_id": "6a5f8da0d56797446f0612d2",
  "dlt_entity_id": "1277178456195361134",
  "dlt_variable_name": "num",
  "enabled": true
}
```

If your live Slot Now Web / Book Preview 11 uses a **different MongoDB**,
open Admin → SMS settings after login and enter the same values, then save.

---

## Verification after redeploy

Run these curl commands against your live URL (replace `LIVE_URL`):

```bash
LIVE_URL=https://your-live-domain.com

# 1. Bootstrap admin login
TOKEN=$(curl -sS -X POST $LIVE_URL/api/auth/pin-login \
  -H "Content-Type: application/json" \
  -d '{"phone":"9412575970","role":"admin","pin":"1234"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
echo "TOKEN=$TOKEN"   # non-empty → login working

# 2. SMS settings visible
curl -sS $LIVE_URL/api/admin/settings/sms -H "Authorization: Bearer $TOKEN"

# 3. Dry-run — see the exact payload backend would send
curl -sS -X POST $LIVE_URL/api/admin/settings/sms/dry-run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"9412575970"}'
# expected: body.recipients[0].num = "1234", mobiles = "919412575970"

# 4. Real SMS fire
curl -sS -X POST $LIVE_URL/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9412575970","role":"admin"}'
# expected: {"ok":true,"provider_used":"msg91"}
```

---

## Post-redeploy security

Once you can log in with the bootstrap PIN, IMMEDIATELY:

1. Log in as admin via bootstrap PIN.
2. Go to Profile → Set PIN → change to a strong PIN (only you know).
3. Unset the two env vars from the deployment:
   - `BOOTSTRAP_ADMIN_PHONE`
   - `BOOTSTRAP_ADMIN_PIN`
4. Redeploy so the bootstrap is disabled in production.

Your custom PIN (stored as bcrypt hash in the DB) remains active
after the env vars are removed.
