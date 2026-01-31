import { NextRequest, NextResponse } from 'next/server';
import { generatePodcastScript } from '@/lib/gemini';
import { Comment } from '@/lib/types';
import { getRoomByRoomId } from '@/lib/firestore-server';

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
      // Get room config from Firestore for base prompt
      const roomConfig = await getRoomByRoomId(roomId);
      const basePrompt = roomConfig?.basePrompt || '';
      
      if (isCommentAnalysis && comments.length > 0) {
        console.log('[Generate API] Comment Analysis Request:', {
          roomId,
          turns,
          commentCount: comments.length,
          hasBasePrompt: !!basePrompt,
          basePromptPreview: basePrompt.slice(0, 50) + (basePrompt.length > 50 ? '...' : ''),
        });
      } else {
        console.log('[Generate API] Starting generation...', { 
          roomId, 
          turns, 
          isCommentAnalysis, 
          hasBasePrompt: !!basePrompt,
          basePromptPreview: basePrompt.slice(0, 50) + (basePrompt.length > 50 ? '...' : '')
        });
      }
      
      const script = await generatePodcastScript(
        turns,
        undefined,
        isCommentAnalysis,
        comments as Comment[],
        basePrompt
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
    
    // Check for rate limiting
    const isRateLimit = errorMessage.includes('429') || 
                        errorMessage.includes('quota') || 
                        errorMessage.includes('RESOURCE_EXHAUSTED');
    
    if (isRateLimit) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', rateLimited: true },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to generate podcast script',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
