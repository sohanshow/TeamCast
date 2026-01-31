import { NextRequest, NextResponse } from 'next/server';
import { generateScriptAudio } from '@/lib/gemini';
import { PodcastScript } from '@/lib/types';

export async function POST(request: NextRequest) {
  console.log('[TTS API] Request received');
  
  try {
    const body = await request.json();
    console.log('[TTS API] Body parsed, script present:', !!body.script);
    
    const { script } = body;

    if (!script) {
      console.log('[TTS API] No script in request body');
      return NextResponse.json(
        { error: 'script is required' },
        { status: 400 }
      );
    }

    console.log('[TTS API] Starting TTS generation for', script.turns?.length, 'turns');

    const audioResults = await generateScriptAudio(script as PodcastScript);

    console.log('[TTS API] TTS complete, results:', audioResults.length);

    return NextResponse.json({
      audioResults,
    });
  } catch (error) {
    console.error('[TTS API] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to generate TTS',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
