[README.md](https://github.com/user-attachments/files/25777924/README.md)
# B.U.D. Tracker — README

> **Compounding Pharmacy Beyond-Use Date Management System**

---

## ⚡ Bypassing the Login Screen (Dev / Collaborator Access)

Since the backend is not yet connected, the login form won't authenticate real credentials. To access the app, **manually inject a fake session into `sessionStorage`** using your browser's DevTools console.

**Steps:**

1. Open `login.html` in your browser
2. Open DevTools → **Console** tab (`F12` or `Cmd+Option+J`)
3. Paste one of the following snippets and press **Enter**:

**As an Admin** (access to all pages including Approvals):
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

**As a Technician** (no Approvals tab):
```js
sessionStorage.setItem('bud_user', JSON.stringify({
  id: 2,
  name: "J. Smith",
  email: "tech@pharmacy.com",
  role: "technician",
  token: "dev-token"
}));
window.location.replace('dashboard.html');
```

To **log out**, click the Logout button in the navbar, or run `sessionStorage.removeItem('bud_user')` in the console.

---

## Project Overview

B.U.D. Tracker is a frontend prototype for managing compounded medications at a pharmacy. It tracks compounds from creation through admin approval, monitors beyond-use dates, and flags expiring or expired inventory.

The entire frontend is built in plain HTML, CSS, and JavaScript — no framework, no build step. A backend API is stubbed out but not yet implemented.

---

## File Structure

```
├── index.html            # Entry point — redirects to login or dashboard
├── login.html            # Login & registration forms
├── dashboard.html        # Analytics overview, expiration risk, activity log
├── create-compound.html  # Form to log a new compounded medication
├── inventory.html        # Full inventory table with filters and CSV export
├── compound-detail.html  # Individual compound view with ingredient table
├── admin-approval.html   # Admin-only approval queue
├── script.js             # Shared utilities (auth, nav, date helpers, API wrapper)
└── style.css             # Global styles
```

---

## Pages & Features

### Login (`login.html`)
- Tab-toggled login / registration forms
- Role selection: **Technician** or **Admin**
- Redirects to dashboard if already authenticated

### Dashboard (`dashboard.html`)
- Summary stat cards: total, approved, pending, expiring, expired
- **Smart Expiration Risk panel** — compounds sorted by urgency with color-coded progress bars
- Recent activity log
- Alerts for expired and expiring compounds

### Create Compound (`create-compound.html`)
- Compound info form (name, strength, lot number, quantity, type)
- **Auto-calculates B.U.D.** based on USP `<797>` defaults:
  - Non-Sterile → 180 days
  - Sterile → 30 days
  - Hazardous → 14 days
- Admin override checkbox to manually set B.U.D. with a required reason
- Dynamic ingredient rows (add/remove)
- Submits compound for admin approval

### Inventory (`inventory.html`)
- Full compound table with live filtering by name, lot #, type, status, and expiration date range
- Expiration warning banner for compounds expiring within 30 days
- CSV export of visible rows
- Print report button

### Compound Detail (`compound-detail.html`)
- Full compound info and B.U.D. progress bar
- Ingredient table with per-ingredient expiration status
- Admin action log
- Admin controls: **Adjust B.U.D.** (with reason) and **Remove from Inventory**

### Admin Approval (`admin-approval.html`)
- Queue of all compounds filtered by status (Pending / Approved / Rejected)
- Approve button updates status inline
- Reject opens a modal requiring a written rejection note
- Access-guard placeholder (role check to be wired to backend)

---

## Roles & Permissions

| Feature                  | Technician | Admin |
|--------------------------|:----------:|:-----:|
| View Dashboard           | ✅         | ✅    |
| Create Compound          | ✅         | ✅    |
| View Inventory           | ✅         | ✅    |
| View Compound Detail     | ✅         | ✅    |
| Approvals Queue          | ❌         | ✅    |
| Approve / Reject         | ❌         | ✅    |
| Adjust B.U.D. Override   | ❌         | ✅    |
| Remove from Inventory    | ❌         | ✅    |

---

## Backend Integration (TODO)

All API calls are stubbed. The shared `apiFetch()` helper in `script.js` is ready to use once a backend is connected. Set the base URL at the top of `script.js`:

```js
const API_BASE = '/api'; // Update to your backend URL
```

Endpoints expected by the frontend:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Authenticate user, return `{ id, name, email, role, token }` |
| `POST` | `/api/auth/register` | Create new user account |
| `GET` | `/api/compounds` | List all compounds |
| `POST` | `/api/compounds` | Create a new compound |
| `GET` | `/api/compounds/:id` | Get single compound detail |
| `PATCH` | `/api/compounds/:id/approve` | Admin approve |
| `PATCH` | `/api/compounds/:id/reject` | Admin reject `{ note }` |
| `PATCH` | `/api/compounds/:id/bud` | Override B.U.D. `{ bud, reason }` |
| `DELETE` | `/api/compounds/:id` | Remove from inventory |
| `GET` | `/api/dashboard` | Summary stats for dashboard cards |

---

## Running Locally

No build tools required. Just open the files in a browser:

```bash
# Option 1 — open directly
open index.html

# Option 2 — serve with any static server (avoids some sessionStorage quirks)
npx serve .
# or
python3 -m http.server 8080
```

> **Note:** Using a local file server (`npx serve` or Python) is recommended over opening HTML files directly, as `file://` URLs can behave differently with `sessionStorage` in some browsers.
