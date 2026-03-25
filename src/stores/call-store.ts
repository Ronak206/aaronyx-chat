import { create } from 'zustand'

export interface CallUser {
  id: string
  username: string
  displayName?: string | null
  avatar?: string | null
}

export interface CallRecord {
  id: string
  callerId: string
  receiverId: string
  type: 'voice' | 'video'
  status: 'completed' | 'missed' | 'declined'
  duration?: number | null
  createdAt: Date
  caller?: CallUser
  receiver?: CallUser
}

interface CallState {
  // Current call state
  isInCall: boolean
  callType: 'voice' | 'video' | null
  callPartner: CallUser | null
  isCaller: boolean
  callStatus: 'idle' | 'calling' | 'ringing' | 'connected' | 'ended'
  
  // Media state
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  isMuted: boolean
  isVideoOff: boolean
  isScreenSharing: boolean
  
  // Call history
  callHistory: CallRecord[]
  
  // WebRTC
  peerConnection: RTCPeerConnection | null
  
  // Actions
  setInCall: (inCall: boolean) => void
  setCallType: (type: 'voice' | 'video' | null) => void
  setCallPartner: (partner: CallUser | null) => void
  setIsCaller: (isCaller: boolean) => void
  setCallStatus: (status: 'idle' | 'calling' | 'ringing' | 'connected' | 'ended') => void
  setLocalStream: (stream: MediaStream | null) => void
  setRemoteStream: (stream: MediaStream | null) => void
  toggleMute: () => void
  toggleVideo: () => void
  toggleScreenShare: () => void
  setCallHistory: (history: CallRecord[]) => void
  setPeerConnection: (pc: RTCPeerConnection | null) => void
  resetCall: () => void
}

export const useCallStore = create<CallState>((set, get) => ({
  isInCall: false,
  callType: null,
  callPartner: null,
  isCaller: false,
  callStatus: 'idle',
  localStream: null,
  remoteStream: null,
  isMuted: false,
  isVideoOff: false,
  isScreenSharing: false,
  callHistory: [],
  peerConnection: null,
  
  setInCall: (inCall) => set({ isInCall: inCall }),
  setCallType: (type) => set({ callType: type }),
  setCallPartner: (partner) => set({ callPartner: partner }),
  setIsCaller: (isCaller) => set({ isCaller }),
  setCallStatus: (status) => set({ callStatus: status }),
  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),
  
  toggleMute: () => {
    const { localStream, isMuted } = get()
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted
      })
    }
    set({ isMuted: !isMuted })
  },
  
  toggleVideo: () => {
    const { localStream, isVideoOff } = get()
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff
      })
    }
    set({ isVideoOff: !isVideoOff })
  },
  
  toggleScreenShare: () => set((state) => ({ isScreenSharing: !state.isScreenSharing })),
  
  setCallHistory: (history) => set({ callHistory: history }),
  setPeerConnection: (pc) => set({ peerConnection: pc }),
  
  resetCall: () => {
    const { localStream, remoteStream, peerConnection } = get()
    
    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop())
    }
    
    // Close peer connection
    if (peerConnection) {
      peerConnection.close()
    }
    
    set({
      isInCall: false,
      callType: null,
      callPartner: null,
      isCaller: false,
      callStatus: 'idle',
      localStream: null,
      remoteStream: null,
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
      peerConnection: null,
    })
  },
}))
