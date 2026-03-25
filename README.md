# 🎬 AaronYX - Real-Time Communication Platform

<p align="center">
  <strong>A comprehensive full-stack real-time communication web application</strong><br>
  Combining the best features of WhatsApp, Zoom, and Teleparty
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#api-documentation">API</a> •
  <a href="#deployment">Deployment</a>
</p>

---

## 🌟 Overview

AaronYX is a modern, feature-rich communication platform that enables users to connect through real-time messaging, voice/video calls, and synchronized media watching experiences. Built with cutting-edge technologies, it provides a seamless and responsive user experience across all devices.

## ✨ Features

### 🔐 Authentication & User System
- **Username-based registration** - No phone number required
- **JWT Authentication** - Secure HTTP-only cookie sessions
- **Password Hashing** - bcrypt with 12 salt rounds
- **User Search** - Find users by username (Instagram-like)
- **Profile Management** - Avatar, display name, bio

### 💬 Chat System (WhatsApp-style)
- **Real-time Messaging** - Powered by Socket.IO
- **Message Status** - Sent, delivered, read indicators
- **Typing Indicators** - See when others are typing
- **One-to-One Chats** - Private conversations
- **Group Chats** - Create groups with multiple members
- **Admin Roles** - Manage group membership
- **Media Support** - Images, videos, files

### 📞 Voice & Video Calling (Zoom-style)
- **WebRTC-based Calls** - High-quality audio/video
- **Voice Calls** - Crystal clear audio
- **Video Calls** - HD video conferencing
- **Call Controls** - Mute/unmute, camera on/off
- **Call History** - Track all your calls
- **Incoming Call UI** - Accept/decline dialogs

### 🎬 Movie Rooms (Teleparty-style)
- **Create Watch Rooms** - Host synchronized viewing sessions
- **YouTube Integration** - Watch YouTube videos together
- **Synchronized Playback** - Play/pause/seek synced for all
- **Room Chat** - Live chat while watching
- **Participant Management** - Host/viewer roles
- **Room Links** - Share via unique URLs

### 🎨 UI/UX Features
- **Responsive Design** - Mobile-first approach
- **Dark/Light Mode** - Toggle theme preference
- **Modern UI** - Built with shadcn/ui components
- **Real-time Updates** - Instant notifications
- **Smooth Animations** - Framer Motion transitions

## 🛠 Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| Next.js 16 | React framework with App Router |
| React 19 | UI library |
| TypeScript 5 | Type safety |
| Tailwind CSS 4 | Styling |
| shadcn/ui | UI components |
| Zustand | State management |
| Socket.IO Client | Real-time communication |
| ReactPlayer | Video playback |

### Backend
| Technology | Purpose |
|------------|---------|
| Next.js API Routes | REST endpoints |
| Socket.IO Server | WebSocket server |
| Prisma ORM | Database abstraction |
| JWT | Authentication |
| bcrypt | Password hashing |

### Database & Storage
| Technology | Purpose |
|------------|---------|
| MongoDB Atlas | Primary database |
| Cloudinary/AWS S3 | Media storage (optional) |

### Real-time Infrastructure
| Technology | Purpose |
|------------|---------|
| Socket.IO | WebSocket communication |
| WebRTC | Peer-to-peer calls |
| STUN Servers | NAT traversal |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ or Bun
- MongoDB Atlas account (or local MongoDB)
- Git

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/ronak/aaronyx-chat.git
cd aaronyx-chat
```

2. **Install dependencies**
```bash
bun install
# or
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/aaronyx?retryWrites=true&w=majority"
JWT_SECRET="your-super-secret-jwt-key"
NODE_ENV="development"
```

4. **Push database schema**
```bash
bun run db:push
# or
npx prisma db push
```

5. **Start the development servers**

Terminal 1 - Next.js:
```bash
bun run dev
```

Terminal 2 - Socket.IO Server:
```bash
cd mini-services/socket-server && bun run dev
```

6. **Open your browser**
Navigate to `http://localhost:3000`

## 📁 Project Structure

```
aaronyx-chat/
├── prisma/
│   └── schema.prisma          # Database schema
├── public/
│   └── logo.svg               # App logo
├── src/
│   ├── app/
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # Authentication
│   │   │   ├── chats/         # Chat endpoints
│   │   │   ├── calls/         # Call history
│   │   │   ├── rooms/         # Movie rooms
│   │   │   ├── groups/        # Group management
│   │   │   └── users/         # User operations
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Main app
│   ├── components/
│   │   └── ui/                # UI components
│   ├── hooks/                 # Custom hooks
│   ├── lib/
│   │   ├── auth.ts            # Auth utilities
│   │   ├── db.ts              # Database client
│   │   └── utils.ts           # Helper functions
│   └── stores/                # Zustand stores
│       ├── auth-store.ts
│       ├── chat-store.ts
│       ├── call-store.ts
│       └── room-store.ts
├── mini-services/
│   └── socket-server/         # Socket.IO server
│       └── index.ts
├── .env.example
├── package.json
└── README.md
```

