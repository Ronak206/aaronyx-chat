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
import { 
  MessageCircle, Video, Film, User as UserIcon, Settings, LogOut, Search, 
  Send, Phone, PhoneOff, Mic, MicOff, VideoOff, Share2, Users, Plus, 
  Moon, Sun, Check, CheckCheck, Play, Pause, SkipForward, Clock,
  Monitor, MonitorOff, X, Smile, Paperclip, MoreVertical, UserPlus,
  Hash, Volume2, VolumeX
} from 'lucide-react'
import { toast } from 'sonner'
import ReactPlayer from 'react-player'

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
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSocketConnected, setIsSocketConnected] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [isTyping, setIsTyping] = useState(false)
  const [showNewChatDialog, setShowNewChatDialog] = useState(false)
  const [showNewRoomDialog, setShowNewRoomDialog] = useState(false)
  const [roomMessageInput, setRoomMessageInput] = useState('')
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomVideoUrl, setNewRoomVideoUrl] = useState('')
  
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

  // Theme effect
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

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
      socket = io('/?XTransformPort=3003', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
      })
      
      socket.on('connect', () => {
        setIsSocketConnected(true)
        socket?.emit('user:connect', { userId: user.id, username: user.username })
      })
      
      socket.on('disconnect', () => setIsSocketConnected(false))
      
      // Message events
      socket.on('message:received', (message: Message) => {
        addMessage(message)
        toast.info(`New message from ${message.sender?.username || 'Unknown'}`)
      })
      
      socket.on('message:read', (data: { messageId: string }) => {
        // Update message read status
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
        // Handle incoming call - would show dialog
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

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
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
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.users)
      }
    } catch (error) {
      console.error('Failed to search users:', error)
    } finally {
      setIsSearching(false)
    }
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
      setSearchResults([])
      loadMessages(data.chat.id)
    } catch {
      toast.error('Failed to start chat')
    }
  }

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !currentChat || !user) return
    
    const receiverIds = currentChat.members.map(m => m.id)
    
    // Optimistically add message
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      chatId: currentChat.id,
      senderId: user.id,
      content: messageInput,
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
    
    addMessage(tempMessage)
    setMessageInput('')
    
    // Send to API
    try {
      const res = await fetch(`/api/chats/${currentChat.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageInput }),
      })
      const data = await res.json()
      
      // Update with real message
      setMessages(messages.map(m => m.id === tempMessage.id ? data.message : m))
      
      // Emit via socket
      socket?.emit('message:send', {
        chatId: currentChat.id,
        senderId: user.id,
        content: messageInput,
        receiverIds,
      })
    } catch {
      toast.error('Failed to send message')
    }
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
      toast.error('Failed to access camera/microphone')
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
                <span className={`h-2 w-2 rounded-full ${isSocketConnected ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                {isSocketConnected ? 'Online' : 'Offline'}
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
                <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
                  <DialogTrigger asChild>
                    <Button size="icon" variant="ghost">
                      <Plus className="h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>New Chat</DialogTitle>
                      <DialogDescription>Search for a user to start a conversation</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search users..."
                          value={searchQuery}
                          onChange={(e) => { setSearchQuery(e.target.value); searchUsers(e.target.value) }}
                          className="pl-9"
                        />
                      </div>
                      <ScrollArea className="h-64">
                        {isSearching ? (
                          <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                          </div>
                        ) : searchResults.length > 0 ? (
                          <div className="space-y-2">
                            {searchResults.map((u) => (
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
                                <div className="text-left">
                                  <p className="font-medium">{u.displayName || u.username}</p>
                                  <p className="text-xs text-muted-foreground">@{u.username}</p>
                                </div>
                              </Button>
                            ))}
                          </div>
                        ) : searchQuery ? (
                          <p className="text-center text-muted-foreground py-8">No users found</p>
                        ) : null}
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
                            {chat.lastMessage?.senderId === user?.id && (
                              <span>
                                {chat.lastMessage.status === 'read' ? (
                                  <CheckCheck className="h-3 w-3 text-primary" />
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
              <div className="flex-1 flex flex-col">
                {/* Chat Header */}
                <div className="p-4 border-b flex items-center gap-3">
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
                            onClick={() => startCall('voice', currentChat.members[0])}
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
                            onClick={() => startCall('video', currentChat.members[0])}
                          >
                            <Video className="h-5 w-5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Video Call</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4" ref={chatContainerRef}>
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
                                    <CheckCheck className="h-3 w-3" />
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

                {/* Message Input */}
                <div className="p-4 border-t">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon">
                      <Paperclip className="h-5 w-5" />
                    </Button>
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
                    <Button variant="ghost" size="icon">
                      <Smile className="h-5 w-5" />
                    </Button>
                    <Button size="icon" onClick={handleSendMessage} disabled={!messageInput.trim()}>
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
              <h2 className="font-semibold text-lg">Call History</h2>
            </div>
            
            {isInCall ? (
              // Active Call UI
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
                      <Badge variant={isSocketConnected ? 'default' : 'secondary'}>
                        {isSocketConnected ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Member since</span>
                      <span className="text-sm">
                        {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                  
                  <Separator className="my-6" />
                  
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start gap-2">
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
