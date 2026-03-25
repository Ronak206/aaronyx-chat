import { NextRequest, NextResponse } from 'next/server';
import { loginUser, generateToken, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;
    
    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }
    
    // Login user
    const result = await loginUser(username, password);
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }
    
    if (!result.user) {
      return NextResponse.json(
        { error: 'Failed to login' },
        { status: 500 }
      );
    }
    
    // Generate token and set cookie
    const token = generateToken({
      userId: result.user.id,
      username: result.user.username,
    });
    
    await setAuthCookie(token);
    
    return NextResponse.json({
      user: {
        id: result.user.id,
        username: result.user.username,
        email: result.user.email,
        displayName: result.user.displayName,
        avatar: result.user.avatar,
        bio: result.user.bio,
        isOnline: result.user.isOnline,
        lastSeen: result.user.lastSeen,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
