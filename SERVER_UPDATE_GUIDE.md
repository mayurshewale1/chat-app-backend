# Server Update Guide — Chat App Backend

How to update the backend on your server when you push new code to GitHub.

---

## Prerequisites

- Backend deployed at `~/chat-api` (or your path)
- PM2 running the app
- Git repo: `https://github.com/mayurshewale1/chat-app-backend`

---

## Step-by-Step Update Process

### 1. Push changes to GitHub (on your PC)

```powershell
cd d:\Projects\Chat-App\backend

git add .
git status
git commit -m "Your change description"
git push origin main
```

---

### 2. SSH into the server

```bash
ssh ec2-user@api.mayurr.in
# or
ssh ec2-user@16.171.140.136
```

---

### 3. Navigate to project folder

```bash
cd ~/chat-api
```

---

### 4. Pull latest code

```bash
git pull origin main
```

---

### 5. Install/update dependencies (if package.json changed)

```bash
npm ci --omit=dev
```

If `package.json` didn't change, you can skip this step.

---

### 6. Restart the app

```bash
pm2 restart chat-api
```

---

### 7. Verify

```bash
pm2 status
pm2 logs chat-api --lines 20
```

---

### 8. Test health endpoint

```bash
curl https://api.mayurr.in/health
```

Expected: `{"status":"ok","db":"connected",...}`

---

## Quick One-Liner (after SSH)

```bash
cd ~/chat-api && git pull origin main && npm ci --omit=dev && pm2 restart chat-api
```

---

## If .env Changed

If you updated `.env` or added new env vars:

1. Edit on server:

```bash
nano ~/chat-api/.env
```

2. Add/update values, save (`Ctrl+O`, `Enter`, `Ctrl+X`)

3. Restart:

```bash
pm2 restart chat-api
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `git pull` fails | `git stash` then `git pull`, or `git pull --rebase` |
| `npm ci` fails | `rm -rf node_modules` then `npm ci --omit=dev` |
| PM2 app not found | `pm2 start ecosystem.config.js` |
| App crashes after restart | `pm2 logs chat-api` to check errors |

---

## Update Checklist

- [ ] Push to GitHub from local
- [ ] SSH into server
- [ ] `cd ~/chat-api`
- [ ] `git pull origin main`
- [ ] `npm ci --omit=dev` (if deps changed)
- [ ] `pm2 restart chat-api`
- [ ] `curl https://api.mayurr.in/health`