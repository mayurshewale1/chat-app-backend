# Production Readiness Audit — Chat App Backend

**Audit Date:** February 27, 2025  
**Target:** Node.js backend for real-time chat (Express, Socket.io, WebRTC, JWT, Neon PostgreSQL)  
**Deployment:** RHEL Linux VPS (4-core), 100–1000 daily users

---

## 1. ARCHITECTURE REVIEW

### Separation of Concerns
| Aspect | Status | Notes |
|--------|--------|-------|
| Routes | ✅ | Clean route files (`auth.js`, `chats.js`, `connections.js`, `users.js`, `calls.js`) |
| Controllers | ✅ | Controllers handle HTTP logic; no direct DB in routes |
| Repositories | ✅ | `userRepository`, `messageRepository`, `chatRepository`, `connectionRepository`, `callHistoryRepository` |
| Services | ⚠️ | Only `chatService.js` and `messageExpiry.js`; business logic scattered in controllers |
| Middleware | ⚠️ | `authJwt`, `errorHandler`, `uploadAppLogo` — no validation middleware layer |

**Findings:**
- Controllers contain inline validation (e.g., `if (!username \|\| !password)` in `authController.js`). No centralized schema validation (Joi/Zod).
- `chatsController.listChats` has N+1: for each chat, it calls `getMembers` and `getLastMessage` — should be batched or use JOINs.
- `connectionsController.startChat` uses `connections.some((c) => c.id === otherUserId)` — `listAcceptedConnections` returns users, so `c.id` is correct; logic is fine.

### Service-Layer Pattern
- **Partial:** `chatService.getOrCreatePrivateChat` and `messageExpiry` exist, but most logic lives in controllers.
- **Gap:** No dedicated `authService`, `messageService`, or `callService`; controllers call repos directly.

### Controller Structure
- Controllers are thin but inconsistent: some use `try/catch` with `res.status(500)`, others rely on error handler.
- No async wrapper; unhandled promise rejections in controllers would bypass `errorHandler` (Express 5 handles this; Express 4 does not).

### Middleware Design
- `authJwt` correctly validates Bearer token and loads user.
- `errorHandler` is generic: `err.status` and `err.message` — custom `AppError` class not used.
- **Missing:** Request validation middleware, rate limiting, request ID for tracing.

### Error-Handling Strategy
- `errorHandler` in `middlewares/errorHandler.js`:
  ```javascript
  const errorHandler = (err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
  };
  ```
- **Issues:**
  - No distinction between operational vs programmer errors.
  - Leaks stack traces if `err.message` contains sensitive data.
  - Uses `console.error` instead of Winston logger (logger exists but is unused).

### Async Handling Correctness
- Controllers use `async/await`; no `next(err)` in catch blocks for async routes.
- **Express 4:** Async errors in route handlers are NOT automatically passed to `next`. A route like `router.get('/', authJwt, listChats)` — if `listChats` throws, it may be unhandled.
- **Fix:** Wrap async handlers with `(fn) => (req, res, next) => fn(req, res, next).catch(next)` or use `express-async-errors`.

### Global Crash Handling
- **CRITICAL:** No `unhandledRejection` or `uncaughtException` handlers in `server.js`.
- Process can crash silently on unhandled promise rejections or synchronous errors outside Express.

---

## 2. SOCKET.IO ANALYSIS

### Authentication Middleware
- ✅ `io.use()` middleware validates JWT from `socket.handshake.auth?.token` or `Authorization` header.
- ✅ Rejects connection with `next(new Error('Authentication error'))` on failure.
- ⚠️ Generic error message (good for security) but no logging of auth failures for monitoring.

### Token Validation During Handshake
- ✅ Token verified with `jwt.verify(token, config.JWT_SECRET)`.
- ✅ User loaded from DB; connection rejected if user not found.

### User-to-Socket Mapping
- ✅ `socket.join(\`user:${user.id}\`)` — rooms used for user targeting.
- ⚠️ **Multi-device bug:** `onlineUsers` is a `Set` of user IDs. On connect: `onlineUsers.add(user.id)`. On disconnect: `onlineUsers.delete(user.id)`. When a user has 2 devices and one disconnects, `onlineUsers.delete(user.id)` marks them offline even if the other device is still connected. **Fix:** Track socket count per user (e.g., `Map<userId, number>`) or use `io.sockets.adapter.rooms.get(\`user:${userId}\`)?.size` to determine online status.

