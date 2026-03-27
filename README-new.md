# Private Messaging Backend

Production-ready 1-to-1 private messaging backend with custom per-user message modes.

## Features

- **1-to-1 Chat System**: Private conversations between two users
- **Real-time Messaging**: Socket.IO for instant message delivery
- **Custom Message Modes**: Per-user message settings per chat
- **JWT Authentication**: Secure token-based authentication
- **MongoDB**: Scalable database with TTL indexes
- **View Once Messages**: Messages disappear when user leaves chat
- **24 Hour Expiration**: Automatic message deletion after 24 hours
- **Online Status**: Real-time user presence tracking

## Message Modes

### Normal
- Messages persist until manually deleted
- Default mode for all chats

### View Once
- Messages disappear ONLY when user leaves chat screen
- Per-user deletion (not global)
- Only affects received messages, not sent messages

### Expire 24h
- Messages automatically delete after 24 hours
- Global deletion for both users
- Uses MongoDB TTL index

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user profile

### Chats
- `POST /api/chat/find-or-create` - Find or create chat
- `GET /api/chat` - Get user chats
- `GET /api/chat/:chatId` - Get chat details

### Messages
- `GET /api/chat/:chatId/messages` - Get chat messages
- `POST /api/chat/:chatId/messages` - Send message
- `PUT /api/chat/:chatId/read` - Mark messages as read
- `DELETE /api/chat/:chatId/view-once` - Delete view_once messages

### Chat Settings
- `GET /api/chat/:chatId/setting` - Get user chat setting
- `PUT /api/chat/:chatId/setting` - Update user chat setting

## Socket Events

### Client to Server
- `chat_opened` - User opens chat
- `chat_closed` - User leaves chat (triggers view_once deletion)
- `typing` - User typing status

### Server to Client
- `message_received` - New message received
- `messages_read` - Messages marked as read
- `messages_deleted_for_user` - View once messages deleted
- `user_typing` - User typing notification

## Database Schema

### Message
```javascript
{
  chatId: ObjectId,
  senderId: ObjectId,
  receiverId: ObjectId,
  content: String,
  messageType: ['normal', 'view_once', 'expire_24h'],
  expiresAt: Date, // For 24h messages
  isDeletedFor: [ObjectId], // Per-user deletion
  readAt: Date,
  deliveredAt: Date
}
```

### ChatUserSetting
```javascript
{
  chatId: ObjectId,
  userId: ObjectId,
  mode: ['normal', 'view_once', 'expire_24h']
}
```

### Chat
```javascript
{
  participants: [ObjectId], // Exactly 2 users
  lastMessage: String,
  lastMessageAt: Date,
  isActive: Boolean
}
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start MongoDB:
```bash
# Make sure MongoDB is running on localhost:27017
```

4. Start the server:
```bash
npm run dev
# or
npm start
```

## Usage

### 1. User Registration & Login
```javascript
// Register
POST /api/auth/register
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123"
}

// Login
POST /api/auth/login
{
  "email": "john@example.com",
  "password": "password123"
}
```

### 2. Create Chat
```javascript
POST /api/chat/find-or-create
{
  "participantId": "user_id_here"
}
```

### 3. Set Message Mode
```javascript
PUT /api/chat/:chatId/setting
{
  "mode": "view_once" // or "expire_24h"
}
```

### 4. Send Message
```javascript
POST /api/chat/:chatId/messages
{
  "content": "Hello, world!",
  "receiverId": "user_id_here"
}
```

### 5. Socket Connection
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: 'your_jwt_token'
  }
});

// Open chat
socket.emit('chat_opened', { chatId });

// Close chat (triggers view_once deletion)
socket.emit('chat_closed', { chatId });
```

## Architecture

- **Models**: Mongoose schemas with proper indexing
- **Controllers**: Business logic separation
- **Middleware**: JWT authentication and validation
- **Socket Handler**: Real-time event management
- **Routes**: RESTful API endpoints

## Security Features

- JWT token authentication
- Password hashing with bcrypt
- Input validation and sanitization
- CORS configuration
- Per-user message deletion
- Secure socket authentication

## Performance

- MongoDB compound indexes
- TTL indexes for auto-deletion
- Efficient socket room management
- Optimized message queries
- Graceful error handling

## Deployment

1. Set production environment variables
2. Configure MongoDB connection string
3. Set JWT secret
4. Deploy to your preferred platform

## License

MIT
