# Chat App Backend

Node.js backend for real-time chat with Express, Socket.io, WebRTC signaling, JWT auth, and Neon PostgreSQL.

## Tech Stack

- **Express.js** — REST API
- **Socket.io** — Real-time messaging & presence
- **WebRTC** — 1-to-1 voice/video call signaling
- **JWT** — Authentication
- **PostgreSQL (Neon)** — Database

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, FRONTEND_URL
npm start
```

## Scripts

- `npm start` — Start server
- `npm run dev` — Start with watch mode
- `npm run lint` — Run ESLint
- `npm test` — Run tests

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for JWT signing |
| `FRONTEND_URL` | Yes | Frontend origin (for CORS) |
| `PORT` | No | Server port (default: 4000) |
| `NODE_ENV` | No | `development` or `production` |

## Production

See `RHEL_DEPLOYMENT_AUDIT.md` and `deploy/` folder for deployment configs.