### Handling Multi-Device Login
- ✅ Multiple sockets per user join same room `user:${user.id}` — messages broadcast to all devices.
- ❌ Presence (`onlineUsers`) incorrectly treats user as offline when any single socket disconnects.

### Disconnect Cleanup Logic
- ✅ `onlineUsers.delete(user.id)` (with multi-device bug above).
- ✅ `userRepo.updateLastSeen(user.id)`.
- ✅ Presence broadcast to chat partners.
- ✅ `messageRepo.deleteByEphemeralMode('deleteOnExit', user.id)`.

### Event Name Standardization
- ✅ Consistent `namespace:action` pattern: `message:send`, `message:new`, `message:delivered`, `call:offer`, `call:answer`, `call:ice-candidate`, `call:hangup`, `call:reject`, `presence:request`, `typing:start`, etc.

### Memory Leak Risk from Listeners
- ✅ Handlers are registered per connection; Socket.io removes them on disconnect. No manual `socket.on` that persists beyond socket lifecycle.
- ⚠️ `onlineUsers` Set could grow if disconnect handler fails before `onlineUsers.delete` — edge case.

### Flood Protection / Rate Limiting
- ❌ **No rate limiting on Socket.io events.** A malicious client can spam `message:send`, `call:offer`, `typing:start`, etc.
- ❌ No per-socket or per-user throttling.

---

## 3. WEBRTC SIGNALING VALIDATION

### Offer/Answer Exchange
- ✅ `call:offer` → `call:incoming` to callee.
- ✅ `call:answer` → `call:answer` to caller.
- Flow is correct for 1-to-1 signaling.

### ICE Candidate Forwarding
- ✅ `call:ice-candidate` forwards `{ from, candidate }` to peer.
- No validation of candidate structure; malformed ICE could cause client-side issues but not server crash.

### Race Condition Protection
- ⚠️ **call:answer** updates `findLatestRinging(to, user.id)` — caller=to, callee=user. Logic: "callee answers caller's ringing call." Correct.
- ⚠️ **call:hangup** uses `findLatestRingingBetween(user.id, to)` — handles both directions. Correct.
- ⚠️ **call:reject** uses `findLatestRinging(user.id, to)` — caller=user, callee=to. Correct.
- ⚠️ No locking; rapid call:offer from same user to same callee could create multiple ringing records. Acceptable for 100–1000 users.

### Call Rejection Handling
- ✅ `call:reject` emits `call:rejected` to caller and updates call_history to `rejected`.

### Abrupt Disconnect During Call
- ⚠️ On socket disconnect, `call:hangup` is NOT automatically emitted to the peer. If user A's socket drops mid-call, user B never receives `call:hangup`. **Fix:** On disconnect, emit `call:hangup` to all active call peers (requires tracking active calls per socket).

### Timeout Handling
- ❌ No server-side call timeout. If callee never answers, caller's UI must handle timeout; server does not cancel ringing state.

### TURN Integration
- ❌ No TURN server configuration in backend. WebRTC is peer-to-peer; in restrictive networks (corporate firewalls, symmetric NAT), connections may fail without TURN. Backend does not provide TURN credentials — typically done via a TURN service (e.g., Twilio, Xirsys) and configured on client.

---

## 4. POSTGRESQL (NEON) DATABASE REVIEW

### SSL Config for Neon
- ✅ `ssl: connectionString.includes('neon.tech') || connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined`
- ⚠️ `rejectUnauthorized: false` disables certificate verification. For Neon, this is often required due to their certificate chain; acceptable but document why. Prefer `rejectUnauthorized: true` with proper CA if Neon supports it.

### Connection Pooling
- ✅ `new Pool({ connectionString, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 })`
- ✅ Single pool instance; `getPool()` returns it.

### Using pg Pool Correctly
- ✅ All repos use `query(text, params)` which delegates to `pool.query()`.
- ✅ No `pool.connect()` held across requests; each query uses pool's internal connection acquisition.

### Avoiding New Connection Per Request
- ✅ Single pool; no `new Pool()` per request.

