# Chat App Backend — API Reference

Base URL: `http://YOUR_EC2_IP:4000` or `http://localhost:4000`

---

## Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Health check + DB status |

---

## Auth (`/api/auth`)

| Method | Endpoint | Auth | Body | Description |
|--------|----------|------|------|-------------|
| GET | `/api/auth/check-username/:username` | No | — | Check if username is available |
| POST | `/api/auth/register` | No | `{ username, password, displayName, firebaseIdToken }` or `{ mobile, otp, ... }` + **`securityQuestion`**, **`securityAnswer`** (required) | Register; security Q&A stored hashed for recovery |
| POST | `/api/auth/login` | No | `{ username, password }` | Login |

---

## Users (`/api/users`)

| Method | Endpoint | Auth | Body | Description |
|--------|----------|------|------|-------------|
| GET | `/api/users/me` | Yes | — | Get current user profile |
| PATCH | `/api/users/me` | Yes | `{ displayName, avatar }` | Update profile |
| POST | `/api/users/app-logo` | Yes | FormData `appLogo` (file) | Upload app logo |
| GET | `/api/users/:uid` | No | — | Get user by UID (public) |

---

## Connections (`/api/connections`)

| Method | Endpoint | Auth | Body | Description |
|--------|----------|------|------|-------------|
| GET | `/api/connections` | Yes | — | List accepted connections (friends) |
| GET | `/api/connections/requests` | Yes | — | List pending requests received |
| GET | `/api/connections/sent` | Yes | — | List pending requests sent |
| POST | `/api/connections/request` | Yes | `{ uid }` or `{ username }` | Send friend request |
| POST | `/api/connections/accept` | Yes | `{ requestId }` | Accept friend request |
| POST | `/api/connections/reject` | Yes | `{ requestId }` | Reject friend request |

---

## Chats (`/api/chats`)

| Method | Endpoint | Auth | Body | Description |
|--------|----------|------|------|-------------|
| GET | `/api/chats` | Yes | `?limit=50&offset=0` | List user's chats (paginated; response `{ chats, hasMore }`) |
| GET | `/api/chats/search` | Yes | `?q=...` | Search chats by contact name or message content |
| POST | `/api/chats/start` | Yes | `{ otherUserId }` | Start chat with friend |
| GET | `/api/chats/:chatId/messages` | Yes | `?limit=50&before=isoDate` | Get messages (response `{ messages, hasMore }`; `before` loads older) |
| POST | `/api/chats/:chatId/messages` | Yes | `{ content, type, ephemeral, to }` | Send message |

---

## Calls (`/api/calls`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/calls/history` | Yes | Get call history |

---

## Auth Header

For protected routes, send:

```
Authorization: Bearer <accessToken>
```

---

## Socket.io Events (Real-time)

Connect to: `http://YOUR_EC2_IP:4000`

**Auth:** Pass token in handshake:
```js
io(SOCKET_URL, { auth: { token: accessToken } })
```

### Emit (client → server)

| Event | Payload | Description |
|-------|---------|-------------|
| `message:send` | `{ chatId, to, content, type?, ephemeral? }` | Send message |
| `message:delivered` | `{ messageId }` | Mark delivered |
| `message:delete` | `{ chatId, messageId, scope?: 'me' \| 'everyone' }` | `me` = hide for you only; `everyone` (default) = sender-only, soft-delete for both; emits `message:deleted` |
| `message:read` | `{ messageId }` | Mark read |
| `call:offer` | `{ to, offer, isVideo }` | Start call |
| `call:answer` | `{ to, answer }` | Answer call |
| `call:ice-candidate` | `{ to, candidate }` | ICE candidate |
| `call:hangup` | `{ to }` | End call |
| `call:reject` | `{ to }` | Reject call |
| `presence:request` | `{ userId }` | Check if user online |
| `typing:start` | `{ to }` | Start typing |
| `typing:stop` | `{ to }` | Stop typing |

### Listen (server → client)

| Event | Payload | Description |
|-------|---------|-------------|
| `message:new` | message object | New message received |
| `message:status` | `{ messageId, status }` | Delivered/read/viewed |
| `message:deleted` | `{ chatId, messageId, scope?: 'me' }` or `{ chatId, messageId, isDeletedForEveryone, message }` | Removed for you vs tombstone for everyone |
| `call:incoming` | `{ from, offer, isVideo, caller? }` | Incoming call |
| `call:answer` | `{ from, answer }` | Call answered |
| `call:ice-candidate` | `{ from, candidate }` | ICE candidate |
| `call:hangup` | `{ from }` | Call ended |
| `call:rejected` | `{ from }` | Call rejected |
| `presence:status` | `{ userId, online, lastSeen? }` | User online/offline |
| `presence:response` | `{ userId, online, lastSeen }` | Response to presence:request |
| `typing:status` | `{ from, typing }` | Typing indicator |
