'use client'

import { useEffect, useCallback } from 'react'
import { useSocketStore } from '@/stores/socket-store'
import { useAuthStore } from '@/stores/auth-store'
import { useChatStore } from '@/stores/chat-store'
import { useCallStore } from '@/stores/call-store'
import { useRoomStore } from '@/stores/room-store'

export function useSocket() {
  const { socket, isConnected, connect, disconnect } = useSocketStore()
  const { user } = useAuthStore()
  const { addMessage, setTyping, updateMessageStatus } = useChatStore()
  const { 
    setCallStatus, 
    setCallPartner, 
    setCallType, 
    setIsCaller,
    peerConnection,
    setPeerConnection,
    setRemoteStream
  } = useCallStore()
  const { 
    addParticipant, 
    removeParticipant, 
    addMessage: addRoomMessage,
    setPlaybackState 
  } = useRoomStore()

  // Connect socket on mount
  useEffect(() => {
    if (user && !isConnected) {
      connect()
    }
    
    return () => {
      // Don't disconnect on unmount to maintain connection
    }
  }, [user, isConnected, connect])

  // Register user on socket connect
  useEffect(() => {
    if (socket && isConnected && user) {
      socket.emit('user:connect', {
        userId: user.id,
        username: user.username,
      })
    }
  }, [socket, isConnected, user])

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return

    // Message events
    socket.on('message:received', (message) => {
      addMessage(message)
    })

    socket.on('message:sent', (message) => {
      // Message confirmation
    })

    socket.on('message:read', (data) => {
      updateMessageStatus(data.messageId, 'read')
    })

    // Typing events
    socket.on('typing:started', (data) => {
      setTyping(data.chatId, data.userId, true)
    })

    socket.on('typing:stopped', (data) => {
      setTyping(data.chatId, data.userId, false)
    })

    // Call events
    socket.on('call:incoming', async (data) => {
      setCallPartner({
        id: data.callerId,
        username: data.callerName,
      })
      setCallType(data.type)
      setIsCaller(false)
      setCallStatus('ringing')
    })

    socket.on('call:answered', async (data) => {
      if (peerConnection) {
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
        } catch (error) {
          console.error('Error setting remote description:', error)
        }
      }
      setCallStatus('connected')
    })

    socket.on('call:ice-candidate', async (data) => {
      if (peerConnection) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
        } catch (error) {
          console.error('Error adding ICE candidate:', error)
        }
      }
    })

    socket.on('call:ended', () => {
      setCallStatus('ended')
    })

    socket.on('call:declined', () => {
      setCallStatus('ended')
    })

    // Room events
    socket.on('room:user-joined', (data) => {
      addParticipant({
        id: data.userId,
        userId: data.userId,
        role: 'viewer',
        user: {
          id: data.userId,
          username: data.username,
          avatar: data.avatar,
        },
      })
    })

    socket.on('room:user-left', (data) => {
      removeParticipant(data.userId)
    })

    socket.on('room:sync', (data) => {
      setPlaybackState(data.action === 'play', data.progress)
    })

    socket.on('room:message', (message) => {
      addRoomMessage(message)
    })

    socket.on('room:state', (state) => {
      setPlaybackState(state.isPlaying, state.currentProgress)
    })

    return () => {
      socket.off('message:received')
      socket.off('message:sent')
      socket.off('message:read')
      socket.off('typing:started')
      socket.off('typing:stopped')
      socket.off('call:incoming')
      socket.off('call:answered')
      socket.off('call:ice-candidate')
      socket.off('call:ended')
      socket.off('call:declined')
      socket.off('room:user-joined')
      socket.off('room:user-left')
      socket.off('room:sync')
      socket.off('room:message')
      socket.off('room:state')
    }
  }, [socket, addMessage, setTyping, updateMessageStatus, setCallStatus, setCallPartner, setCallType, setIsCaller, peerConnection, addParticipant, removeParticipant, addRoomMessage, setPlaybackState])

  // Helper functions for emitting events
  const sendMessage = useCallback((data: {
    chatId: string
    senderId: string
    content: string
    type?: string
    mediaUrl?: string
    receiverIds: string[]
  }) => {
    if (socket && isConnected) {
      socket.emit('message:send', data)
    }
  }, [socket, isConnected])

  const sendTyping = useCallback((chatId: string, userId: string, username: string, isTyping: boolean) => {
    if (socket && isConnected) {
      socket.emit(isTyping ? 'typing:start' : 'typing:stop', { chatId, userId, username })
    }
  }, [socket, isConnected])

  const startCall = useCallback((data: {
    callerId: string
    callerName: string
    receiverId: string
    offer: RTCSessionDescriptionInit
    type: 'voice' | 'video'
  }) => {
    if (socket && isConnected) {
      socket.emit('call:offer', data)
    }
  }, [socket, isConnected])

  const answerCall = useCallback((data: {
    callerId: string
    receiverId: string
    answer: RTCSessionDescriptionInit
  }) => {
    if (socket && isConnected) {
      socket.emit('call:answer', data)
    }
  }, [socket, isConnected])

  const sendIceCandidate = useCallback((data: {
    userId: string
    candidate: RTCIceCandidateInit
    targetUserId: string
  }) => {
    if (socket && isConnected) {
      socket.emit('call:ice-candidate', data)
    }
  }, [socket, isConnected])

  const endCall = useCallback((userId: string) => {
    if (socket && isConnected) {
      socket.emit('call:hangup', { userId })
    }
  }, [socket, isConnected])

  const declineCall = useCallback((callerId: string, receiverId: string) => {
    if (socket && isConnected) {
      socket.emit('call:decline', { callerId, receiverId })
    }
  }, [socket, isConnected])

  const joinRoom = useCallback((roomId: string, userId: string, username: string, avatar?: string) => {
    if (socket && isConnected) {
      socket.emit('room:join', { roomId, userId, username, avatar })
    }
  }, [socket, isConnected])

  const leaveRoom = useCallback((roomId: string, userId: string, username: string) => {
    if (socket && isConnected) {
      socket.emit('room:leave', { roomId, userId, username })
    }
  }, [socket, isConnected])

  const syncRoom = useCallback((data: {
    roomId: string
    userId: string
    action: 'play' | 'pause' | 'seek'
    progress: number
  }) => {
    if (socket && isConnected) {
      socket.emit('room:sync', data)
    }
  }, [socket, isConnected])

  const sendRoomMessage = useCallback((data: {
    roomId: string
    userId: string
    username: string
    avatar?: string
    content: string
  }) => {
    if (socket && isConnected) {
      socket.emit('room:chat', data)
    }
  }, [socket, isConnected])

  return {
    socket,
    isConnected,
    connect,
    disconnect,
    sendMessage,
    sendTyping,
    startCall,
    answerCall,
    sendIceCandidate,
    endCall,
    declineCall,
    joinRoom,
    leaveRoom,
    syncRoom,
    sendRoomMessage,
  }
}