### Idle Timeout
- ✅ `idleTimeoutMillis: 30000` (30s). Neon serverless may close idle connections; 30s is reasonable. Consider Neon's recommended `idle_in_transaction_session_timeout` if using transactions.

### Indexes
- ✅ `idx_users_username`, `idx_users_recovery_email`, `idx_users_uid`
- ✅ `idx_chat_members_user`, `idx_messages_chat`, `idx_messages_expire` (partial)
- ✅ `idx_connections_from`, `idx_connections_to`
- ✅ `idx_call_history_caller`, `idx_call_history_callee`, `idx_call_history_created`
- ⚠️ `findByChat` uses `created_at < $2` — index on `(chat_id, created_at DESC)` would help. Current `idx_messages_chat` helps but composite would be better.
- ⚠️ `findLatestRinging` filters `status = 'ringing'` — no index on `(caller_id, callee_id, status)`. For 100–1000 users, likely fine.

### Foreign Key Constraints
- ✅ All tables have proper `REFERENCES` and `ON DELETE CASCADE` where appropriate.

### Transaction Usage
- ⚠️ `chatRepo.create` inserts chat then loops `INSERT INTO chat_members` — not wrapped in transaction. If second insert fails, orphan chat remains.
- ⚠️ No transactions in `messageRepo.create`, `callHistoryRepo.create`, etc. For single-row inserts, usually OK.

### N+1 Query Issues
- ❌ **chatsController.listChats:** For each chat, calls `chatRepo.getMembers(c.id)` and `messageRepo.getLastMessage(c.id)`. With 50 chats, that's 1 + 50 + 50 = 101 queries. **Fix:** Batch with `Promise.all` over chats is already used, but still N+1. Prefer a single query with JOINs or a batch `getMembersForChats(chatIds)` and `getLastMessagesForChats(chatIds)`.

### Query Performance
- `connectionRepo.listAcceptedConnections` uses `IN (SELECT ... UNION SELECT ...)` — efficient.
- `messageRepo.findByChat` with `before` uses `created_at` or `id` — OK.
- `callHistoryRepo.listByUserId` has JOINs and `LIMIT 100` — OK.

### Schema Normalization
- ✅ Normalized: users, chats, chat_members, messages, connections, call_history.
- ✅ No redundant data; `chats.last_message` is denormalized for convenience — consider updating on message create/delete.

### Migration Strategy
- ⚠️ `runSchema.js` runs `schema.sql` on every startup. Schema uses `CREATE TABLE IF NOT EXISTS` and `DO $$ ... $$` for additive migrations. **Risk:** No version tracking; running twice is idempotent but no rollback. For production, use a migration tool (e.g., `node-pg-migrate`, `knex migrate`).

---

## 5. SECURITY AUDIT

### JWT Expiration
- ✅ `jwt.sign(..., { expiresIn: config.ACCESS_TOKEN_EXPIRES_IN })` — default `15m`.
- ✅ `jwt.verify` will reject expired tokens.

### Refresh Token Strategy
- ❌ **No refresh tokens.** Only access token returned on login/register. Client must re-login when token expires (every 15m). For 1000 users, this may cause friction. Consider refresh token flow.

### CORS
- ❌ **CRITICAL:** `app.use(cors())` with no options — allows all origins (`*`). In production, restrict to your frontend origin(s).

### Rate Limiting
- ❌ **No rate limiting** on HTTP routes. Login, register, and all API endpoints are unprotected against brute force and DoS.

### Input Validation
- ❌ No Joi, Zod, or express-validator. Validation is ad-hoc in controllers (e.g., `if (!username \|\| !password)`). No max length checks, no sanitization of `content` in messages. Risk of oversized payloads, XSS if content is rendered without escaping on client.

### SQL Injection
- ✅ All queries use parameterized `$1`, `$2`, etc. No string concatenation of user input into SQL.

### Environment Variables
- ✅ Config reads from `process.env`; no hardcoded DB URLs in code.
- ⚠️ `config/index.js`: `JWT_SECRET = process.env.JWT_SECRET || 'change_this_to_a_strong_secret'` — **CRITICAL:** If `JWT_SECRET` is unset, default is used. Must fail startup if missing in production.

