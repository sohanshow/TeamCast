import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { addComment, getRoomStats } from '@/lib/podcast-engine';
import { Comment } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, userId, username, text } = body;

    if (!roomId || !username || !text) {
      return NextResponse.json(
        { error: 'roomId, username, and text are required' },
        { status: 400 }
      );
    }

    const comment: Comment = {
      id: uuidv4(),
      userId: userId || uuidv4(),
      username,
      text,
      timestamp: Date.now(),
    };

    const batch = addComment(roomId, comment);

    const stats = getRoomStats(roomId);

    return NextResponse.json({
      comment,
      shouldProcessBatch: batch !== null,
      batch: batch,
      stats,
    });
  } catch (error) {
    console.error('Comment submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit comment' },
      { status: 500 }
    );
  }
}
