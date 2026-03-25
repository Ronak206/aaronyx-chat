import { create } from 'zustand'

export interface ChatUser {
  id: string
  username: string
  displayName?: string | null
  avatar?: string | null
  isOnline?: boolean
  lastSeen?: Date | null
}

export interface Message {
  id: string
  chatId: string
  senderId: string
  content: string
  type: string
  mediaUrl?: string | null
  status: string
  createdAt: Date
  sender?: {
    id: string
    username: string
    displayName?: string | null
    avatar?: string | null
  }
}

export interface Chat {
  id: string
  type: string
  name: string
  avatar?: string | null
  lastMessage?: Message | null
  members: ChatUser[]
  updatedAt: Date
  unreadCount?: number
}

interface ChatState {
  chats: Chat[]
  currentChat: Chat | null
  messages: Message[]
  typingUsers: { [chatId: string]: string[] }
  isMessagesLoading: boolean
  
  setChats: (chats: Chat[]) => void
  addChat: (chat: Chat) => void
  setCurrentChat: (chat: Chat | null) => void
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void
  addMessage: (message: Message) => void
  setTyping: (chatId: string, userId: string, isTyping: boolean) => void
  setMessagesLoading: (loading: boolean) => void
  updateMessageStatus: (messageId: string, status: string) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  currentChat: null,
  messages: [],
  typingUsers: {},
  isMessagesLoading: false,
  
  setChats: (chats) => set({ chats }),
  
  addChat: (chat) => set((state) => ({
    chats: [chat, ...state.chats]
  })),
  
  setCurrentChat: (chat) => set({ currentChat: chat, messages: [] }),
  
  setMessages: (messages) => {
    if (typeof messages === 'function') {
      set((state) => ({ messages: messages(state.messages) }))
    } else {
      set({ messages })
    }
  },
  
  addMessage: (message) => set((state) => {
    // Update chat's last message and move to top
    const chats = state.chats.map((chat) => {
      if (chat.id === message.chatId) {
        return { ...chat, lastMessage: message, updatedAt: new Date() }
      }
      return chat
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    
    return {
      messages: [...state.messages, message],
      chats,
    }
  }),
  
  setTyping: (chatId, userId, isTyping) => set((state) => {
    const typingUsers = { ...state.typingUsers }
    if (!typingUsers[chatId]) {
      typingUsers[chatId] = []
    }
    
    if (isTyping && !typingUsers[chatId].includes(userId)) {
      typingUsers[chatId] = [...typingUsers[chatId], userId]
    } else if (!isTyping) {
      typingUsers[chatId] = typingUsers[chatId].filter((id) => id !== userId)
    }
    
    return { typingUsers }
  }),
  
  setMessagesLoading: (loading) => set({ isMessagesLoading: loading }),
  
  updateMessageStatus: (messageId, status) => set((state) => ({
    messages: state.messages.map((msg) =>
      msg.id === messageId ? { ...msg, status } : msg
    ),
  })),
  
  clearMessages: () => set({ messages: [] }),
}))
