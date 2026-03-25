import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

// Get all user's chats
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    const chatMembers = await db.chatMember.findMany({
      where: { userId: currentUser.id },
      include: {
        chat: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true,
                    isOnline: true,
                    lastSeen: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sender: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        chat: {
          updatedAt: 'desc',
        },
      },
    });
    
    const chats = chatMembers.map((cm) => {
      const otherMembers = cm.chat.members.filter(
        (m) => m.user.id !== currentUser.id
      );
      
      return {
        id: cm.chat.id,
        type: cm.chat.type,
        name: cm.chat.name || otherMembers[0]?.user.displayName || otherMembers[0]?.user.username || 'Unknown',
        avatar: otherMembers[0]?.user.avatar,
        lastMessage: cm.chat.messages[0] || null,
        members: otherMembers.map((m) => m.user),
        updatedAt: cm.chat.updatedAt,
      };
    });
    
    return NextResponse.json({ chats });
  } catch (error) {
    console.error('Get chats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Create new chat (1-1)
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
    const { userId } = body;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    // Check if chat already exists
    const existingChat = await db.chat.findFirst({
      where: {
        type: 'direct',
        AND: [
          { members: { some: { userId: currentUser.id } } },
          { members: { some: { userId } } },
        ],
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
                isOnline: true,
              },
            },
          },
        },
      },
    });
    
    if (existingChat) {
      return NextResponse.json({ chat: existingChat });
    }
    
    // Create new chat
    const chat = await db.chat.create({
      data: {
        type: 'direct',
        members: {
          create: [
            { userId: currentUser.id },
            { userId },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
                isOnline: true,
              },
            },
          },
        },
      },
    });
    
    return NextResponse.json({ chat });
  } catch (error) {
    console.error('Create chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
