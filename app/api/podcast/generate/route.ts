import { NextRequest, NextResponse } from 'next/server';
import { generatePodcastScript } from '@/lib/gemini';
import { Comment } from '@/lib/types';

// Simple in-memory lock to prevent concurrent generation per room
const generatingRooms = new Set<string>();

export async function POST(request: NextRequest) {
  console.log('[Generate API] Request received');
  
  try {
    const body = await request.json();
    const { roomId, turns = 3, isCommentAnalysis = false, comments = [] } = body;

    if (!roomId) {
      console.log('[Generate API] No roomId');
      return NextResponse.json(
        { error: 'roomId is required' },
        { status: 400 }
      );
    }

    // Prevent concurrent generation for same room
    if (generatingRooms.has(roomId)) {
      console.log('[Generate API] Already generating for room:', roomId);
      return NextResponse.json(
        { message: 'Generation already in progress', script: null },
        { status: 200 }
      );
    }

    generatingRooms.add(roomId);

    try {
      console.log('[Generate API] Starting generation...', { roomId, turns, isCommentAnalysis });
      
      const script = await generatePodcastScript(
        turns,
        undefined,
        isCommentAnalysis,
        comments as Comment[]
      );

      console.log('[Generate API] Script generated:', script.turns.length, 'turns');
      console.log('[Generate API] Returning script to client...');

      return NextResponse.json({
        trackId: `track-${Date.now()}`,
        script,
      });
    } finally {
      generatingRooms.delete(roomId);
    }
  } catch (error) {
    console.error('[Generate API] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to generate podcast script',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
