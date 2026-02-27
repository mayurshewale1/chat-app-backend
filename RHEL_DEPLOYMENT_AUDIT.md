# RHEL VPS Production Deployment Audit

**Target:** Node.js Chat App (Express, Socket.io, WebRTC, Neon PostgreSQL)  
**Environment:** RHEL Linux VPS, 4-core, public IP  
**Scale:** 100–1000 daily users  

---

## 1. SERVER COMPATIBILITY CHECK

### Node.js Version Compatibility
| Requirement | Your Setup | RHEL Compatibility |
|-------------|------------|---------------------|
| Node.js | Implicit 18+ (Dockerfile) | RHEL 8/9: `dnf module install nodejs:18` or `nodejs:20` |
| Engine field | **Missing in package.json** | Add `"engines": { "node": ">=18.0.0" }` |

**RHEL 8/9:** Node.js 18 and 20 available via AppStream. Prefer Node 20 LTS (until April 2026).

```bash
# RHEL 8/9
sudo dnf module list nodejs
sudo dnf module install nodejs:20
node -v  # v20.x
```

### Required System Dependencies
- **None** for pure Node.js runtime. Your stack uses:
  - `pg` (native bindings optional; pure JS fallback exists)
  - `bcryptjs` (pure JS, no native deps)
  - `socket.io` (no native deps)

If using `bcrypt` (native) instead of `bcryptjs`, you'd need `gcc-c++` and `make` for compilation. Your project uses `bcryptjs` — no build tools required.

### Required Linux Packages (Minimal)
```bash
sudo dnf install -y nodejs npm  # or nodejs:20 module
# Optional: for log rotation, monitoring
sudo dnf install -y logrotate
```

### Environment Variable Validation
| Variable | Required | Production | Notes |
|----------|---------|------------|-------|
| `NODE_ENV` | Yes | `production` | Enables prod checks (e.g. JWT_SECRET) |
| `PORT` | No | `4000` | Default; app binds to this (internal only) |
| `DATABASE_URL` | Yes | Neon connection string | Must include `?sslmode=require` for Neon |
| `FRONTEND_URL` | Yes | `https://yourdomain.com` | CORS + Socket.io origin |
| `JWT_SECRET` | Yes | Strong random string | **Blocking:** App exits if unset in prod |

**Pre-flight validation script** (run before start):
```bash
#!/bin/bash
[[ -z "$JWT_SECRET" && "$NODE_ENV" == "production" ]] && { echo "JWT_SECRET required"; exit 1; }
[[ -z "$DATABASE_URL" ]] && { echo "DATABASE_URL required"; exit 1; }
[[ -z "$FRONTEND_URL" ]] && { echo "FRONTEND_URL required"; exit 1; }
```

### SSL Readiness
- **App layer:** No TLS; app serves HTTP on port 4000.
- **TLS termination:** Must be at Nginx (or load balancer). App does not need SSL config.
- **WebRTC:** Requires HTTPS for `getUserMedia` and most browsers. Domain must be served over HTTPS.

---

## 2. PROCESS MANAGEMENT

### Should PM2 Be Used?
**Yes.** `npm start` runs a single process with no auto-restart, no log management, no clustering.

```bash
sudo npm install -g pm2
pm2 start src/server.js --name chat-api
pm2 save
pm2 startup  # Enable startup on boot
```

### Should Cluster Mode Be Enabled?
**Not yet.** Your Socket.io setup uses the **in-memory adapter**. With cluster mode:
- Each worker has its own Socket.io state.
- A socket connected to worker 1 cannot receive events from worker 2.
- **Result:** Broken real-time features.

**Options:**
1. **Single instance (recommended for 100–1000 users):** Run 1 PM2 process. Adequate for your scale.
2. **Multi-instance later:** Add `@socket.io/redis-adapter`, run multiple PM2 instances, use Nginx sticky sessions. Defer until you need horizontal scaling.

### Graceful Restart Handling
- **Current:** `SIGTERM`/`SIGINT` handlers close HTTP server and DB pool. Good.
- **PM2:** Sends `SIGINT` on restart. Your handler will run.
- **Gap:** Socket.io does not explicitly close. `server.close()` stops accepting new connections; existing WebSocket connections may be cut. For PM2 `restart`/`reload`, short disruption is acceptable.

### Memory Restart Limits
Prevent unbounded memory growth:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'chat-api',
    script: 'src/server.js',
    instances: 1,
    max_memory_restart: '500M',
    env: { NODE_ENV: 'production' },
  }],
};
```

### Log Management Strategy
- **Current:** Winston logs to console only. PM2 captures stdout/stderr.
- **PM2 logs:** `~/.pm2/logs/` — no rotation by default.
- **Recommendation:** Use `pm2-logrotate`:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

---

## 3. NGINX REVERSE PROXY CONFIG

### Required Nginx Config Structure

```nginx
# /etc/nginx/conf.d/chat-api.conf

upstream chat_backend {
    server 127.0.0.1:4000;
    keepalive 32;
}

