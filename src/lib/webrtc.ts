const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
]

export interface WebRTCHandlers {
  onIceCandidate: (candidate: RTCIceCandidateInit, targetUserId: string) => void
  onRemoteStream: (stream: MediaStream) => void
  onConnectionStateChange: (state: RTCPeerConnectionState) => void
}

export async function getUserMedia(video: boolean = true, audio: boolean = true): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: video ? { width: 1280, height: 720, facingMode: 'user' } : false,
      audio: audio ? { echoCancellation: true, noiseSuppression: true } : false,
    })
    return stream
  } catch (error) {
    console.error('Error getting user media:', error)
    throw error
  }
}

export async function getDisplayMedia(): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'always' },
      audio: true,
    })
    return stream
  } catch (error) {
    console.error('Error getting display media:', error)
    throw error
  }
}

export function createPeerConnection(handlers: WebRTCHandlers): RTCPeerConnection {
  const pc = new RTCPeerConnection({
    iceServers: ICE_SERVERS,
  })

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      handlers.onIceCandidate(event.candidate.toJSON(), '') // targetUserId will be set by caller
    }
  }

  pc.ontrack = (event) => {
    const stream = event.streams[0]
    if (stream) {
      handlers.onRemoteStream(stream)
    }
  }

  pc.onconnectionstatechange = () => {
    handlers.onConnectionStateChange(pc.connectionState)
  }

  return pc
}

export async function createOffer(
  pc: RTCPeerConnection,
  localStream: MediaStream
): Promise<RTCSessionDescriptionInit> {
  // Add local tracks
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream)
  })

  const offer = await pc.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
  })
  
  await pc.setLocalDescription(offer)
  
  return offer
}

export async function createAnswer(
  pc: RTCPeerConnection,
  localStream: MediaStream,
  offer: RTCSessionDescriptionInit
): Promise<RTCSessionDescriptionInit> {
  // Add local tracks
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream)
  })

  await pc.setRemoteDescription(new RTCSessionDescription(offer))
  
  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)
  
  return answer
}

export async function addIceCandidate(
  pc: RTCPeerConnection,
  candidate: RTCIceCandidateInit
): Promise<void> {
  await pc.addIceCandidate(new RTCIceCandidate(candidate))
}

export function stopMediaStream(stream: MediaStream | null): void {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop())
  }
}

export function closePeerConnection(pc: RTCPeerConnection | null): void {
  if (pc) {
    pc.getSenders().forEach((sender) => {
      if (sender.track) {
        sender.track.stop()
      }
    })
    pc.close()
  }
}

export function toggleTrackEnabled(stream: MediaStream | null, kind: 'audio' | 'video'): boolean {
  if (!stream) return false
  
  const tracks = stream.getTracks().filter((track) => track.kind === kind)
  const newState = !tracks[0]?.enabled
  
  tracks.forEach((track) => {
    track.enabled = newState
  })
  
  return newState
}

export function replaceTrack(
  pc: RTCPeerConnection | null,
  oldTrack: MediaStreamTrack | null,
  newTrack: MediaStreamTrack | null
): void {
  if (!pc) return
  
  const sender = pc.getSenders().find((s) => s.track === oldTrack)
  if (sender && newTrack) {
    sender.replaceTrack(newTrack)
  }
}
