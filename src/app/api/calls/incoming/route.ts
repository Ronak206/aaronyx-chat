import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

// Get incoming calls (calls where current user is receiver and status is ringing)
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    // Find pending calls where user is receiver
    const incomingCall = await db.call.findFirst({
      where: {
        receiverId: currentUser.id,
        status: 'ringing',
      },
      include: {
        caller: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    if (!incomingCall) {
      return NextResponse.json({ call: null });
    }
    
    // Generate room name from call data
    const roomName = `aaronyx-${incomingCall.id}-${incomingCall.callerId}-${incomingCall.receiverId}`;
    
    return NextResponse.json({
      call: {
        callId: incomingCall.id,
        callerId: incomingCall.callerId,
        callerName: incomingCall.caller.displayName || incomingCall.caller.username,
        callerAvatar: incomingCall.caller.avatar,
        roomName,
        type: incomingCall.type,
      },
    });
  } catch (error) {
    console.error('Get incoming calls error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
