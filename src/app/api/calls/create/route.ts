import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

// Create a new call invitation
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
    const { receiverId, type, roomName } = body;
    
    if (!receiverId || !type || !roomName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Create call record with pending status
    const call = await db.call.create({
      data: {
        callerId: currentUser.id,
        receiverId,
        type,
        status: 'ringing', // ringing = waiting for response
      },
    });
    
    // Store the roomName in a separate field or cache
    // For now, we'll return it and the frontend will handle it
    
    return NextResponse.json({ 
      success: true, 
      callId: call.id,
      roomName 
    });
  } catch (error) {
    console.error('Create call error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
