import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

// Respond to a call (accept or decline)
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
    const { callId, status } = body;
    
    if (!callId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    if (!['accepted', 'declined'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }
    
    // Find the call
    const call = await db.call.findUnique({
      where: { id: callId },
    });
    
    if (!call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }
    
    // Verify user is the receiver
    if (call.receiverId !== currentUser.id) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      );
    }
    
    // Update call status
    const updatedCall = await db.call.update({
      where: { id: callId },
      data: { status },
    });
    
    return NextResponse.json({ 
      success: true, 
      call: updatedCall 
    });
  } catch (error) {
    console.error('Respond to call error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
