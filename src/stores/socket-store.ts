import { create } from 'zustand'
import { io, Socket } from 'socket.io-client'

interface SocketState {
  socket: Socket | null
  isConnected: boolean
  connect: () => void
  disconnect: () => void
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  
  connect: () => {
    const { socket: existingSocket } = get()
    
    // Don't reconnect if already connected
    if (existingSocket?.connected) {
      return
    }
    
    // Disconnect existing socket if any
    if (existingSocket) {
      existingSocket.disconnect()
    }
    
    const socketInstance = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    })
    
    socketInstance.on('connect', () => {
      console.log('Socket connected:', socketInstance.id)
      set({ isConnected: true })
    })
    
    socketInstance.on('disconnect', () => {
      console.log('Socket disconnected')
      set({ isConnected: false })
    })
    
    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
    })
    
    set({ socket: socketInstance })
  },
  
  disconnect: () => {
    const { socket } = get()
    if (socket) {
      socket.disconnect()
      set({ socket: null, isConnected: false })
    }
  },
}))