### Hardcoded Secrets
- ❌ `.env.example` contains `MONGO_URI=mongodb+srv://...@chat-app-cluster...` — appears to be a real connection string. Remove or replace with placeholder.

### Helmet
- ✅ `app.use(helmet())` — security headers enabled.

### HPP (HTTP Parameter Pollution)
- ⚠️ `hpp` is in `package.json` but **not used** in `app.js`. Enable `app.use(hpp())` to prevent parameter pollution.

### Brute-Force Login Protection
- ❌ No lockout after failed attempts. No rate limiting on `/api/auth/login`.

---

## 6. PERFORMANCE & SCALABILITY

### Blocking Synchronous Code
- ⚠️ `runSchema.js`: `fs.readFileSync(schemaPath, 'utf8')` — blocks event loop. For a one-time startup, acceptable; prefer `fs.promises.readFile` for consistency.
- ⚠️ `uploadAppLogo.js`: `fs.existsSync` and `fs.mkdirSync` — run at module load, not per-request; OK.

### Heavy Queries
- `chatsController.listChats` — N+1 as noted.
- `callHistoryRepo.listByUserId` — JOINs, LIMIT 100 — acceptable.

### Unindexed WHERE Clauses
- Most queries use indexed columns. `findLatestRinging` uses `status = 'ringing'` — no dedicated index; low impact at current scale.

### Large JSON Payloads
- No explicit limits on `message.content` or `req.body`. `express.json()` has default limit (~100kb). Consider `express.json({ limit: '1mb' })` and validate message length (e.g., max 64KB).

### Memory Usage Growth
- `onlineUsers` Set — bounded by active users.
- Socket.io adapter — in-memory; default adapter stores socket data. For single-instance, OK. For horizontal scaling, need Redis adapter.

### WebSocket Scaling
- ❌ Single Node process. Socket.io uses in-memory adapter. **Horizontal scaling:** Multiple instances require sticky sessions (by `sid`) and Redis adapter for Socket.io. Not configured.

### Horizontal Scaling Readiness
- ❌ No Redis adapter for Socket.io.
- ❌ No shared session store (JWT is stateless — OK).
- ❌ Presence (`onlineUsers`) is in-memory — not shared across instances.

### Sticky Session Requirement
- Socket.io with default adapter requires sticky sessions when scaling horizontally. Not documented or configured.

---

## 7. PRODUCTION DEPLOYMENT (RHEL VPS)

### PM2
- ❌ No PM2 config. `npm start` runs single process. For production, use PM2 for process management, auto-restart, and logging.

### Cluster Mode
- ❌ No cluster mode. Single process uses one CPU core. On 4-core VPS, consider `PM2 start server.js -i 4` or Node `cluster` module — but Socket.io scaling requires Redis adapter first.

### Nginx Reverse Proxy
- ❌ No Nginx config. Need reverse proxy for HTTPS, WebSocket upgrade (`Upgrade`, `Connection`), and static files.

### HTTPS Readiness
- ❌ Server listens on HTTP only. HTTPS must be terminated at Nginx or load balancer.

### Logging Strategy
- ⚠️ Winston logger exists (`utils/logger.js`) but **never used**. All logging is `console.log`/`console.error`. No structured logging, no log levels, no file transport for production.

### Log Rotation
- ❌ No log rotation configured. If switching to file transport, use `winston-daily-rotate-file` or system logrotate.

### Environment Separation
- ⚠️ `NODE_ENV` is read from env; no strict enforcement. `config.JWT_SECRET` fallback is dangerous in production.

### Graceful Shutdown
- ❌ No `SIGTERM`/`SIGINT` handlers. On deploy or restart, connections are dropped abruptly. Should: stop accepting new connections, close Socket.io, drain HTTP, close DB pool.

### Dockerfile
- ⚠️ `RUN npm run build` — **package.json has no `build` script.** Build will fail. Remove or add `"build": "echo 'no build'"` or actual build step.

---

## 8. CRITICAL ISSUES (Top 5 — MUST FIX)

### 1. CORS Allows All Origins
**File:** `app.js`  
**Issue:** `app.use(cors())` with no origin restriction.  
**Fix:** `app.use(cors({ origin: process.env.FRONTEND_URL || 'https://yourdomain.com', credentials: true }))`

