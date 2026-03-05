/**
 * script.js — B.U.D. Tracker shared utilities
 * Loaded by every page.
 */

// ── Session helpers ──────────────────────────────────────────────────────────

/**
 * Returns the current user object from sessionStorage, or null if not logged in.
 * Shape: { id, name, email, role }   role = 'admin' | 'technician'
 */
function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem('bud_user'));
  } catch {
    return null;
  }
}

/** Redirect to login if no session exists. Call at the top of protected pages. */
function requireAuth() {
  if (!getCurrentUser()) {
    window.location.replace('login.html');
  }
}

/** Redirect to dashboard if already logged in. Call on login page. */
function redirectIfLoggedIn() {
  if (getCurrentUser()) {
    window.location.replace('dashboard.html');
  }
}

/** Log the current user out and return to the login page. */
function logout() {
  sessionStorage.removeItem('bud_user');
  window.location.replace('login.html');
}

// ── Navbar setup ─────────────────────────────────────────────────────────────

/**
 * Populates the nav with the current user's name and hides admin-only links
 * for non-admin users. Call once per protected page after the DOM is ready.
 */
function initNav() {
  const user = getCurrentUser();
  if (!user) return;

  const nameEl = document.getElementById('nav-user-name');
  if (nameEl) nameEl.textContent = `${user.name} (${capitalize(user.role)})`;

  // Hide admin-only nav items for technicians
  if (user.role !== 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = 'none';
    });
  }
}

// ── Date / B.U.D. helpers ────────────────────────────────────────────────────

/**
 * Calculates a B.U.D. date string (YYYY-MM-DD) from a start date and number of days.
 * @param {string|Date} startDate
 * @param {number} days
 * @returns {string}
 */
function calcBUD(startDate, days) {
  const d = new Date(startDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Returns the number of days between today and a target date.
 * Negative means the date has passed.
 * @param {string|Date} targetDate
 * @returns {number}
 */
function daysUntil(targetDate) {
  return Math.ceil((new Date(targetDate) - Date.now()) / 86_400_000);
}

/**
 * Formats a YYYY-MM-DD string to a human-readable date.
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

// ── API helpers ──────────────────────────────────────────────────────────────

const API_BASE = '/api'; // Update this to your backend base URL

/**
 * Wrapper around fetch that automatically includes JSON headers and the
 * session token. Throws on non-2xx responses.
 * @param {string} path  e.g. '/compounds'
 * @param {object} options  standard fetch options
 */
async function apiFetch(path, options = {}) {
  const user = getCurrentUser();
  const headers = {
    'Content-Type': 'application/json',
    ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(API_BASE + path, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── Misc utilities ───────────────────────────────────────────────────────────

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Auto-init on every page load ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Skip auth check on the login page itself
  const onLoginPage = window.location.pathname.endsWith('login.html');
  if (!onLoginPage) {
    requireAuth();
    initNav();
  } else {
    redirectIfLoggedIn();
  }
});
