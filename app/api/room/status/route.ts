import { NextRequest, NextResponse } from 'next/server';
import { getRoomStats, getAllTracks, needsMoreTracks, checkPendingCommentBatch } from '@/lib/podcast-engine';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId');

  if (!roomId) {
    return NextResponse.json(
      { error: 'roomId is required' },
      { status: 400 }
    );
  }

  const stats = getRoomStats(roomId);
  const tracks = getAllTracks(roomId);
  const needsGeneration = needsMoreTracks(roomId);
  
  // Check if there's a pending comment batch ready for processing (time-based)
  const pendingCommentBatch = checkPendingCommentBatch(roomId);

  return NextResponse.json({
    roomId,
    stats,
    tracks: tracks.map((t) => ({
      id: t.id,
      status: t.status,
      type: t.script.type,
      generatedAt: t.script.generatedAt,
    })),
    needsGeneration,
    pendingCommentBatch,
  });
}
