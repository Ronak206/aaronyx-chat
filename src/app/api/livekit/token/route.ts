import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { getCurrentUser } from '@/lib/auth';

// Create LiveKit access token for video calls
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { roomName } = body;
    
    if (!roomName) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400 }
      );
    }
    
    // Get LiveKit credentials from environment
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      // Return mock response for development
      return NextResponse.json({
        token: null,
        url: process.env.NEXT_PUBLIC_LIVEKIT_URL || '',
        roomName,
        error: 'LiveKit not configured',
        development: true,
      });
    }
    
    // Create access token
    const token = new AccessToken(apiKey, apiSecret, {
      identity: currentUser.id,
      name: currentUser.displayName || currentUser.username,
      metadata: JSON.stringify({
        username: currentUser.username,
        avatar: currentUser.avatar,
      }),
    });
    
    // Add video grant
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    
    // Generate JWT token
    const jwt = token.toJwt();
    
    // Get LiveKit URL
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || '';
    
    return NextResponse.json({
      token: jwt,
      url: livekitUrl,
      roomName,
    });
  } catch (error) {
    console.error('LiveKit token error:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
