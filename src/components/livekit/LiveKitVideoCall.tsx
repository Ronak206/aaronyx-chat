'use client';

import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ControlBar,
  GridLayout,
  ParticipantTile,
  useTracks,
  useRoomContext,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track, RoomEvent, Participant } from 'livekit-client';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, Phone } from 'lucide-react';
import { toast } from 'sonner';

interface LiveKitVideoCallProps {
  token: string;
  serverUrl: string;
  onDisconnect: () => void;
  callType: 'voice' | 'video';
  callerName?: string;
}

// Custom Video Grid Component
function VideoGrid({ callType }: { callType: 'voice' | 'video' }) {
  const tracks = useTracks(
    [
      Track.Source.Camera,
      Track.Source.Microphone,
      Track.Source.ScreenShare,
    ],
    { onlySubscribed: false }
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 relative">
        <GridLayout tracks={tracks} style={{ height: '100%' }}>
          <ParticipantTile />
        </GridLayout>
        
        {/* Voice call overlay */}
        {callType === 'voice' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
            <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-4 animate-pulse">
              <Phone className="w-12 h-12 text-primary" />
            </div>
            <p className="text-white text-lg font-medium">Voice Call</p>
            <p className="text-white/70 text-sm">{tracks.length} participant(s)</p>
          </div>
        )}
      </div>
      
      {/* Audio renderer for remote participants */}
      <RoomAudioRenderer />
    </div>
  );
}

// Custom Control Bar
function CustomControlBar({ onDisconnect, callType }: { onDisconnect: () => void; callType: 'voice' | 'video' }) {
  const room = useRoomContext();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const toggleMute = async () => {
    const localParticipant = room.localParticipant;
    const audioTrack = localParticipant.getTrackPublication(Track.Source.Microphone);
    if (audioTrack?.track) {
      if (isMuted) {
        await audioTrack.track.unmute();
      } else {
        await audioTrack.track.mute();
      }
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = async () => {
    const localParticipant = room.localParticipant;
    const videoTrack = localParticipant.getTrackPublication(Track.Source.Camera);
    if (videoTrack?.track) {
      if (isVideoOff) {
        await videoTrack.track.unmute();
      } else {
        await videoTrack.track.mute();
      }
      setIsVideoOff(!isVideoOff);
    }
  };

  const handleDisconnect = () => {
    room.disconnect();
    onDisconnect();
  };

  return (
    <div className="flex items-center justify-center gap-4 p-4 bg-black/80">
      <Button
        variant="secondary"
        size="lg"
        className="rounded-full h-12 w-12"
        onClick={toggleMute}
      >
        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </Button>
      
      {callType === 'video' && (
        <Button
          variant="secondary"
          size="lg"
          className="rounded-full h-12 w-12"
          onClick={toggleVideo}
        >
          {isVideoOff ? <VideoOff className="h-5 w-5" /> : <VideoIcon className="h-5 w-5" />}
        </Button>
      )}
      
      <Button
        variant="destructive"
        size="lg"
        className="rounded-full h-12 w-12"
        onClick={handleDisconnect}
      >
        <PhoneOff className="h-5 w-5" />
      </Button>
    </div>
  );
}

// Main LiveKit Video Call Component
export default function LiveKitVideoCall({
  token,
  serverUrl,
  onDisconnect,
  callType,
  callerName,
}: LiveKitVideoCallProps) {
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleConnected = () => {
    setIsConnecting(false);
    toast.success('Connected to call!');
  };

  const handleError = (error: Error) => {
    console.error('LiveKit error:', error);
    setError(error.message);
    setIsConnecting(false);
    toast.error('Connection error: ' + error.message);
  };

  const handleDisconnected = () => {
    toast.info('Call ended');
    onDisconnect();
  };

  if (!token) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-black text-white">
        <p className="text-lg">Video service not configured</p>
        <p className="text-sm text-white/70 mb-4">Please set up LiveKit credentials</p>
        <Button variant="destructive" onClick={onDisconnect}>
          <PhoneOff className="h-4 w-4 mr-2" />
          Close
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-black text-white">
        <p className="text-lg text-red-400">Connection Error</p>
        <p className="text-sm text-white/70 mb-4">{error}</p>
        <Button variant="destructive" onClick={onDisconnect}>
          <PhoneOff className="h-4 w-4 mr-2" />
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full bg-black">
      <LiveKitRoom
        video={callType === 'video'}
        audio={true}
        token={token}
        serverUrl={serverUrl}
        onConnected={handleConnected}
        onError={handleError}
        onDisconnected={handleDisconnected}
        className="h-full flex flex-col"
      >
        {isConnecting ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white">
            <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
            <p className="text-lg">{callerName ? `Calling ${callerName}...` : 'Connecting...'}</p>
          </div>
        ) : (
          <VideoGrid callType={callType} />
        )}
        
        <CustomControlBar onDisconnect={onDisconnect} callType={callType} />
      </LiveKitRoom>
    </div>
  );
}
