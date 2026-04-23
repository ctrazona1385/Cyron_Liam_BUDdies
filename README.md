**CSC 4370 — Web Programming** | Spring 2026
**Team:** Cyron Trazona & Liam Finn

---

# B.U.D.DIES. — Beyond-Use Date Documentation & Inventory Entry System

> Compounding pharmacy management for tracking compounds from creation through approval, inventory, and expiration.

---

## Tech Stack

**Frontend**
- Plain HTML, CSS, JavaScript — no framework, no build step
- `script.js` — shared auth, nav, date helpers, and `apiFetch()` API wrapper
- JWT stored in `sessionStorage`; sent as `Bearer` header on every API call

**Backend**
- Node.js + Express
- `jsonwebtoken` — JWT auth
- `bcrypt` — password hashing
- `pg` (node-postgres) — raw parameterized SQL, no ORM

**Database**
- PostgreSQL
- Tables: `users`, `compounds`, `ingredients`, `activity_log`
- `ON DELETE CASCADE` on `ingredients → compounds` and `activity_log → compounds`

---

## Test Accounts

Real login credentials seeded in the database:

| Role        | Email                | Password   |
|-------------|----------------------|------------|
| Admin       | jdoe@gmail.com       | password   |
| Technician  | johndoe@gmail.com    | password   |

---

## Grader Access — Quick Login Bypass

The backend uses JWT auth. For local testing without real credentials, inject a session directly via the browser console on any page:

**As Admin** (full access including Approvals, Adjust B.U.D.):
```js
sessionStorage.setItem('bud_user', JSON.stringify({
  id: 1,
  name: "C. Trazona",
  email: "admin@pharmacy.com",
  role: "admin",
  token: "dev-token"
}));
window.location.replace('dashboard.html');
```

**As Technician** (no Approvals tab, no B.U.D. adjustment):
```js
sessionStorage.setItem('bud_user', JSON.stringify({
  id: 2,
  name: "L. Finn",
  email: "tech@pharmacy.com",
  role: "technician",
  token: "dev-token"
}));
window.location.replace('dashboard.html');
```

To log out: click Logout in the navbar, or run `sessionStorage.removeItem('bud_user')` in the console.

---

## Running Locally

### Frontend
No build step. Serve from the repo root:
```bash
npx serve .
# or
python3 -m http.server 8080
```
Then open `http://localhost:8080`.

### Backend
```bash
cd server
cp .env.example .env   # fill in DB credentials and JWT_SECRET
npm install
node index.js          # or: npx nodemon index.js
```
The API runs on `http://localhost:3000` by default. The frontend's `apiFetch()` helper in `script.js` points to `/api` and expects the server at the same origin (or update `API_BASE`).

### Database
PostgreSQL required. Run the migration to create tables:
```bash
psql -d your_db_name -f server/db/migrate.sql
```

---

## File Structure

```
├── index.html              # Entry — redirects to login or dashboard
├── login.html              # Login & registration
├── dashboard.html          # Analytics, expiration risk, recent activity
├── create-compound.html    # Log a new compounded medication
├── inventory.html          # Full inventory table with filters
├── compound-detail.html    # Individual compound view + activity log
├── admin-approval.html     # Admin-only approval queue
├── script.js               # Shared utilities: auth, nav, date helpers, apiFetch()
├── style.css               # Global styles (warm earth-tone theme)
└── server/
    ├── index.js            # Express entry point
    ├── app.js              # Middleware + route wiring
    ├── db/
    │   ├── pool.js         # pg connection pool
    │   └── migrate.sql     # Schema (compounds, users, activity_log)
    ├── middleware/
    │   ├── auth.js         # JWT verification
    │   └── requireRole.js  # Role-based access guard
    └── routes/
        ├── auth.js         # POST /api/auth/login, /register
        ├── compounds.js    # Compound CRUD + workflow actions
        └── dashboard.js    # Dashboard stats + risk list + recent activity
```

---

## Pages & Features

