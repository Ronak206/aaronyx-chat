import { create } from 'zustand'

export interface User {
  id: string
  username: string
  email?: string | null
  displayName?: string | null
  avatar?: string | null
  bio?: string | null
  isOnline?: boolean
  lastSeen?: Date | null
  createdAt?: Date
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),
  logout: () => {
    set({ user: null, isAuthenticated: false })
  },
}))
