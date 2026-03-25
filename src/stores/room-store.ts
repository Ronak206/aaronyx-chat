import { create } from 'zustand'

export interface RoomParticipant {
  id: string
  userId: string
  role: 'host' | 'viewer'
  user: {
    id: string
    username: string
    displayName?: string | null
    avatar?: string | null
  }
}

export interface RoomMessage {
  id: string
  roomId: string
  userId: string
  username: string
  avatar?: string | null
  content: string
  createdAt: Date
}

export interface MovieRoom {
  id: string
  name: string
  description?: string | null
  videoUrl?: string | null
  videoType: string
  isPublic: boolean
  maxParticipants: number
  currentProgress: number
  isPlaying: boolean
  createdAt: Date
  createdBy: {
    id: string
    username: string
    displayName?: string | null
    avatar?: string | null
  }
  participants: RoomParticipant[]
  messages?: RoomMessage[]
}

interface RoomState {
  rooms: MovieRoom[]
  currentRoom: MovieRoom | null
  participants: RoomParticipant[]
  messages: RoomMessage[]
  isPlaying: boolean
  currentProgress: number
  
  // Actions
  setRooms: (rooms: MovieRoom[]) => void
  addRoom: (room: MovieRoom) => void
  setCurrentRoom: (room: MovieRoom | null) => void
  setParticipants: (participants: RoomParticipant[]) => void
  addParticipant: (participant: RoomParticipant) => void
  removeParticipant: (userId: string) => void
  setMessages: (messages: RoomMessage[]) => void
  addMessage: (message: RoomMessage) => void
  setPlaybackState: (isPlaying: boolean, progress: number) => void
  clearRoom: () => void
}

export const useRoomStore = create<RoomState>((set) => ({
  rooms: [],
  currentRoom: null,
  participants: [],
  messages: [],
  isPlaying: false,
  currentProgress: 0,
  
  setRooms: (rooms) => set({ rooms }),
  addRoom: (room) => set((state) => ({ rooms: [room, ...state.rooms] })),
  setCurrentRoom: (room) => set({ currentRoom: room, participants: room?.participants || [], messages: room?.messages || [] }),
  setParticipants: (participants) => set({ participants }),
  addParticipant: (participant) => set((state) => ({
    participants: [...state.participants, participant]
  })),
  removeParticipant: (userId) => set((state) => ({
    participants: state.participants.filter((p) => p.userId !== userId)
  })),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  setPlaybackState: (isPlaying, progress) => set({ isPlaying, currentProgress: progress }),
  clearRoom: () => set({
    currentRoom: null,
    participants: [],
    messages: [],
    isPlaying: false,
    currentProgress: 0,
  }),
}))
