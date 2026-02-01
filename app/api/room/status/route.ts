import { NextRequest, NextResponse } from 'next/server';
import { getComments, getRoomByRoomId, updateRoomLastCommentProcessed } from '@/lib/firestore-server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId');

  if (!roomId) {
    return NextResponse.json(
      { error: 'roomId is required' },
      { status: 400 }
    );
  }

  try {
    // Get room to check lastCommentProcessedAt
    const room = await getRoomByRoomId(roomId);
    const lastProcessedAt = (room as unknown as Record<string, unknown>)?.lastCommentProcessedAt as number || 0;
    
    // Get all comments from Firestore
    const allComments = await getComments(roomId);
    
    // Get comments that haven't been processed yet
    const now = Date.now();
    const unprocessedComments = allComments.filter(c => {
      const commentTime = c.timestamp || (c.createdAt?.toMillis?.() ?? 0);
      return commentTime > lastProcessedAt;
    });

    let pendingCommentBatch = null;
    
    // If we have unprocessed comments, return them
    if (unprocessedComments.length >= 1) {
      console.log(`[Room Status] Found ${unprocessedComments.length} unprocessed comments for room ${roomId}`);
      
      pendingCommentBatch = {
        comments: unprocessedComments.map(c => ({
          id: c.id,
          userId: c.userId,
          username: c.username,
          text: c.text,
          timestamp: c.timestamp || c.createdAt?.toMillis?.() || now,
        })),
        processedAt: now,
      };
    }

    return NextResponse.json({
      roomId,
      totalComments: allComments.length,
      unprocessedComments: unprocessedComments.length,
      pendingCommentBatch,
    });
  } catch (error) {
    console.error('[Room Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get room status' },
      { status: 500 }
    );
  }
}

// POST to mark comments as processed
export async function POST(request: NextRequest) {
  try {
    const { roomId } = await request.json();
    
    if (!roomId) {
      return NextResponse.json({ error: 'roomId required' }, { status: 400 });
    }
    
    // Update the room's lastCommentProcessedAt timestamp
    await updateRoomLastCommentProcessed(roomId);
    console.log(`[Room Status] Marked comments as processed for room ${roomId}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Room Status] Mark processed error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
