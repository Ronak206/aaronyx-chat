import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

// Get chat messages
export async function GET(
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
    
    // Check if user is member of this chat
    const chatMember = await db.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: id,
          userId: currentUser.id,
        },
      },
    });
    
    if (!chatMember) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    const messages = await db.message.findMany({
      where: { chatId: id },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
          },
        },
        receivers: {
          where: { receiverId: currentUser.id },
          select: {
            status: true,
            readAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Send message
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
    
    // Check if user is member of this chat
    const chatMember = await db.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: id,
          userId: currentUser.id,
        },
      },
      include: {
        chat: {
          include: {
            members: true,
          },
        },
      },
    });
    
    if (!chatMember) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { content, type = 'text', mediaUrl } = body;
    
    if (!content && !mediaUrl) {
      return NextResponse.json(
        { error: 'Message content or media URL is required' },
        { status: 400 }
      );
    }
    
    // Create message
    const message = await db.message.create({
      data: {
        chatId: id,
        senderId: currentUser.id,
        content: content || '',
        type,
        mediaUrl,
        receivers: {
          create: chatMember.chat.members
            .filter((m) => m.userId !== currentUser.id)
            .map((m) => ({
              receiverId: m.userId,
              status: 'delivered',
            })),
        },
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });
    
    // Update chat updatedAt
    await db.chat.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
    
    return NextResponse.json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
