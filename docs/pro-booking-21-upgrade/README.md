# SlotNow — `pro-booking-21` Backend Upgrade Guide (Iter 35 → Iter 55)

**Goal:** Bring the mobile-app-facing backend (`https://pro-booking-21.emergent.host`)
up to the same iteration-55 code that this `slotnow-web` project already runs.
Once you complete these steps:

- ✅ "Become a Provider" **Provider Type dropdown** populates (`/api/reference/healthcare`).
- ✅ **Waiting Screen** (`/waiting/:provider_id`) starts serving live tokens (`/api/public/waiting/{id}`).
- ✅ City pages (`/api/city/{slug}`), Search (`/api/search/providers`), Referral APIs, Cabin field, and every other iter 35–55 endpoint go live.
- ✅ **Zero data migration required** — your existing MongoDB (users, providers, bookings) is preserved as-is.

> **Data-safety note:** This is a **code-only** redeploy on the same MongoDB cluster
> that pro-booking-21 already uses. No collection is dropped, renamed, or migrated
> unless you also choose to run the optional `migrate_iter54_provider_type.py`
> normaliser (see step 5). Your mobile app keeps writing to the same DB throughout.

---

## What's in this folder

| File | Purpose |
|---|---|
| `server.py` | The full 3,683-line FastAPI backend (all iter-55 features baked in). |
| `requirements.txt` | Pinned Python deps used in this pod. |
| `migrate_iter54_provider_type.py` | **Optional** one-time script that normalises `providers.provider_type` values (`hospital / clinic / service`). Only run this if your DB has legacy values like `doctor` or `general`. |

---

## Step-by-step: redeploy `pro-booking-21`

You need to open the **owning Emergent session** for the `pro-booking-21` project.
This is a different project from `slotnow-web`; it has its own chat and its own
`/app` folder. This pod cannot reach it.

### 1. Open the `pro-booking-21` project

- Go to https://app.emergent.sh
- From the top-left project switcher, pick the project whose deployment URL is
  `https://pro-booking-21.emergent.host` (that's the one your mobile app calls).
- If you're unsure which chat owns it, look for the chat whose right-hand
  **Preview URL** ends in `.preview.emergentagent.com` and whose **Deploy** panel
  shows `pro-booking-21.emergent.host` as the production URL.

### 2. Ask the E1 agent in that chat to replace the backend files

Paste this exact prompt in the `pro-booking-21` chat:

> **Prompt (copy-paste as-is):**
>
> Please replace `/app/backend/server.py`, `/app/backend/requirements.txt`, and
> add `/app/backend/scripts/migrate_iter54_provider_type.py` with the versions I
> will paste next. Do NOT touch `/app/backend/.env` (keep the existing MONGO_URL,
> DB_NAME, JWT_SECRET, RAZORPAY_* untouched). Do NOT change `/app/frontend`.
> After pasting, run `pip install -r /app/backend/requirements.txt` and restart
> the backend via supervisor. Then confirm `GET /api/reference/healthcare`,
> `GET /api/reference/cities`, `GET /api/city/mumbai`, `GET /api/search/providers`
> all return 200 on the local preview.
>
> Ready — I will paste the three files now.

Then paste the contents of `server.py`, `requirements.txt`, and
`migrate_iter54_provider_type.py` from **this** folder into that chat, one at a
time. The E1 agent there will place them at the right paths.

### 3. Verify **on that chat's preview URL** before deploying

In the `pro-booking-21` chat, ask E1 to run:

```
curl -s https://<that-chat>.preview.emergentagent.com/api/reference/healthcare
curl -s https://<that-chat>.preview.emergentagent.com/api/reference/cities
curl -s https://<that-chat>.preview.emergentagent.com/api/city/mumbai
curl -s https://<that-chat>.preview.emergentagent.com/api/public/waiting/<any-provider-id>
```

All should return HTTP 200 with real payloads. **If any 404 remains, do NOT deploy —
tell E1 to check `supervisor status backend` and inspect `/var/log/supervisor/backend.err.log`.**

### 4. Deploy to production

Once the four `curl`s above pass on that project's preview, tell E1 in the
`pro-booking-21` chat:

> "Please deploy to production."

E1 will call `emergent__send_to_deployer` inside its own session. The build will
publish to `pro-booking-21.emergent.host`.

### 5. (Optional) Run the provider-type normaliser

Only needed if your DB has legacy `provider_type` values like `doctor`, `general`,
`opd`, etc. Ask E1 in that chat:

> "Please run `python /app/backend/scripts/migrate_iter54_provider_type.py` and
> paste the summary output."

The script prints a dry-run first — nothing is written until you approve. If your
mobile app already only uses `hospital / clinic / service`, you can skip this.

### 6. Confirm the end result

Back here in `slotnow-web`, on `https://slotnow.co.in/provider/onboarding`:

- Refresh the page (`Cmd/Ctrl+Shift+R`).
- Select "Healthcare / स्वास्थ्य" category.
- **Provider Type dropdown should now list:** Hospital, Doctor / Clinic, Any Service.

For the Waiting Screen, visit `https://slotnow.co.in/waiting/<provider_id>`
of any existing provider and confirm the tokens render. If they do — the entire
iter 35–55 upgrade is complete.

---

## Sanity check before you begin

Run these three `curl`s **right now** to confirm the current state:

```bash
curl -sI https://pro-booking-21.emergent.host/api/reference/healthcare | head -1   # expect: 404 Not Found
curl -sI https://pro-booking-21.emergent.host/api/categories | head -1              # expect: 200 OK (older code)
curl -sI https://pro-booking-21.emergent.host/api/public/waiting/x | head -1        # expect: 404 Not Found
```

If the first and third match, the guide applies. If `/api/reference/healthcare`
is already 200, your backend has been upgraded some other way — skip this guide.

---

## Rollback

Emergent keeps every previous production deployment. If the new build shows any
regression, use the Deploy panel's **Rollback** button on the `pro-booking-21`
project to restore the previous healthy run. No DB rollback is needed because
we did not migrate collections.

---

## FAQ

**Q. Will my mobile app keep working during the redeploy?**
Yes. The redeploy replaces the code, not the database. The mobile app keeps
reading/writing to the same MongoDB throughout. Expect a ~30-second window
where the API returns 502 while the new pod boots.

**Q. Do I need to update the mobile app APK/IPA?**
Only if you want new client-side features (e.g. Waiting Screen). If you just
want the web dropdown fixed, no mobile release is needed.

**Q. What about secrets like RAZORPAY_KEY_ID?**
They live in `/app/backend/.env` on the pro-booking-21 side. We do NOT ship a
new `.env`. E1 there will keep the existing values.

**Q. What if E1 in the other chat asks for the frontend as well?**
Tell them to leave `/app/frontend/` alone. This upgrade is backend-only. The
mobile-app-facing web frontend already lives on `slotnow.co.in` and is served
from THIS project, not from pro-booking-21.

---

*Generated on iter-55 upgrade prep. If anything is unclear, come back to this
chat and I'll help you draft the exact prompt for the other project's E1.*
