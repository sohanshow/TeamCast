import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { addComment as addCommentToFirestore, getComments } from '@/lib/firestore-server';
import { addComment as addCommentToEngine, getRoomStats } from '@/lib/podcast-engine';
import { Comment } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json(
        { error: 'roomId is required' },
        { status: 400 }
      );
    }

    // Get comments from Firestore
    const comments = await getComments(roomId);
    
    return NextResponse.json({
      comments: comments.map(c => ({
        id: c.id,
        userId: c.userId,
        username: c.username,
        text: c.text,
        timestamp: c.timestamp || c.createdAt?.toMillis?.() || Date.now(),
      })),
    });
  } catch (error) {
    console.error('Comments fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

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

    const commentId = uuidv4();
    const timestamp = Date.now();

    // Store comment in Firestore for persistence
    await addCommentToFirestore({
      text,
      userId: userId || uuidv4(),
      username,
      roomId,
      timestamp,
    });

    // Also add to in-memory engine for podcast batch processing
    const comment: Comment = {
      id: commentId,
      userId: userId || uuidv4(),
      username,
      text,
      timestamp,
    };
    const batch = addCommentToEngine(roomId, comment);

    const stats = getRoomStats(roomId);

    return NextResponse.json({
      comment: {
        id: commentId,
        userId: comment.userId,
        username,
        text,
        timestamp,
      },
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
