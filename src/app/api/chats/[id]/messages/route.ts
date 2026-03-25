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
          select: {
            receiverId: true,
            status: true,
            readAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    
    // Transform messages to include computed status
    const transformedMessages = messages.map(msg => {
      // For messages sent by current user, check if all receivers have read
      let status = 'sent';
      if (msg.senderId === currentUser.id) {
        const allDelivered = msg.receivers.every(r => r.status === 'delivered' || r.status === 'read');
        const allRead = msg.receivers.every(r => r.status === 'read');
        
        if (allRead && msg.receivers.length > 0) {
          status = 'read';
        } else if (allDelivered) {
          status = 'delivered';
        }
      } else {
        // For received messages, get this user's status
        const receiverStatus = msg.receivers.find(r => r.receiverId === currentUser.id);
        status = receiverStatus?.status || 'delivered';
      }
      
      return {
        id: msg.id,
        chatId: msg.chatId,
        senderId: msg.senderId,
        content: msg.content,
        type: msg.type,
        mediaUrl: msg.mediaUrl,
        status,
        createdAt: msg.createdAt,
        sender: msg.sender,
      };
    });
    
    return NextResponse.json({ messages: transformedMessages });
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
        status: 'sent',
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
        receivers: {
          select: {
            receiverId: true,
            status: true,
          },
        },
      },
    });
    
    // Update chat updatedAt
    await db.chat.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
    
    return NextResponse.json({ 
      message: {
        id: message.id,
        chatId: message.chatId,
        senderId: message.senderId,
        content: message.content,
        type: message.type,
        mediaUrl: message.mediaUrl,
        status: 'sent',
        createdAt: message.createdAt,
        sender: message.sender,
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Mark messages as read
export async function PUT(
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
    
    // Mark all unread messages in this chat as read for current user
    await db.messageReceiver.updateMany({
      where: {
        message: { chatId: id },
        receiverId: currentUser.id,
        status: { not: 'read' },
      },
      data: {
        status: 'read',
        readAt: new Date(),
      },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
