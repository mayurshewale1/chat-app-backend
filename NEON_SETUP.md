# Neon PostgreSQL Setup

The backend now uses **Neon** (serverless PostgreSQL) instead of MongoDB.

## 1. Create a Neon Project

1. Go to [console.neon.tech](https://console.neon.tech)
2. Sign up or log in
3. Click **New Project**
4. Choose a name (e.g. `chatapp`) and region
5. Click **Create Project**

## 2. Get Your Connection String

1. In the Neon dashboard, click **Connect** on your project
2. Select **Node.js** from the driver dropdown
3. Copy the connection string (looks like):
   ```
   postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

## 3. Update `.env`

In `backend/.env`, set:

```
DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
```

Replace with your actual connection string from Neon.

## 4. Run the Backend

```bash
cd backend
npm run dev
```

The schema will be applied automatically on first run (tables, indexes, etc.).

## 5. Schema (Manual Option)

To run the schema manually in Neon SQL Editor:

1. In Neon dashboard, go to **SQL Editor**
2. Copy the contents of `src/db/schema.sql`
3. Paste and run

## Tables Created

- `users` - User accounts
- `chats` - Chat rooms
- `chat_members` - Many-to-many chat membership
- `messages` - Chat messages
- `connections` - Friend/connection requests
