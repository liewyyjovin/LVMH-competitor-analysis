import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory store for progress tracking
// In a production app, use Redis or another persistent store
const progressStore: Record<string, { completed: number, total: number }> = {};

export function setProgress(sessionId: string, completed: number, total: number) {
  progressStore[sessionId] = { completed, total };
}

export function clearProgress(sessionId: string) {
  delete progressStore[sessionId];
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');
  
  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
  }
  
  const progress = progressStore[sessionId] || { completed: 0, total: 0 };
  
  return NextResponse.json({
    sessionId,
    progress: progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0,
    completed: progress.completed,
    total: progress.total,
  });
} 