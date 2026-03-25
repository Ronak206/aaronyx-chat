import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

// Check call status (for caller to know if call was accepted/declined)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get('callId');
    
    if (!callId) {
      return NextResponse.json(
        { error: 'Call ID is required' },
        { status: 400 }
      );
    }
    
    // Find the call
    const call = await db.call.findUnique({
      where: { id: callId },
      include: {
        receiver: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });
    
    if (!call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }
    
    // Verify user is the caller
    if (call.callerId !== currentUser.id) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      );
    }
    
    // Generate room name
    const roomName = `aaronyx-${callId}-${call.callerId}-${call.receiverId}`;
    
    return NextResponse.json({
      call: {
        id: call.id,
        status: call.status,
        type: call.type,
        receiver: call.receiver,
        roomName,
      },
    });
  } catch (error) {
    console.error('Check call status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
