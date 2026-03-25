import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

// Join room
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    const { id } = await params;
    
    const room = await db.movieRoom.findUnique({
      where: { id },
      include: {
        participants: true,
      },
    });
    
    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }
    
    // Check if already joined
    const existingParticipant = await db.roomParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId: id,
          userId: currentUser.id,
        },
      },
    });
    
    if (existingParticipant) {
      return NextResponse.json({ participant: existingParticipant });
    }
    
    // Check if room is full
    if (room.participants.length >= room.maxParticipants) {
      return NextResponse.json(
        { error: 'Room is full' },
        { status: 400 }
      );
    }
    
    const participant = await db.roomParticipant.create({
      data: {
        roomId: id,
        userId: currentUser.id,
        role: 'viewer',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });
    
    return NextResponse.json({ participant });
  } catch (error) {
    console.error('Join room error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