### 2. JWT_SECRET Fallback in Production
**File:** `config/index.js`  
**Issue:** `JWT_SECRET || 'change_this_to_a_strong_secret'` — if unset, weak default is used.  
**Fix:** In production, `if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') process.exit(1)` or throw.

### 3. No Global Crash Handlers
**File:** `server.js`  
**Issue:** Unhandled promise rejections and uncaught exceptions can crash process silently.  
**Fix:**
```javascript
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
```

### 4. Multi-Device Presence Bug
**File:** `sockets/index.js`  
**Issue:** `onlineUsers.delete(user.id)` on any disconnect marks user offline even if another device is connected.  
**Fix:** Track socket count per user: `Map<userId, number>` — increment on connect, decrement on disconnect; only delete from `onlineUsers` when count reaches 0. Or use `io.sockets.adapter.rooms.get(\`user:${userId}\`)?.size > 0` for online check.

### 5. No Rate Limiting
**Files:** `app.js`, Socket.io handlers  
**Issue:** Login/register and Socket events can be spammed — brute force, DoS.  
**Fix:** Add `express-rate-limit` to auth routes (e.g., 5 req/min for login). Add Socket.io middleware to throttle events per socket (e.g., `socket-io-rate-limiter` or custom counter with setInterval reset).

---

## 9. FINAL PRODUCTION CHECKLIST

### Node.js
- [ ] Add `unhandledRejection` and `uncaughtException` handlers in `server.js`
- [ ] Add async error wrapper for Express routes (e.g., `express-async-errors` or custom wrapper)
- [ ] Replace `console.log`/`console.error` with Winston logger
- [ ] Add request ID middleware for tracing
- [ ] Set `NODE_ENV=production`

### Neon PostgreSQL
- [ ] Ensure `DATABASE_URL` or `PG_URI` is set (no fallback)
- [ ] Verify SSL works with Neon (`rejectUnauthorized: false` if required; document)
- [ ] Add composite index `(chat_id, created_at DESC)` on messages if `listChats`/`getMessages` are slow
- [ ] Wrap `chatRepo.create` member inserts in transaction
- [ ] Use migration tool (e.g., `node-pg-migrate`) instead of raw schema run on startup
- [ ] Consider `statement_timeout` in pool config for long-running queries

### Socket.io
- [ ] Fix multi-device presence (socket count or room size check)
- [ ] Add rate limiting per socket (e.g., max 60 `message:send`/min)
- [ ] Emit `call:hangup` to peer on disconnect when user was in active call (track active calls)
- [ ] Restrict CORS in Socket.io: `cors: { origin: process.env.FRONTEND_URL }` instead of `origin: '*'`
- [ ] For horizontal scaling: add `@socket.io/redis-adapter` and configure

### WebRTC
- [ ] Document that TURN must be configured client-side for restrictive networks
- [ ] Consider server-side call timeout (e.g., 60s) to update `call_history` to `missed` if no answer
- [ ] On disconnect, notify active call peer via `call:hangup`

### RHEL VPS
- [ ] Install PM2: `npm i -g pm2`
- [ ] Create `ecosystem.config.js` with `instances: 4` (after Redis adapter) or `instances: 1` for now
- [ ] Configure Nginx: reverse proxy to `localhost:4000`, WebSocket upgrade headers, SSL termination
- [ ] Use Certbot for Let's Encrypt
- [ ] Add graceful shutdown: `process.on('SIGTERM', async () => { server.close(); pool.end(); process.exit(0); })`
- [ ] Configure logrotate for PM2 logs
- [ ] Set up firewall (allow 80, 443; block direct access to 4000 from internet)

### Security
- [ ] Restrict CORS to frontend origin
- [ ] Fail startup if `JWT_SECRET` unset in production
- [ ] Add `express-rate-limit` to `/api/auth/login` and `/api/auth/register`
- [ ] Add `hpp()` middleware
- [ ] Add input validation (Joi/Zod) for register, login, message content, etc.
- [ ] Remove or redact secrets from `.env.example`

### Docker
- [ ] Fix Dockerfile: remove `npm run build` or add build script
- [ ] Use `node:18-alpine`; ensure `npm start` works

---

*End of Audit*