# Rate limiting zone (optional but recommended)
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=2r/s;

server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # Security headers (Helmet covers some; Nginx adds others)
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # API routes
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://chat_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Auth routes - stricter rate limit
    location /api/auth/ {
        limit_req zone=auth_limit burst=5 nodelay;
        proxy_pass http://chat_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.io - WebSocket upgrade (CRITICAL)
    location /socket.io/ {
        proxy_pass http://chat_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Health check (if you add /health)
    location /health {
        proxy_pass http://chat_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }
}
```

### WebSocket Upgrade Headers
- `Upgrade: websocket` and `Connection: upgrade` are required for Socket.io.
- Nginx passes `$http_upgrade` and `Connection "upgrade"` — correct.

### Proxy Timeout Settings
- **API:** 60s is fine for HTTP.
- **Socket.io:** `proxy_read_timeout 86400` and `proxy_send_timeout 86400` (24h) to avoid closing long-lived WebSocket connections.

### Rate Limiting at Nginx Level
- `api_limit`: 10 req/s, burst 20.
- `auth_limit`: 2 req/s, burst 5 for login/register.
- Complements app-level `express-rate-limit` (defense in depth).

### Static vs API Routing
- Your app has no static file routes; everything is API + Socket.io.
- If you add a frontend on the same server, use a separate `location /` for static files and proxy `/api` and `/socket.io` to the backend.

---

## 4. SECURITY HARDENING

### Firewall Configuration
```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --remove-service=cockpit  # if present
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

### Open Ports
- **80** (HTTP) — redirect to HTTPS.
- **443** (HTTPS) — Nginx.
- **22** (SSH) — restrict to your IP if possible.

### Should Port 4000 Be Blocked?
**Yes.** The app listens on 4000. It must not be reachable from the internet.

- Bind to `127.0.0.1` only, or
- Keep default `0.0.0.0:4000` but ensure firewall blocks 4000 from public.

```bash
# Ensure 4000 is not in allowed ports
sudo firewall-cmd --list-ports  # should NOT include 4000
```

If the app binds to `0.0.0.0`, blocking 4000 at the firewall is sufficient.

### Fail2ban Needed?
**Recommended** for SSH and Nginx abuse.

```bash
sudo dnf install -y fail2ban
sudo systemctl enable fail2ban
```

Example jail for Nginx 404/403 abuse:
```ini
# /etc/fail2ban/jail.d/nginx-limit-req.conf
[nginx-limit-req]
enabled = true
filter = nginx-limit-req
action = iptables-multiport[name=nginx-limit-req, port="http,https"]
logpath = /var/log/nginx/error.log
findtime = 60
maxretry = 10
bantime = 3600
```

### SSH Hardening
```bash
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
```

---

## 5. HTTPS & DOMAIN

### Let's Encrypt Setup
```bash
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

### Auto-Renewal
```bash
sudo systemctl enable certbot.timer
sudo systemctl status certbot.timer
# Test: sudo certbot renew --dry-run
```

### WebRTC HTTPS Requirement
- **Mandatory:** `getUserMedia` and WebRTC require a secure context (HTTPS or localhost).
- Your frontend and API must be served over HTTPS in production.
- Ensure `FRONTEND_URL` uses `https://`.

---

## 6. DATABASE (NEON) CONNECTION SAFETY

### Connection Pooling
- **Current:** `max: 10` connections in pool.
- **Assessment:** Adequate for 100–1000 users. Neon serverless scales connections; 10 per app instance is conservative.

### SSL Enforced
- **Current:** `ssl: { rejectUnauthorized: false }` when URL contains `neon.tech` or `sslmode=require`.
- **Assessment:** SSL is used. `rejectUnauthorized: false` is common for Neon due to certificate chain; acceptable if connection string is trusted.

### Idle Timeout
- **Current:** `idleTimeoutMillis: 30000` (30s).
- **Assessment:** Matches Neon’s serverless behavior; idle connections are closed to avoid exhaustion.

### Risk of Connection Exhaustion
- Pool size 10 with 30s idle timeout is safe.
- **Risk:** Long-running transactions holding connections. Your code uses short queries; low risk.
- **Neon:** Supports connection pooling (e.g. `pooler.neon.tech`). If you use pooled URL, keep `max` at or below Neon’s per-endpoint limit.

---

## 7. PERFORMANCE RISK ANALYSIS

### Expected Memory Usage
- **Base Node:** ~50–80 MB.
- **App + deps:** ~100–150 MB.
- **Per WebSocket:** ~10–20 KB.
- **100 concurrent users:** ~150–200 MB.
- **500 concurrent:** ~200–300 MB.
- **Recommendation:** `max_memory_restart: '500M'` in PM2.

### CPU Bottlenecks
- **bcrypt:** CPU-heavy on login/register. With rate limiting, impact is limited.
- **WebRTC:** Signaling only; media is P2P. Low CPU.
- **Socket.io:** Event handling is lightweight.
- **DB:** Parameterized queries; no N+1 in hot paths after prior fixes.

### WebSocket Scaling Limits
- **Single process:** ~10k connections per Node process is feasible.
- **Your scale:** 100–1000 users, likely <200 concurrent sockets. Single instance is sufficient.
- **Limit:** In-memory adapter; no horizontal scaling without Redis adapter.

### Risk Points Under 50+ Concurrent Users
| Risk | Mitigation |
|------|-------------|
| DB connection exhaustion | Pool max 10; Neon pooler if needed |
| Memory leak | PM2 `max_memory_restart` |
| Socket flood | App-level rate limit (120/min) + Nginx limits |
| Login brute force | Auth rate limit (10/15min) + Nginx auth_limit |

### Recommended Monitoring Tools
- **PM2 Plus** (optional): Process metrics, alerts.
- **Uptime Kuma** or **Healthchecks.io**: HTTP health checks.
- **Neon dashboard:** Connection and query metrics.
- **RHEL:** `top`, `htop`, `vmstat` for CPU/memory.

---

## 8. LOGGING & MONITORING

### Log Rotation Required?
**Yes.** PM2 logs grow unbounded without rotation.

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
```

### Should journald Be Used?
- PM2 manages process logs.
- Nginx logs to `/var/log/nginx/`.
- **journald:** Use for system/PM2 service unit logs if you run PM2 as a systemd service. Optional.

### Health Check Endpoint Needed?
**Yes — production blocker.** No `/health` or `/api/health` exists. Needed for:
- Load balancer checks
- Uptime monitoring
- Orchestration (e.g. Docker/K8s)

**Required addition:**
```javascript
// In app.js or routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

For deeper checks, add DB ping:
```javascript
app.get('/health', async (req, res) => {
  try {
    await getPool().query('SELECT 1');
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (e) {
    res.status(503).json({ status: 'degraded', db: 'disconnected' });
  }
});
```

### Uptime Monitoring Suggestions
- **Healthchecks.io:** Cron pings `/health` every 5 min.
- **Uptime Kuma:** Self-hosted, checks HTTP + keywords.
- **Pingdom / Better Uptime:** Commercial options.

---

## 9. PRODUCTION LAUNCH CHECKLIST

### Pre-Deploy (Local)
- [ ] Add `engines` to `package.json`: `"node": ">=18.0.0"`
- [ ] Add `/health` endpoint (with optional DB check)
- [ ] Create `ecosystem.config.js` for PM2
- [ ] Set `NODE_ENV=production` in deployment
- [ ] Verify `JWT_SECRET`, `DATABASE_URL`, `FRONTEND_URL` in production env

### Server Setup
- [ ] RHEL 8/9 updated: `sudo dnf update -y`
- [ ] Install Node.js 20: `sudo dnf module install nodejs:20`
- [ ] Install Nginx: `sudo dnf install -y nginx`
- [ ] Install Certbot: `sudo dnf install -y certbot python3-certbot-nginx`
- [ ] Install PM2: `sudo npm install -g pm2`
- [ ] Install Fail2ban: `sudo dnf install -y fail2ban`

### Firewall
- [ ] Allow 80, 443: `sudo firewall-cmd --permanent --add-service={http,https}`
- [ ] Reload: `sudo firewall-cmd --reload`
- [ ] Confirm 4000 is not exposed

### SSL
- [ ] Point DNS for `api.yourdomain.com` to server IP
- [ ] Run: `sudo certbot --nginx -d api.yourdomain.com`
- [ ] Test renewal: `sudo certbot renew --dry-run`

### Nginx
- [ ] Create `/etc/nginx/conf.d/chat-api.conf` (use config above)
- [ ] Test: `sudo nginx -t`
- [ ] Reload: `sudo nginx -s reload`

### Application
- [ ] Clone repo or upload build to `/var/www/chat-api` (or similar)
- [ ] Create `/var/www/chat-api/.env` with production vars
- [ ] Run `npm ci --omit=dev`
- [ ] Start: `pm2 start ecosystem.config.js`
- [ ] Save: `pm2 save`
- [ ] Enable startup: `pm2 startup` (run the command it outputs)

### PM2 Log Rotation
- [ ] `pm2 install pm2-logrotate`
- [ ] Set max_size, retain, compress

### Post-Deploy Verification
- [ ] `curl -k https://api.yourdomain.com/health` returns 200
- [ ] `curl https://api.yourdomain.com/api/auth/login` returns 400/401 (not 502)
- [ ] Frontend can connect to Socket.io
- [ ] WebRTC call works over HTTPS

### Production Blockers (Resolved)
1. ~~No health endpoint~~ — `/health` added; returns 200 + DB status.
2. ~~`engines` missing~~ — `"engines": { "node": ">=18.0.0" }` added to `package.json`.
3. ~~PM2 config~~ — `ecosystem.config.js` created.

### Artifacts Added
- `ecosystem.config.js` — PM2 production config
- `deploy/nginx-chat-api.conf.example` — Nginx config template

---

*End of RHEL Deployment Audit*
