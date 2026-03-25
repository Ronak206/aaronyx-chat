import { createServer } from 'http'
import { Server, Socket } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Types
interface User {
  id: string
  username: string
  socketId: string
}

interface Message {
  id: string
  chatId: string
  senderId: string
  content: string
  type: string
  createdAt: Date
}

interface RoomState {
  isPlaying: boolean
  currentProgress: number
  lastUpdate: number
}

// In-memory stores
const users = new Map<string, User>()
const userSockets = new Map<string, Set<string>>() // userId -> Set of socketIds
const roomParticipants = new Map<string, Set<string>>() // roomId -> Set of userIds
const roomStates = new Map<string, RoomState>() // roomId -> RoomState
const callPairs = new Map<string, string>() // callerId -> receiverId

const generateId = () => Math.random().toString(36).substr(2, 9)

// Helper to get all socket IDs for a user
function getUserSockets(userId: string): string[] {
  return Array.from(userSockets.get(userId) || [])
}

// Helper to emit to all sockets of a user
function emitToUser(userId: string, event: string, data: any) {
  const socketIds = getUserSockets(userId)
  socketIds.forEach(socketId => {
    const socket = io.sockets.sockets.get(socketId)
    if (socket) {
      socket.emit(event, data)
    }
  })
}

io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`)

  // ==================== USER EVENTS ====================
  
  socket.on('user:connect', (data: { userId: string; username: string }) => {
    const { userId, username } = data
    
    // Add user to store
    users.set(socket.id, { id: userId, username, socketId: socket.id })
    
    // Track user's sockets
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set())
    }
    userSockets.get(userId)!.add(socket.id)
    
    // Notify friends about online status
    socket.broadcast.emit('user:online', { userId, username })
    
    console.log(`User ${username} (${userId}) connected`)
  })

  socket.on('disconnect', () => {
    const user = users.get(socket.id)
    
    if (user) {
      // Remove socket from user's sockets
      const sockets = userSockets.get(user.id)
      if (sockets) {
        sockets.delete(socket.id)
        
        // If no more sockets, user is offline
        if (sockets.size === 0) {
          userSockets.delete(user.id)
          
          // Notify friends about offline status
          socket.broadcast.emit('user:offline', { userId: user.id })
          
          // Handle ongoing calls
          const callPartner = callPairs.get(user.id)
          if (callPartner) {
            emitToUser(callPartner, 'call:ended', { reason: 'User disconnected' })
            callPairs.delete(user.id)
            callPairs.delete(callPartner)
          }
          
          console.log(`User ${user.username} (${user.id}) went offline`)
        }
      }
      
      users.delete(socket.id)
    }
    
    console.log(`Socket disconnected: ${socket.id}`)
  })

  // ==================== MESSAGE EVENTS ====================
  
  socket.on('message:send', (data: { 
    chatId: string
    senderId: string
    content: string
    type?: string
    mediaUrl?: string
    receiverIds: string[]
  }) => {
    const message: Message = {
      id: generateId(),
      chatId: data.chatId,
      senderId: data.senderId,
      content: data.content,
      type: data.type || 'text',
      createdAt: new Date()
    }
    
    // Emit to all receivers
    data.receiverIds.forEach(receiverId => {
      emitToUser(receiverId, 'message:received', message)
    })
    
    // Confirm to sender
    socket.emit('message:sent', message)
    
    console.log(`Message sent in chat ${data.chatId} by ${data.senderId}`)
  })

  socket.on('message:read', (data: { 
    chatId: string
    messageId: string
    readerId: string
    senderId: string
  }) => {
    // Notify the sender that their message was read
    emitToUser(data.senderId, 'message:read', {
      chatId: data.chatId,
      messageId: data.messageId,
      readerId: data.readerId
    })
  })

  // ==================== TYPING EVENTS ====================
  socket.on('typing:start', (data: { chatId: string; userId: string; username: string }) => {
    socket.broadcast.emit('typing:started', data)
  })

  socket.on('typing:stop', (data: { chatId: string; userId: string }) => {
    socket.broadcast.emit('typing:stopped', data)
  })

  // ==================== CALL EVENTS ====================
  
  socket.on('call:offer', (data: {
    callerId: string
    callerName: string
    receiverId: string
    offer: RTCSessionDescriptionInit
    type: 'voice' | 'video'
  }) => {
    // Store call pair
    callPairs.set(data.callerId, data.receiverId)
    callPairs.set(data.receiverId, data.callerId)
    
    // Emit to receiver
    emitToUser(data.receiverId, 'call:incoming', {
      callerId: data.callerId,
      callerName: data.callerName,
      offer: data.offer,
      type: data.type
    })
    
    console.log(`Call offer from ${data.callerId} to ${data.receiverId}`)
  })

  socket.on('call:answer', (data: {
    callerId: string
    receiverId: string
    answer: RTCSessionDescriptionInit
  }) => {
    // Emit to caller
    emitToUser(data.callerId, 'call:answered', {
      receiverId: data.receiverId,
      answer: data.answer
    })
    
    console.log(`Call answered by ${data.receiverId}`)
  })

  socket.on('call:ice-candidate', (data: {
    userId: string
    candidate: RTCIceCandidateInit
    targetUserId: string
  }) => {
    // Emit ICE candidate to target
    emitToUser(data.targetUserId, 'call:ice-candidate', {
      userId: data.userId,
      candidate: data.candidate
    })
  })

  socket.on('call:hangup', (data: {
    callerId?: string
    receiverId?: string
    userId: string
  }) => {
    const partnerId = callPairs.get(data.userId)
    
    if (partnerId) {
      emitToUser(partnerId, 'call:ended', { reason: 'User hung up' })
      callPairs.delete(data.userId)
      callPairs.delete(partnerId)
    }
    
    console.log(`Call ended by ${data.userId}`)
  })

  socket.on('call:decline', (data: {
    callerId: string
    receiverId: string
  }) => {
    emitToUser(data.callerId, 'call:declined', { receiverId: data.receiverId })
    callPairs.delete(data.callerId)
    callPairs.delete(data.receiverId)
    
    console.log(`Call declined by ${data.receiverId}`)
  })

  // ==================== MOVIE ROOM EVENTS ====================
  
  socket.on('room:join', (data: { 
    roomId: string
    userId: string
    username: string
    avatar?: string
  }) => {
    // Join socket.io room
    socket.join(`room:${data.roomId}`)
    
    // Track participants
    if (!roomParticipants.has(data.roomId)) {
      roomParticipants.set(data.roomId, new Set())
    }
    roomParticipants.get(data.roomId)!.add(data.userId)
    
    // Initialize room state if not exists
    if (!roomStates.has(data.roomId)) {
      roomStates.set(data.roomId, {
        isPlaying: false,
        currentProgress: 0,
        lastUpdate: Date.now()
      })
    }
    
    // Notify others in room
    socket.to(`room:${data.roomId}`).emit('room:user-joined', {
      userId: data.userId,
      username: data.username,
      avatar: data.avatar
    })
    
    // Send current state to joiner
    const state = roomStates.get(data.roomId)
    socket.emit('room:state', state)
    
    console.log(`User ${data.username} joined room ${data.roomId}`)
  })

  socket.on('room:leave', (data: { roomId: string; userId: string; username: string }) => {
    socket.leave(`room:${data.roomId}`)
    
    const participants = roomParticipants.get(data.roomId)
    if (participants) {
      participants.delete(data.userId)
      if (participants.size === 0) {
        roomParticipants.delete(data.roomId)
        roomStates.delete(data.roomId)
      }
    }
    
    socket.to(`room:${data.roomId}`).emit('room:user-left', {
      userId: data.userId,
      username: data.username
    })
    
    console.log(`User ${data.username} left room ${data.roomId}`)
  })

  socket.on('room:sync', (data: {
    roomId: string
    userId: string
    action: 'play' | 'pause' | 'seek'
    progress: number
  }) => {
    // Update room state
    const state = roomStates.get(data.roomId)
    if (state) {
      state.isPlaying = data.action === 'play'
      state.currentProgress = data.progress
      state.lastUpdate = Date.now()
    }
    
    // Broadcast to all in room except sender
    socket.to(`room:${data.roomId}`).emit('room:sync', {
      action: data.action,
      progress: data.progress,
      userId: data.userId
    })
    
    console.log(`Room ${data.roomId}: ${data.action} at ${data.progress}`)
  })

  socket.on('room:chat', (data: {
    roomId: string
    userId: string
    username: string
    avatar?: string
    content: string
  }) => {
    const message = {
      id: generateId(),
      roomId: data.roomId,
      userId: data.userId,
      username: data.username,
      avatar: data.avatar,
      content: data.content,
      createdAt: new Date()
    }
    
    io.to(`room:${data.roomId}`).emit('room:message', message)
  })

  // ==================== ERROR HANDLING ====================
  
  socket.on('error', (error) => {
    console.error(`Socket error (${socket.id}):`, error)
  })
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`Aaronyx WebSocket server running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal, shutting down server...')
  httpServer.close(() => {
    console.log('WebSocket server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('Received SIGINT signal, shutting down server...')
  httpServer.close(() => {
    console.log('WebSocket server closed')
    process.exit(0)
  })
})
