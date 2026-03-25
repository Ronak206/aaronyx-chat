import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { db } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'aaronyx-secret-key-2024';

export interface JWTPayload {
  userId: string;
  username: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) {
      return null;
    }
    
    const payload = verifyToken(token);
    if (!payload) {
      return null;
    }
    
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatar: true,
        bio: true,
        isOnline: true,
        lastSeen: true,
        createdAt: true,
      },
    });
    
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('token');
}

export async function registerUser(username: string, password: string, email?: string) {
  try {
    // Check if username already exists
    const existingUser = await db.user.findUnique({
      where: { username },
    });
    
    if (existingUser) {
      return { error: 'Username already taken' };
    }
    
    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await db.user.findUnique({
        where: { email },
      });
      
      if (existingEmail) {
        return { error: 'Email already registered' };
      }
    }
    
    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    
    const user = await db.user.create({
      data: {
        username,
        password: hashedPassword,
        email: email || null,
        displayName: username,
      },
    });
    
    return { user };
  } catch (error: unknown) {
    console.error('Registration error in registerUser:', error);
    if (error instanceof Error) {
      return { error: `Database error: ${error.message}` };
    }
    return { error: 'An unexpected error occurred during registration' };
  }
}

export async function loginUser(username: string, password: string) {
  try {
    // Find user by username
    const user = await db.user.findUnique({
      where: { username },
    });
    
    if (!user) {
      return { error: 'Invalid username or password' };
    }
    
    // Verify password
    const isValid = await verifyPassword(password, user.password);
    
    if (!isValid) {
      return { error: 'Invalid username or password' };
    }
    
    // Update online status
    await db.user.update({
      where: { id: user.id },
      data: { isOnline: true },
    });
    
    return { user };
  } catch (error: unknown) {
    console.error('Login error:', error);
    if (error instanceof Error) {
      return { error: `Database error: ${error.message}` };
    }
    return { error: 'An unexpected error occurred during login' };
  }
}

export async function logoutUser(userId: string) {
  try {
    await db.user.update({
      where: { id: userId },
      data: {
        isOnline: false,
        lastSeen: new Date(),
      },
    });
  } catch (error) {
    console.error('Logout error:', error);
  }
}
