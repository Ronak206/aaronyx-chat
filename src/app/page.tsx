'use client'

// Aaronyx - Real-Time Communication Platform
import { useEffect, useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore, User } from '@/stores/auth-store'
import { useChatStore, Chat, Message } from '@/stores/chat-store'
import { useCallStore, CallRecord } from '@/stores/call-store'
import { useRoomStore, MovieRoom, RoomMessage } from '@/stores/room-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import EmojiPicker from 'emoji-picker-react'
import { 
  MessageCircle, Video, Film, User as UserIcon, Settings, LogOut, Search, 
  Send, Phone, PhoneOff, Mic, MicOff, VideoOff, Share2, Users, Plus, 
  Moon, Sun, Check, CheckCheck, Play, Pause, SkipForward, Clock,
  Monitor, MonitorOff, X, Smile, Paperclip, MoreVertical, UserPlus,
  Hash, Volume2, VolumeX, Image as ImageIcon, FileText, Bell, BellOff
} from 'lucide-react'
import { toast } from 'sonner'

// Socket instance
let socket: Socket | null = null

// Types for the app
type View = 'chats' | 'calls' | 'rooms' | 'profile'
type ChatView = 'list' | 'conversation'

export default function AaronyxApp() {
  // Auth state
  const { user, isAuthenticated, isLoading, setUser, setLoading, logout } = useAuthStore()
  
  // Chat state
  const { 
    chats, currentChat, messages, typingUsers, 
    setChats, setCurrentChat, setMessages, addMessage, addChat, setTyping 
  } = useChatStore()
  
  // Call state
  const {
    isInCall, callType, callPartner, isCaller, callStatus,
    localStream, remoteStream, isMuted, isVideoOff,
    callHistory, peerConnection,
    setInCall, setCallType, setCallPartner, setIsCaller, setCallStatus,
    setLocalStream, setRemoteStream, toggleMute, toggleVideo,
    setCallHistory, setPeerConnection, resetCall
  } = useCallStore()
  
  // Room state
  const {
    rooms, currentRoom, participants, messages: roomMessages,
    isPlaying, currentProgress,
    setRooms, addRoom, setCurrentRoom, addParticipant, removeParticipant,
    addMessage: addRoomMessage, setPlaybackState, clearRoom
  } = useRoomStore()
  
  // Local state
  const [view, setView] = useState<View>('chats')
  const [chatView, setChatView] = useState<ChatView>('list')
  const [messageInput, setMessageInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [isSocketConnected, setIsSocketConnected] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [isTyping, setIsTyping] = useState(false)
  const [showNewChatDialog, setShowNewChatDialog] = useState(false)
  const [showNewRoomDialog, setShowNewRoomDialog] = useState(false)
  const [showEditProfileDialog, setShowEditProfileDialog] = useState(false)
  const [roomMessageInput, setRoomMessageInput] = useState('')
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomVideoUrl, setNewRoomVideoUrl] = useState('')
  const [editForm, setEditForm] = useState({ displayName: '', bio: '', avatar: '' })
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [jitsiRoom, setJitsiRoom] = useState<string | null>(null)
  
  // Auth forms
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [registerForm, setRegisterForm] = useState({ username: '', password: '', email: '' })
  const [isRegistering, setIsRegistering] = useState(false)
  
  // Video call refs
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  
  // Chat container ref for auto-scroll
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const roomChatRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const jitsiRef = useRef<HTMLDivElement>(null)

  // Theme effect
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  // Request notification permission
  useEffect(() => {
    if (user && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true)
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          setNotificationsEnabled(permission === 'granted')
        })
      }
    }
  }, [user])

  // Show browser notification
  const showNotification = useCallback((title: string, body: string, icon?: string) => {
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      new Notification(title, { body, icon: icon || '/logo.svg' })
    }
  }, [])

  // Toggle notifications
  const toggleNotifications = async () => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(false)
      } else {
        const permission = await Notification.requestPermission()
        setNotificationsEnabled(permission === 'granted')
      }
    }
  }

  // Jitsi Meet API loading
  const loadJitsiScript = useCallback(() => {
    return new Promise<void>((resolve) => {
      if (window.JitsiMeetExternalAPI) {
        resolve()
        return
      }
      const script = document.createElement('script')
      script.src = 'https://meet.jit.si/external_api.js'
      script.async = true
      script.onload = () => resolve()
      document.body.appendChild(script)
    })
  }, [])

  // Start Jitsi call
  const startJitsiCall = async (type: 'voice' | 'video', targetUser: User) => {
    try {
      await loadJitsiScript()
      
      const roomName = `aaronyx-${currentChat?.id || Date.now()}-${user?.id}-${targetUser.id}`
      setJitsiRoom(roomName)
      setCallPartner(targetUser)
      setCallType(type)
      setInCall(true)
      setCallStatus('connected')
      
      toast.success(`Starting ${type} call with ${targetUser.username}`)
    } catch (error) {
      console.error('Failed to start Jitsi call:', error)
      toast.error('Failed to start video call')
    }
  }

  // End Jitsi call
  const endJitsiCall = () => {
    setJitsiRoom(null)
    setInCall(false)
    setCallPartner(null)
    resetCall()
    toast.info('Call ended')
  }

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentChat || !user) return
    
    setIsUploading(true)
    
    try {
      // For now, we'll convert to base64 and store as text
      // In production, you'd upload to a cloud storage service
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = reader.result as string
        
        // Determine file type
        let messageType = 'file'
        if (file.type.startsWith('image/')) messageType = 'image'
        else if (file.type.startsWith('video/')) messageType = 'video'
        else if (file.type.startsWith('audio/')) messageType = 'audio'
        
        const tempId = `temp-${Date.now()}`
        const tempMessage: Message = {
          id: tempId,
          chatId: currentChat.id,
          senderId: user.id,
          content: `📎 ${file.name}`,
          type: messageType,
          mediaUrl: base64,
          status: 'sent',
          createdAt: new Date(),
          sender: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar,
          },
        }
        
        addMessage(tempMessage)
        
        // Send to API
        fetch(`/api/chats/${currentChat.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            content: file.name,
            type: messageType,
            mediaUrl: base64 
          }),
        })
          .then(res => res.json())
          .then(data => {
            if (data.message) {
              setMessages(prev => prev.map(m => m.id === tempId ? data.message : m))
            }
          })
          .catch(err => console.error('Upload error:', err))
      }
      
      reader.readAsDataURL(file)
    } catch (error) {
      toast.error('Failed to upload file')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Emoji handler
  const onEmojiClick = (emojiData: { emoji: string }) => {
    setMessageInput(prev => prev + emojiData.emoji)
  }

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          setUser(data.user)
        } else {
          setUser(null)
        }
      } catch {
        setUser(null)
      }
    }
    checkAuth()
  }, [setUser])

  // Connect socket when authenticated
  useEffect(() => {
    if (user && !socket) {
      // Socket server URL - for local dev it's localhost:3003
      // For production, set NEXT_PUBLIC_SOCKET_URL env variable
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
        ? 'http://localhost:3003' 
        : null)
      
      // Only connect if socket server is available
      if (!socketUrl) {
        console.log('No socket server configured - using polling for updates')
        setIsSocketConnected(false)
        return
      }
      
      try {
        socket = io(socketUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        })
        
        socket.on('connect', () => {
          setIsSocketConnected(true)
          socket?.emit('user:connect', { userId: user.id, username: user.username })
          console.log('Socket connected')
        })
        
        socket.on('disconnect', () => {
          setIsSocketConnected(false)
          console.log('Socket disconnected')
        })
        
        socket.on('connect_error', (error) => {
          console.log('Socket connection error:', error.message)
          setIsSocketConnected(false)
        })
        
        // Message events
        socket.on('message:received', (message: Message) => {
          addMessage(message)
          const senderName = message.sender?.displayName || message.sender?.username || 'Unknown'
          toast.info(`New message from ${senderName}`)
          // Show browser notification
          showNotification(`${senderName} sent a message`, message.content.slice(0, 50), message.sender?.avatar || undefined)
        })
        
        // Typing events
        socket.on('typing:started', (data: { chatId: string; userId: string; username: string }) => {
          setTyping(data.chatId, data.userId, true)
        })
        
        socket.on('typing:stopped', (data: { chatId: string; userId: string }) => {
          setTyping(data.chatId, data.userId, false)
        })
        
        // Call events
        socket.on('call:incoming', (data: { callerId: string; callerName: string; type: 'voice' | 'video'; offer: RTCSessionDescriptionInit }) => {
          setCallPartner({ id: data.callerId, username: data.callerName })
          setCallType(data.type)
          setIsCaller(false)
          setCallStatus('ringing')
        })
        
        socket.on('call:answered', async (data: { answer: RTCSessionDescriptionInit }) => {
          if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
            setCallStatus('connected')
          }
        })
        
        socket.on('call:ice-candidate', async (data: { candidate: RTCIceCandidateInit }) => {
          if (peerConnection) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
          }
        })
        
        socket.on('call:ended', () => {
          resetCall()
          toast.info('Call ended')
        })
        
        socket.on('call:declined', () => {
          resetCall()
          toast.error('Call was declined')
        })
        
        // Room events
        socket.on('room:user-joined', (data: { userId: string; username: string; avatar?: string }) => {
          addParticipant({
            id: data.userId,
            userId: data.userId,
            role: 'viewer',
            user: { id: data.userId, username: data.username, avatar: data.avatar }
          })
          toast.info(`${data.username} joined the room`)
        })
        
        socket.on('room:user-left', (data: { userId: string; username: string }) => {
          removeParticipant(data.userId)
          toast.info(`${data.username} left the room`)
        })
        
        socket.on('room:sync', (data: { action: 'play' | 'pause' | 'seek'; progress: number }) => {
          setPlaybackState(data.action === 'play', data.progress)
        })
        
        socket.on('room:message', (message: RoomMessage) => {
          addRoomMessage(message)
        })
        
        socket.on('room:state', (state: { isPlaying: boolean; currentProgress: number }) => {
          setPlaybackState(state.isPlaying, state.currentProgress)
        })
      } catch (error) {
        console.error('Socket initialization error:', error)
        setIsSocketConnected(false)
      }
    }
    
    return () => {
      if (!user && socket) {
        socket.disconnect()
        socket = null
      }
    }
  }, [user, addMessage, setTyping, setCallPartner, setCallType, setIsCaller, setCallStatus, peerConnection, resetCall, addParticipant, removeParticipant, setPlaybackState, addRoomMessage])

  // Load initial data when authenticated
  useEffect(() => {
    if (user) {
      loadChats()
      loadCallHistory()
      loadRooms()
    }
  }, [user])

  // Poll for chat list updates
  useEffect(() => {
    if (!user) return
    
    const pollInterval = setInterval(() => {
      loadChats()
    }, 5000) // Poll every 5 seconds
    
    return () => clearInterval(pollInterval)
  }, [user])

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      const scrollContainer = chatContainerRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages])

  // Auto-scroll room chat
  useEffect(() => {
    if (roomChatRef.current) {
      roomChatRef.current.scrollTop = roomChatRef.current.scrollHeight
    }
  }, [roomMessages])

  // Update video elements when streams change
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  // API Functions
  const loadChats = async () => {
    try {
      const res = await fetch('/api/chats')
      if (res.ok) {
        const data = await res.json()
        setChats(data.chats)
      }
    } catch (error) {
      console.error('Failed to load chats:', error)
    }
  }

  const loadCallHistory = async () => {
    try {
      const res = await fetch('/api/calls/history')
      if (res.ok) {
        const data = await res.json()
        setCallHistory(data.calls)
      }
    } catch (error) {
      console.error('Failed to load call history:', error)
    }
  }

  const loadRooms = async () => {
    try {
      const res = await fetch('/api/rooms')
      if (res.ok) {
        const data = await res.json()
        setRooms(data.rooms)
      }
    } catch (error) {
      console.error('Failed to load rooms:', error)
    }
  }

  const loadMessages = async (chatId: string) => {
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages)
        // Mark messages as read
        markMessagesAsRead(chatId)
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  const markMessagesAsRead = async (chatId: string) => {
    try {
      await fetch(`/api/chats/${chatId}/messages`, {
        method: 'PUT',
      })
    } catch (error) {
      console.error('Failed to mark messages as read:', error)
    }
  }

  // Poll for new messages (fallback for when socket is not connected)
  useEffect(() => {
    if (!user || !currentChat) return
    
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/chats/${currentChat.id}/messages`)
        if (res.ok) {
          const data = await res.json()
          // Merge messages - keep optimistic messages that haven't been confirmed yet
          setMessages(prev => {
            const optimisticIds = new Set(prev.filter(m => m.id.startsWith('temp-')).map(m => m.id))
            const serverMessages = data.messages.filter((m: Message) => !optimisticIds.has(m.id))
            const optimisticMessages = prev.filter(m => m.id.startsWith('temp-'))
            
            // Combine and deduplicate
            const allMessages = [...serverMessages, ...optimisticMessages]
            const uniqueMessages = allMessages.filter((msg, index, self) => 
              index === self.findIndex(m => m.id === msg.id)
            )
            
            return uniqueMessages.sort((a, b) => 
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            )
          })
          
          // Mark messages as read
          markMessagesAsRead(currentChat.id)
        }
      } catch (error) {
        console.error('Poll error:', error)
      }
    }, 3000) // Poll every 3 seconds
    
    return () => clearInterval(pollInterval)
  }, [user, currentChat])

  // Load all users when new chat dialog opens
  const loadAllUsers = async () => {
    setIsLoadingUsers(true)
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setAllUsers(data.users)
        setFilteredUsers(data.users)
      }
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setIsLoadingUsers(false)
    }
  }

  // Filter users locally as user types
  const filterUsers = (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setFilteredUsers(allUsers)
      return
    }
    const lowerQuery = query.toLowerCase()
    const filtered = allUsers.filter(u => 
      u.username.toLowerCase().includes(lowerQuery) ||
      (u.displayName && u.displayName.toLowerCase().includes(lowerQuery))
    )
    setFilteredUsers(filtered)
  }

  // Auth handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      })
      const data = await res.json()
      if (res.ok) {
        setUser(data.user)
        setLoginForm({ username: '', password: '' })
        toast.success('Welcome back!')
      } else {
        toast.error(data.error || 'Login failed')
      }
    } catch {
      toast.error('Login failed')
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      })
      const data = await res.json()
      if (res.ok) {
        setUser(data.user)
        setRegisterForm({ username: '', password: '', email: '' })
        toast.success('Account created!')
      } else {
        toast.error(data.error || 'Registration failed')
      }
    } catch {
      toast.error('Registration failed')
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      if (socket) {
        socket.disconnect()
        socket = null
      }
      logout()
      toast.success('Logged out')
    } catch {
      toast.error('Logout failed')
    }
  }

  const handleUpdateProfile = async () => {
    if (!user) return
    setIsUpdatingProfile(true)
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (res.ok) {
        setUser(data.user)
        setShowEditProfileDialog(false)
        toast.success('Profile updated!')
      } else {
        toast.error(data.error || 'Failed to update profile')
      }
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const openEditProfile = () => {
    if (user) {
      setEditForm({
        displayName: user.displayName || '',
        bio: user.bio || '',
        avatar: user.avatar || '',
      })
      setShowEditProfileDialog(true)
    }
  }

  // Chat handlers
  const handleSelectChat = (chat: Chat) => {
    setCurrentChat(chat)
    setChatView('conversation')
    loadMessages(chat.id)
  }

  const handleStartNewChat = async (targetUser: User) => {
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUser.id }),
      })
      const data = await res.json()
      addChat(data.chat)
      setCurrentChat(data.chat)
      setChatView('conversation')
      setShowNewChatDialog(false)
      setSearchQuery('')
      setFilteredUsers([])
      loadMessages(data.chat.id)
    } catch {
      toast.error('Failed to start chat')
    }
  }

  const handleSendMessage = () => {
    if (!messageInput.trim() || !currentChat || !user) return
    
    const content = messageInput.trim()
    
    // Optimistically add message
    const tempId = `temp-${Date.now()}`
    const tempMessage: Message = {
      id: tempId,
      chatId: currentChat.id,
      senderId: user.id,
      content: content,
      type: 'text',
      status: 'sent',
      createdAt: new Date(),
      sender: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
      },
    }
    
    // Add optimistic message immediately
    addMessage(tempMessage)
    setMessageInput('')
    
    // Send to API in background (don't await - instant response)
    fetch(`/api/chats/${currentChat.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.message) {
          // Replace temp message with real message from server
          setMessages(prev => prev.map(m => m.id === tempId ? data.message : m))
        }
      })
      .catch(err => {
        console.error('Failed to send message:', err)
      })
  }

  const handleTypingStart = () => {
    if (!isTyping && currentChat && user) {
      setIsTyping(true)
      socket?.emit('typing:start', {
        chatId: currentChat.id,
        userId: user.id,
        username: user.username,
      })
    }
  }

  const handleTypingStop = () => {
    if (isTyping && currentChat && user) {
      setIsTyping(false)
      socket?.emit('typing:stop', {
        chatId: currentChat.id,
        userId: user.id,
      })
    }
  }

  // Call handlers
  const startCall = async (type: 'voice' | 'video', targetUser: User) => {
    // Check if socket is connected (required for calls)
    if (!isSocketConnected) {
      toast.error('Calls require real-time connection. Please refresh the page or try again later.')
      return
    }
    
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: true,
      })
      setLocalStream(stream)
      
      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })
      
      setPeerConnection(pc)
      
      // Add tracks
      stream.getTracks().forEach(track => pc.addTrack(track, stream))
      
      // ICE candidate handler
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket?.emit('call:ice-candidate', {
            userId: user!.id,
            candidate: event.candidate.toJSON(),
            targetUserId: targetUser.id,
          })
        }
      }
      
      // Remote stream handler
      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0])
      }
      
      // Create offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      
      setCallPartner(targetUser)
      setCallType(type)
      setIsCaller(true)
      setInCall(true)
      setCallStatus('calling')
      
      // Send offer
      socket?.emit('call:offer', {
        callerId: user!.id,
        callerName: user!.username,
        receiverId: targetUser.id,
        offer,
        type,
      })
      
    } catch (error) {
      console.error('Failed to start call:', error)
      toast.error('Failed to access camera/microphone. Please check permissions.')
    }
  }

  const endCall = () => {
    if (user && callPartner) {
      socket?.emit('call:hangup', { userId: user.id })
    }
    resetCall()
  }

  const declineCall = () => {
    if (user && callPartner) {
      socket?.emit('call:decline', {
        callerId: callPartner.id,
        receiverId: user.id,
      })
    }
    resetCall()
  }

  // Room handlers
  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return
    
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoomName,
          videoUrl: newRoomVideoUrl || null,
          isPublic: true,
        }),
      })
      const data = await res.json()
      addRoom(data.room)
      setCurrentRoom(data.room)
      setShowNewRoomDialog(false)
      setNewRoomName('')
      setNewRoomVideoUrl('')
      
      // Join room via socket
      socket?.emit('room:join', {
        roomId: data.room.id,
        userId: user!.id,
        username: user!.username,
        avatar: user!.avatar,
      })
      
      toast.success('Room created!')
    } catch {
      toast.error('Failed to create room')
    }
  }

  const handleJoinRoom = async (room: MovieRoom) => {
    try {
      await fetch(`/api/rooms/${room.id}/join`, { method: 'POST' })
      setCurrentRoom(room)
      
      // Join room via socket
      socket?.emit('room:join', {
        roomId: room.id,
        userId: user!.id,
        username: user!.username,
        avatar: user!.avatar,
      })
      
      toast.success('Joined room!')
    } catch {
      toast.error('Failed to join room')
    }
  }

  const handleLeaveRoom = () => {
    if (currentRoom && user) {
      socket?.emit('room:leave', {
        roomId: currentRoom.id,
        userId: user.id,
        username: user.username,
      })
      clearRoom()
    }
  }

  const handleRoomSync = (action: 'play' | 'pause' | 'seek', progress: number) => {
    if (currentRoom && user) {
      socket?.emit('room:sync', {
        roomId: currentRoom.id,
        userId: user.id,
        action,
        progress,
      })
    }
  }

  const handleSendRoomMessage = () => {
    if (!roomMessageInput.trim() || !currentRoom || !user) return
    
    socket?.emit('room:chat', {
      roomId: currentRoom.id,
      userId: user.id,
      username: user.username,
      avatar: user.avatar,
      content: roomMessageInput,
    })
    
    setRoomMessageInput('')
  }

  // Render auth forms if not authenticated
  if (!isAuthenticated && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                <MessageCircle className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold">Aaronyx</h1>
            </div>
            <CardDescription>
              Real-Time Communication Platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      placeholder="Username"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="password"
                      placeholder="Password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">Login</Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register" className="space-y-4">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      placeholder="Username"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                      required
                      minLength={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="email"
                      placeholder="Email (optional)"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="password"
                      placeholder="Password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full">Create Account</Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Main app layout
  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar */}
      <div className="w-16 md:w-64 border-r flex flex-col bg-card">
        {/* Logo */}
        <div className="p-4 border-b flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <MessageCircle className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg hidden md:block">Aaronyx</span>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          <Button
            variant={view === 'chats' ? 'secondary' : 'ghost'}
            className="w-full justify-start gap-3"
            onClick={() => { setView('chats'); setChatView('list') }}
          >
            <MessageCircle className="h-5 w-5" />
            <span className="hidden md:inline">Chats</span>
          </Button>
          <Button
            variant={view === 'calls' ? 'secondary' : 'ghost'}
            className="w-full justify-start gap-3"
            onClick={() => setView('calls')}
          >
            <Video className="h-5 w-5" />
            <span className="hidden md:inline">Calls</span>
          </Button>
          <Button
            variant={view === 'rooms' ? 'secondary' : 'ghost'}
            className="w-full justify-start gap-3"
            onClick={() => setView('rooms')}
          >
            <Film className="h-5 w-5" />
            <span className="hidden md:inline">Watch Rooms</span>
          </Button>
          <Button
            variant={view === 'profile' ? 'secondary' : 'ghost'}
            className="w-full justify-start gap-3"
            onClick={() => setView('profile')}
          >
            <UserIcon className="h-5 w-5" />
            <span className="hidden md:inline">Profile</span>
          </Button>
        </nav>
        
        {/* User section */}
        <div className="p-3 border-t">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user?.avatar || ''} />
              <AvatarFallback>{user?.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 hidden md:block">
              <p className="text-sm font-medium truncate">{user?.displayName || user?.username}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${user?.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                {user?.isOnline ? 'Online' : 'Offline'}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hidden md:flex">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                  {theme === 'dark' ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                  {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* CHATS VIEW */}
        {view === 'chats' && (
          <>
            {/* Chat List */}
            <div className={`border-r flex flex-col ${chatView === 'conversation' ? 'hidden md:flex w-80' : 'w-full md:w-80'}`}>
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-semibold text-lg">Messages</h2>
                <Dialog open={showNewChatDialog} onOpenChange={(open) => {
                  setShowNewChatDialog(open)
                  if (open) {
                    loadAllUsers()
                    setSearchQuery('')
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button size="icon" variant="ghost">
                      <Plus className="h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>New Chat</DialogTitle>
                      <DialogDescription>Select a user to start a conversation</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search users..."
                          value={searchQuery}
                          onChange={(e) => filterUsers(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <ScrollArea className="h-64">
                        {isLoadingUsers ? (
                          <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                          </div>
                        ) : filteredUsers.length > 0 ? (
                          <div className="space-y-2">
                            {filteredUsers.map((u) => (
                              <Button
                                key={u.id}
                                variant="ghost"
                                className="w-full justify-start gap-3"
                                onClick={() => handleStartNewChat(u)}
                              >
                                <Avatar className="h-9 w-9">
                                  <AvatarImage src={u.avatar || ''} />
                                  <AvatarFallback>{u.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 text-left">
                                  <div className="flex items-center justify-between">
                                    <p className="font-medium">{u.displayName || u.username}</p>
                                    <span className={`h-2 w-2 rounded-full ${u.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">@{u.username}</p>
                                </div>
                              </Button>
                            ))}
                          </div>
                        ) : searchQuery ? (
                          <p className="text-center text-muted-foreground py-8">No users found</p>
                        ) : (
                          <p className="text-center text-muted-foreground py-8">No users available</p>
                        )}
                      </ScrollArea>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <ScrollArea className="flex-1">
                {chats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                    <MessageCircle className="h-12 w-12 mb-2" />
                    <p>No chats yet</p>
                    <p className="text-sm">Start a new conversation</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {chats.map((chat) => (
                      <button
                        key={chat.id}
                        className={`w-full p-4 flex items-center gap-3 hover:bg-accent transition-colors ${currentChat?.id === chat.id ? 'bg-accent' : ''}`}
                        onClick={() => handleSelectChat(chat)}
                      >
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={chat.avatar || ''} />
                          <AvatarFallback>{chat.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center justify-between">
                            <p className="font-medium truncate">{chat.name}</p>
                            {chat.lastMessage && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(chat.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {chat.lastMessage?.senderId === user?.id && chat.lastMessage && (
                              <span>
                                {chat.lastMessage.status === 'read' ? (
                                  <CheckCheck className="h-3 w-3 text-blue-400" />
                                ) : chat.lastMessage.status === 'delivered' ? (
                                  <CheckCheck className="h-3 w-3 text-muted-foreground" />
                                ) : (
                                  <Check className="h-3 w-3 text-muted-foreground" />
                                )}
                              </span>
                            )}
                            <p className="text-sm text-muted-foreground truncate">
                              {chat.lastMessage?.content || 'No messages'}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Chat Conversation */}
            {chatView === 'conversation' && currentChat ? (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Chat Header */}
                <div className="p-4 border-b flex items-center gap-3 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={() => { setChatView('list'); setCurrentChat(null) }}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={currentChat.avatar || ''} />
                    <AvatarFallback>{currentChat.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{currentChat.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {typingUsers[currentChat.id]?.length ? (
                        <span className="text-primary">typing...</span>
                      ) : (
                        currentChat.members.find(m => m.id !== user?.id)?.isOnline ? 'Online' : 'Offline'
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const otherUser = currentChat.members.find(m => m.id !== user?.id)
                              if (otherUser) startJitsiCall('voice', otherUser)
                            }}
                          >
                            <Phone className="h-5 w-5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Voice Call (Jitsi)</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const otherUser = currentChat.members.find(m => m.id !== user?.id)
                              if (otherUser) startJitsiCall('video', otherUser)
                            }}
                          >
                            <Video className="h-5 w-5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Video Call (Jitsi)</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ScrollArea className="h-full p-4" ref={chatContainerRef}>
                  <div className="space-y-4">
                    {messages.map((msg) => {
                      const isOwn = msg.senderId === user?.id
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                              isOwn
                                ? 'bg-primary text-primary-foreground rounded-br-md'
                                : 'bg-muted rounded-bl-md'
                            }`}
                          >
                            {!isOwn && currentChat.type === 'group' && (
                              <p className="text-xs font-medium mb-1">{msg.sender?.displayName || msg.sender?.username}</p>
                            )}
                            <p className="break-words">{msg.content}</p>
                            <div className={`flex items-center justify-end gap-1 mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              <span className="text-xs">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {isOwn && (
                                <span>
                                  {msg.status === 'read' ? (
                                    <CheckCheck className="h-3 w-3 text-blue-400" />
                                  ) : msg.status === 'delivered' ? (
                                    <CheckCheck className="h-3 w-3 opacity-70" />
                                  ) : (
                                    <Check className="h-3 w-3 opacity-70" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
                </div>

                {/* Message Input */}
                <div className="p-4 border-t shrink-0">
                  {/* Hidden file input */}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                  />
                  
                  {/* Emoji Picker Popover */}
                  <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                    <PopoverContent className="w-80 p-0" align="bottom-start">
                      <EmojiPicker 
                        onEmojiClick={(emojiData) => {
                          setMessageInput(prev => prev + emojiData.emoji)
                        }}
                        width="100%"
                        height={350}
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <div className="flex items-center gap-2">
                    {/* File Upload Button */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                          >
                            {isUploading ? (
                              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            ) : (
                              <Paperclip className="h-5 w-5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Attach file</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <Input
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => {
                        setMessageInput(e.target.value)
                        handleTypingStart()
                      }}
                      onBlur={handleTypingStop}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleTypingStop()
                          handleSendMessage()
                        }
                      }}
                      className="flex-1"
                    />
                    
                    {/* Emoji Button */}
                    <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Smile className="h-5 w-5" />
                        </Button>
                      </PopoverTrigger>
                    </Popover>
                    
                    {/* Send Button */}
                    <Button size="icon" onClick={handleSendMessage} disabled={!messageInput.trim() && !isUploading}>
                      <Send className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 hidden md:flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Select a chat</p>
                  <p className="text-sm">Choose a conversation to start messaging</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* CALLS VIEW */}
        {view === 'calls' && (
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-lg">Calls</h2>
            </div>
            
            {jitsiRoom ? (
              // Jitsi Call UI
              <div className="flex-1 relative bg-black">
                <iframe
                  src={`https://meet.jit.si/${jitsiRoom}#config.startWithVideoMuted=${callType === 'voice'}&config.startWithAudioMuted=false&config.prejoinPageEnabled=false&config.disableDeepLinking=true`}
                  className="w-full h-full border-0"
                  allow="camera; microphone; fullscreen; display-capture; autoplay"
                  title="Jitsi Meet"
                />
                <Button
                  variant="destructive"
                  size="lg"
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full"
                  onClick={endJitsiCall}
                >
                  <PhoneOff className="h-5 w-5 mr-2" />
                  End Call
                </Button>
              </div>
            ) : isInCall ? (
              // Active Call UI (Legacy)
              <div className="flex-1 flex flex-col bg-black">
                {/* Video Grid */}
                <div className="flex-1 relative">
                  {/* Remote Video */}
                  {callType === 'video' && (
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                  
                  {/* Local Video (PiP) */}
                  {callType === 'video' && localStream && (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute bottom-4 right-4 w-48 h-36 rounded-lg object-cover border-2 border-white/20"
                    />
                  )}
                  
                  {/* Voice Call UI */}
                  {callType === 'voice' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <Avatar className="h-32 w-32 mb-4">
                        <AvatarImage src={callPartner?.avatar || ''} />
                        <AvatarFallback className="text-4xl">
                          {callPartner?.username?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-white text-2xl font-medium">{callPartner?.username}</p>
                      <p className="text-white/70">
                        {callStatus === 'calling' ? 'Calling...' : callStatus === 'ringing' ? 'Ringing...' : 'Connected'}
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Call Controls */}
                <div className="p-6 bg-black/80 flex items-center justify-center gap-4">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="rounded-full h-14 w-14"
                    onClick={toggleMute}
                  >
                    {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                  </Button>
                  {callType === 'video' && (
                    <Button
                      variant="secondary"
                      size="lg"
                      className="rounded-full h-14 w-14"
                      onClick={toggleVideo}
                    >
                      {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="lg"
                    className="rounded-full h-14 w-14"
                    onClick={endCall}
                  >
                    <PhoneOff className="h-6 w-6" />
                  </Button>
                </div>
              </div>
            ) : (
              // Call History List
              <ScrollArea className="flex-1">
                {callHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                    <Phone className="h-12 w-12 mb-2" />
                    <p>No call history</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {callHistory.map((call) => {
                      const isOutgoing = call.callerId === user?.id
                      const otherUser = isOutgoing ? call.receiver : call.caller
                      return (
                        <div key={call.id} className="p-4 flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={otherUser?.avatar || ''} />
                            <AvatarFallback>{otherUser?.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium">{otherUser?.displayName || otherUser?.username}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {isOutgoing ? (
                                <Phone className="h-3 w-3" />
                              ) : (
                                <Phone className="h-3 w-3 rotate-[135deg]" />
                              )}
                              <span>
                                {call.type === 'voice' ? 'Voice' : 'Video'} • {call.status}
                              </span>
                              {call.duration && <span>• {Math.floor(call.duration / 60)}:{(call.duration % 60).toString().padStart(2, '0')}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => startCall('voice', otherUser!)}
                                  >
                                    <Phone className="h-5 w-5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Voice Call</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => startCall('video', otherUser!)}
                                  >
                                    <Video className="h-5 w-5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Video Call</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            )}
          </div>
        )}

        {/* ROOMS VIEW */}
        {view === 'rooms' && (
          <>
            {/* Room List */}
            <div className={`border-r flex flex-col ${currentRoom ? 'hidden md:flex w-80' : 'w-full md:w-80'}`}>
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-semibold text-lg">Watch Rooms</h2>
                <Dialog open={showNewRoomDialog} onOpenChange={setShowNewRoomDialog}>
                  <DialogTrigger asChild>
                    <Button size="icon" variant="ghost">
                      <Plus className="h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Watch Room</DialogTitle>
                      <DialogDescription>Create a room to watch videos together</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Room Name</label>
                        <Input
                          placeholder="Movie night with friends"
                          value={newRoomName}
                          onChange={(e) => setNewRoomName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">YouTube URL (optional)</label>
                        <Input
                          placeholder="https://youtube.com/watch?v=..."
                          value={newRoomVideoUrl}
                          onChange={(e) => setNewRoomVideoUrl(e.target.value)}
                        />
                      </div>
                      <Button className="w-full" onClick={handleCreateRoom}>
                        Create Room
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <ScrollArea className="flex-1">
                {rooms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                    <Film className="h-12 w-12 mb-2" />
                    <p>No active rooms</p>
                    <p className="text-sm">Create a room to watch together</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {rooms.map((room) => (
                      <button
                        key={room.id}
                        className={`w-full p-4 flex items-start gap-3 hover:bg-accent transition-colors text-left ${currentRoom?.id === room.id ? 'bg-accent' : ''}`}
                        onClick={() => handleJoinRoom(room)}
                      >
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Film className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{room.name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span>{room.participants.length} watching</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Hosted by {room.createdBy.displayName || room.createdBy.username}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Room View */}
            {currentRoom ? (
              <div className="flex-1 flex flex-col">
                {/* Room Header */}
                <div className="p-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden"
                      onClick={handleLeaveRoom}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                    <div>
                      <h3 className="font-semibold">{currentRoom.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {participants.length} participants
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Users className="h-4 w-4 mr-2" />
                          Participants
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Participants</DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="h-64">
                          <div className="space-y-2">
                            {participants.map((p) => (
                              <div key={p.id} className="flex items-center gap-3 p-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={p.user.avatar || ''} />
                                  <AvatarFallback>{p.user.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <p className="font-medium">{p.user.displayName || p.user.username}</p>
                                </div>
                                <Badge variant={p.role === 'host' ? 'default' : 'secondary'}>
                                  {p.role}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                    <Button variant="destructive" size="sm" onClick={handleLeaveRoom}>
                      Leave
                    </Button>
                  </div>
                </div>

                {/* Video Player */}
                <div className="flex-1 flex">
                  <div className="flex-1 bg-black flex items-center justify-center">
                    {currentRoom.videoUrl ? (
                      <div className="w-full h-full relative">
                        <ReactPlayer
                          url={currentRoom.videoUrl}
                          width="100%"
                          height="100%"
                          playing={isPlaying}
                          onPlay={() => handleRoomSync('play', currentProgress)}
                          onPause={() => handleRoomSync('pause', currentProgress)}
                          onProgress={({ playedSeconds }) => {
                            // Only sync for host
                          }}
                        />
                      </div>
                    ) : (
                      <div className="text-white/70 text-center p-4">
                        <Film className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p>No video set for this room</p>
                      </div>
                    )}
                  </div>

                  {/* Room Chat */}
                  <div className="w-80 border-l flex flex-col hidden md:flex">
                    <div className="p-4 border-b">
                      <h4 className="font-medium">Room Chat</h4>
                    </div>
                    <ScrollArea className="flex-1 p-4" ref={roomChatRef}>
                      <div className="space-y-3">
                        {roomMessages.map((msg) => (
                          <div key={msg.id} className="flex items-start gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={msg.avatar || ''} />
                              <AvatarFallback className="text-xs">
                                {msg.username?.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{msg.username}</span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-sm break-words">{msg.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <div className="p-4 border-t">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Send a message..."
                          value={roomMessageInput}
                          onChange={(e) => setRoomMessageInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSendRoomMessage()
                          }}
                          className="flex-1"
                        />
                        <Button size="icon" onClick={handleSendRoomMessage}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 hidden md:flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Film className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Select a room</p>
                  <p className="text-sm">Join a room to watch videos together</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* PROFILE VIEW */}
        {view === 'profile' && (
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-lg">Profile</h2>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <Card className="w-full max-w-md mx-4">
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center">
                    <Avatar className="h-24 w-24 mb-4">
                      <AvatarImage src={user?.avatar || ''} />
                      <AvatarFallback className="text-3xl">
                        {user?.username?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="text-xl font-semibold">{user?.displayName || user?.username}</h3>
                    <p className="text-muted-foreground">@{user?.username}</p>
                    {user?.bio && <p className="mt-2 text-sm">{user.bio}</p>}
                  </div>
                  
                  <Separator className="my-6" />
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={user?.isOnline ? 'default' : 'secondary'} className={user?.isOnline ? 'bg-green-500 hover:bg-green-600' : ''}>
                        {user?.isOnline ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Member since</span>
                      <span className="text-sm">
                        {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Just now'}
                      </span>
                    </div>
                  </div>
                  
                  <Separator className="my-6" />
                  
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start gap-2" onClick={openEditProfile}>
                      <Settings className="h-4 w-4" />
                      Edit Profile
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    >
                      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </Button>
                    <Button
                      variant="destructive"
                      className="w-full justify-start gap-2"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={showEditProfileDialog} onOpenChange={setShowEditProfileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Display Name</label>
              <Input
                placeholder="Your display name"
                value={editForm.displayName}
                onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Bio</label>
              <Input
                placeholder="Tell us about yourself"
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Avatar URL</label>
              <Input
                placeholder="https://example.com/avatar.png"
                value={editForm.avatar}
                onChange={(e) => setEditForm({ ...editForm, avatar: e.target.value })}
              />
            </div>
            <Button className="w-full" onClick={handleUpdateProfile} disabled={isUpdatingProfile}>
              {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Incoming Call Dialog */}
      <Dialog open={callStatus === 'ringing' && !isCaller} onOpenChange={(open) => !open && declineCall()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Incoming {callType} call</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-6">
            <Avatar className="h-20 w-20 mb-4">
              <AvatarImage src={callPartner?.avatar || ''} />
              <AvatarFallback className="text-2xl">
                {callPartner?.username?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <p className="text-lg font-medium">{callPartner?.username}</p>
            <p className="text-muted-foreground">is calling you...</p>
          </div>
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="destructive"
              size="lg"
              className="rounded-full h-14 w-14"
              onClick={() => {
                if (callPartner) {
                  declineCall()
                }
              }}
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
            <Button
              variant="default"
              size="lg"
              className="rounded-full h-14 w-14 bg-green-500 hover:bg-green-600"
              onClick={async () => {
                try {
                  const stream = await navigator.mediaDevices.getUserMedia({
                    video: callType === 'video',
                    audio: true,
                  })
                  setLocalStream(stream)
                  
                  const pc = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
                  })
                  setPeerConnection(pc)
                  
                  stream.getTracks().forEach(track => pc.addTrack(track, stream))
                  
                  pc.onicecandidate = (event) => {
                    if (event.candidate && callPartner) {
                      socket?.emit('call:ice-candidate', {
                        userId: user!.id,
                        candidate: event.candidate.toJSON(),
                        targetUserId: callPartner.id,
                      })
                    }
                  }
                  
                  pc.ontrack = (event) => {
                    setRemoteStream(event.streams[0])
                  }
                  
                  setCallStatus('connected')
                  setInCall(true)
                  
                  // Would need to get offer from incoming call data and create answer
                } catch {
                  toast.error('Failed to access camera/microphone')
                }
              }}
            >
              <Phone className="h-6 w-6" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
