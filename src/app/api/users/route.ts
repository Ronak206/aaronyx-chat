import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/users - Get all users or search by username
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
    const query = searchParams.get('q')?.trim().toLowerCase();
    
    // If query provided, filter by username
    // Otherwise return all users except current user
    const users = await db.user.findMany({
      where: {
        id: {
          not: currentUser.id,
        },
        ...(query ? {
          OR: [
            { username: { contains: query } },
            { displayName: { contains: query } },
          ]
        } : {}),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatar: true,
        isOnline: true,
        lastSeen: true,
      },
      take: 50,
      orderBy: {
        isOnline: 'desc', // Online users first
      },
    });
    
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