## 📡 API Documentation

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "password": "securepassword",
  "email": "john@example.com" // optional
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "johndoe",
  "password": "securepassword"
}
```

#### Get Current User
```http
GET /api/auth/me
Cookie: token=<jwt_token>
```

#### Logout
```http
POST /api/auth/logout
```

### Users

#### Search Users
```http
GET /api/users?q=<search_query>
```

#### Get User Profile
```http
GET /api/users/[id]
```

#### Update Profile
```http
PUT /api/users/profile
Content-Type: application/json

{
  "displayName": "John Doe",
  "bio": "Hello World!",
  "avatar": "https://..."
}
```

### Chats

#### Get All Chats
```http
GET /api/chats
```

#### Create Chat
```http
POST /api/chats
Content-Type: application/json

{
  "userId": "<target_user_id>"
}
```

#### Get Messages
```http
GET /api/chats/[id]/messages
```

#### Send Message
```http
POST /api/chats/[id]/messages
Content-Type: application/json

{
  "content": "Hello!",
  "type": "text"
}
```

### Movie Rooms

#### Get All Rooms
```http
GET /api/rooms
```

#### Create Room
```http
POST /api/rooms
Content-Type: application/json

{
  "name": "Movie Night",
  "videoUrl": "https://youtube.com/watch?v=...",
  "isPublic": true
}
```

#### Join Room
```http
POST /api/rooms/[id]/join
```

#### Leave Room
```http
POST /api/rooms/[id]/leave
```

### Calls

#### Get Call History
```http
GET /api/calls/history
```

## 🔌 WebSocket Events

### Connection
```javascript
socket.emit('user:connect', { userId, username })
```

### Messaging
```javascript
// Send message
socket.emit('message:send', { chatId, senderId, content, receiverIds })

// Receive message
socket.on('message:received', (message) => {})

// Typing indicators
socket.emit('typing:start', { chatId, userId, username })
socket.emit('typing:stop', { chatId, userId })
```

### Calls
```javascript
// Offer call
socket.emit('call:offer', { callerId, callerName, receiverId, offer, type })

// Answer call
socket.emit('call:answer', { callerId, receiverId, answer })

// ICE candidates
socket.emit('call:ice-candidate', { userId, candidate, targetUserId })

// End call
socket.emit('call:hangup', { userId })

// Decline call
socket.emit('call:decline', { callerId, receiverId })
```

### Movie Rooms
```javascript
// Join room
socket.emit('room:join', { roomId, userId, username, avatar })

// Leave room
socket.emit('room:leave', { roomId, userId, username })

// Sync playback
socket.emit('room:sync', { roomId, userId, action, progress })

// Room chat
socket.emit('room:chat', { roomId, userId, username, content })
```

## 🔒 Security

- **Password Hashing** - bcrypt with 12 salt rounds
- **JWT Tokens** - 7-day expiration, HTTP-only cookies
- **Input Validation** - All inputs sanitized
- **CORS Protection** - Configured for production
- **Environment Variables** - Sensitive data protected

## 🚢 Deployment

### Vercel (Recommended)

1. **Push your code to GitHub**

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Select the `aaronyx-chat` repo

3. **Add Environment Variables in Vercel**
   
   Go to **Settings → Environment Variables** and add:
   
   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | `mongodb+srv://ronak:ronak2026@purompto.dxi3scc.mongodb.net/aaronyx?retryWrites=true&w=majority` |
   | `JWT_SECRET` | `your-super-secret-jwt-key-here` |
   
   ⚠️ **Important**: Make sure to use the exact variable names above.

4. **Configure MongoDB Atlas Network Access**
   
   - Go to MongoDB Atlas Dashboard
   - Navigate to **Network Access** under Security
   - Click **Add IP Address**
   - Click **Allow Access from Anywhere** (adds `0.0.0.0/0`)
   - Click **Confirm**
   
   This is required because Vercel uses dynamic IPs.

5. **Deploy**
   
   Vercel will automatically deploy when you push to GitHub.

### Troubleshooting Vercel Deployment

**Error: "Error creating a database connection"**
- ✅ Verify `DATABASE_URL` is set in Vercel Environment Variables
- ✅ Ensure MongoDB Atlas allows access from `0.0.0.0/0`
- ✅ Check that your MongoDB password is URL-encoded if it contains special characters

**Error: "Prisma Client could not be generated"**
- The build command should include `prisma generate`
- Check `vercel.json` for proper build configuration

### Docker (Alternative)

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t aaronyx .
docker run -p 3000:3000 -e DATABASE_URL="your-mongodb-url" -e JWT_SECRET="your-secret" aaronyx
```

### Manual Deployment

1. Build the application:
```bash
npm run build
```

2. Start the server:
```bash
npm start
```

3. Start Socket.IO server:
```bash
cd mini-services/socket-server && npm start
```

## 📈 Scalability

For production scaling:

1. **Redis Adapter** for Socket.IO
```javascript
import { createAdapter } from '@socket.io/redis-adapter'
io.adapter(createAdapter(redisClient))
```

2. **Load Balancer** for multiple instances
3. **CDN** for static assets
4. **MongoDB Replica Sets** for database scaling

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - The React Framework
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components
- [Socket.IO](https://socket.io/) - Real-time bidirectional event-based communication
- [Prisma](https://www.prisma.io/) - Next-generation ORM
- [MongoDB](https://www.mongodb.com/) - The database for modern applications

---

<p align="center">
  Made with ❤️ by the AaronYX Team
</p>