### Dashboard (`dashboard.html`)
- Stat cards: total, approved, pending, expiring ≤ 5 days, expired
- **Smart Expiration Risk** — approved compounds sorted by urgency, color-coded bars, searchable
- **Recent Activity** — last 10 actions with compound name + strength, dose form, and detail notes
- Alerts for expired and expiring inventory

### Create Compound (`create-compound.html`)
- Fields: name, strength, quantity (whole numbers), unit, type, date compounded, B.U.D.
- **Auto-calculates B.U.D.** from date compounded:
  - Sterile → 60 days
  - Non-Sterile → 30 days
  - Hazardous → 7 days
- Date compounded is locked (read-only) by default
- **Override B.U.D.** checkbox unlocks both the date and a manual B.U.D. field; requires a written reason
- Lot number auto-generated on submit (`DDMMYYCC` format)
- Submitted compounds enter the pending approval queue

### Inventory (`inventory.html`)
- Live filtering by name/strength, lot #, type, status, and expiration date range
- Rejected compounds hidden from the default view; visible by selecting "Rejected" filter
- **Dose form column** derived from unit (Capsules, Liquid, Cream/Topical, etc.)
- Expiration warning banner for compounds expiring within 5 days
- Remove button (approved/expired compounds): choose a specific quantity or remove all

### Compound Detail (`compound-detail.html`)
- Name + strength header, status badge, B.U.D. progress bar
- Full compound info table
- **Admin controls**: Approve, Reject (with required note), Adjust B.U.D. (admin only)
- **All-user controls**: Remove / Adjust Qty (for approved or expired compounds)
- **Rejected state**: shows rejection note banner; Edit & Resubmit modal to correct and re-queue; Delete to permanently remove
- Full activity log with dates, users, actions, and notes

### Admin Approval (`admin-approval.html`)
- Filter by Pending / Approved / Rejected / All
- Searchable by compound name + strength
- Approve inline or Reject with a required written note
- Admin-only; non-admin users see an access-denied message

---

## Roles & Permissions

| Feature                    | Technician | Admin |
|----------------------------|:----------:|:-----:|
| View Dashboard             | ✅         | ✅    |
| Create Compound            | ✅         | ✅    |
| View Inventory             | ✅         | ✅    |
| Remove Inventory / Adjust Qty | ✅      | ✅    |
| Edit & Resubmit Rejected   | ✅         | ✅    |
| Delete Rejected Compound   | ✅         | ✅    |
| View Compound Detail       | ✅         | ✅    |
| Approvals Queue            | ❌         | ✅    |
| Approve / Reject           | ❌         | ✅    |
| Adjust B.U.D. (approved)   | ❌         | ✅    |

---

## API Reference

All routes require a `Bearer <token>` header except `/api/auth/*`.

| Method   | Path                              | Auth  | Description |
|----------|-----------------------------------|-------|-------------|
| `POST`   | `/api/auth/login`                 | —     | Returns `{ id, name, email, role, token }` |
| `POST`   | `/api/auth/register`              | —     | Create new user account |
| `GET`    | `/api/compounds`                  | Any   | List compounds; optional `?status=` filter |
| `POST`   | `/api/compounds`                  | Any   | Create compound (auto-generates lot number) |
| `GET`    | `/api/compounds/:id`              | Any   | Compound detail + activity log |
| `DELETE` | `/api/compounds/:id`              | Any   | Permanently remove |
| `PATCH`  | `/api/compounds/:id/quantity`     | Any   | Reduce stock by N; auto-deletes at 0 |
| `PATCH`  | `/api/compounds/:id/resubmit`     | Any   | Edit rejected compound and re-queue as pending |
| `PATCH`  | `/api/compounds/:id/approve`      | Admin | Approve pending compound |
| `PATCH`  | `/api/compounds/:id/reject`       | Admin | Reject with `{ note }` |
| `PATCH`  | `/api/compounds/:id/bud`          | Admin | Override B.U.D. with `{ bud, reason }` |
| `GET`    | `/api/dashboard`                  | Any   | Stats, risk list, recent activity |
