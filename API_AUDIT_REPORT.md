# Complete API Audit Report — Chat App Backend

**Audit Date:** February 27, 2026  
**Scope:** All Express route definitions in `backend/src`

---

## 1. TOTAL APIs: 22

---

## 2. Breakdown by Method

| Method | Count |
|--------|-------|
| GET | 11 |
| POST | 10 |
| PUT | 0 |
| PATCH | 1 |
| DELETE | 0 |

---

## 3. Breakdown by Route File

### app.js (direct mount)
- GET `/health`

### auth.js (mounted at `/api/auth`)
- GET `/api/auth/check-username/:username`
- POST `/api/auth/register`
- POST `/api/auth/login`

### users.js (mounted at `/api/users`)
- GET `/api/users/me`
- PATCH `/api/users/me`
- POST `/api/users/app-logo`
- GET `/api/users/:uid`

### connections.js (mounted at `/api/connections`)
- POST `/api/connections/request`
- POST `/api/connections/accept`
- POST `/api/connections/reject`
- GET `/api/connections/requests`
- GET `/api/connections/sent`
- GET `/api/connections`

### chats.js (mounted at `/api/chats`)
- GET `/api/chats`
- POST `/api/chats/start`
- GET `/api/chats/:chatId/messages`
- POST `/api/chats/:chatId/messages`

### calls.js (mounted at `/api/calls`)
- GET `/api/calls/history`

---

## 4. Full Endpoint Paths (Alphabetical)

```
GET  /health
GET  /api/auth/check-username/:username
POST /api/auth/login
POST /api/auth/register
GET  /api/calls/history
GET  /api/chats
POST /api/chats/start
GET  /api/chats/:chatId/messages
POST /api/chats/:chatId/messages
GET  /api/connections
GET  /api/connections/requests
GET  /api/connections/sent
POST /api/connections/accept
POST /api/connections/reject
POST /api/connections/request
GET  /api/users/me
PATCH /api/users/me
POST /api/users/app-logo
GET  /api/users/:uid
```

---

## 5. Findings

### Routes Defined But Never Mounted
**None.** All route files (`auth.js`, `users.js`, `connections.js`, `chats.js`, `calls.js`) are mounted in `routes/index.js` under `/api`.

### Duplicate Routes
**None.** No duplicate method+path combinations found.

### Routes Without Controller Logic
**None.** All routes reference controller functions that exist and are exported:
- `authController`: `login`, `register`, `checkUsernameAvailability` ✓
- `userController`: `getMe`, `updateProfile`, `uploadAppLogo`, `getByUid` ✓
- `connectionsController`: `sendRequest`, `acceptRequest`, `rejectRequest`, `listPendingRequests`, `listSentRequests`, `listConnections` ✓
- `chatsController`: `listChats`, `startChat`, `getMessages`, `sendMessage` ✓
- `callsController`: `getHistory` ✓

### Controller Logic Without Routes
**Found:** `messagesController.js` exports `markDelivered` and `markRead` but these are **not** mounted as HTTP routes. They appear to be used only via Socket.io events (`message:delivered`, `message:read`). No HTTP endpoints exist for these actions.

### Routes Missing Authentication Middleware

| Route | Auth | Notes |
|-------|------|-------|
| GET `/health` | No | Intentional — health checks |
| GET `/api/auth/check-username/:username` | No | Intentional — public check |
| POST `/api/auth/register` | No | Intentional — registration |
| POST `/api/auth/login` | No | Intentional — login |
| GET `/api/users/:uid` | No | **Review:** Public user lookup by UID |
| All others | Yes (`authJwt`) | ✓ |

**Note:** `GET /api/users/:uid` is intentionally public (allows looking up users by UID for adding friends). Consider rate limiting if not already applied at a higher level.

### Inconsistent REST Naming Patterns

| Issue | Example | Recommendation |
|-------|---------|----------------|
| Mixed plural/singular | `/api/connections` vs `/api/chats` | Both plural — OK |
| Action in path | `POST /api/chats/start` | Could be `POST /api/chats` with body `{ action: 'start' }` — acceptable as-is |
| Nested resource | `GET /api/chats/:chatId/messages` | RESTful ✓ |
| Verb in path | `POST /api/connections/request` | Could be `POST /api/connections` with `{ action: 'request' }` — acceptable |
| Inconsistent | `POST /api/connections/accept` vs `POST /api/connections/request` | Both use verb — consistent within file |

**Summary:** Naming is reasonably consistent. Minor variations (e.g., `request` vs `accept`) are acceptable for this API style.

---

## 6. Health Route

| Property | Value |
|----------|-------|
| **Exists** | Yes |
| **Path** | `/health` |
| **Method** | GET |
| **Location** | `app.js` (line 23) |
| **Auth** | No |
| **Response** | `{ status, db, timestamp }` — 200 if DB connected, 503 if not |

---

## 7. Route Mounting Summary

```
app.js
├── GET /health (inline handler)
└── /api → routes/index.js
    ├── /auth → auth.js (+ authLimiter)
    ├── /users → users.js
    ├── /connections → connections.js
    ├── /chats → chats.js
    └── /calls → calls.js
```

---

*End of API Audit Report*
