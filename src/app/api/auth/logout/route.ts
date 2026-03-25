import { NextResponse } from 'next/server';
import { getCurrentUser, clearAuthCookie, logoutUser } from '@/lib/auth';

export async function POST() {
  try {
    const user = await getCurrentUser();
    
    if (user) {
      await logoutUser(user.id);
    }
    
    await clearAuthCookie();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
