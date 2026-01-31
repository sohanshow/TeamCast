import { NextRequest, NextResponse } from 'next/server';
import { summarizeComments, generatePodcastScript } from '@/lib/gemini';
import { addTrackToQueue, updateContext } from '@/lib/podcast-engine';
import { Comment } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, comments } = body;

    if (!roomId || !comments || !Array.isArray(comments) || comments.length === 0) {
      return NextResponse.json(
        { error: 'roomId and comments array are required' },
        { status: 400 }
      );
    }

    // Summarize the comments
    const summary = await summarizeComments(comments as Comment[]);

    // Generate a comment-analysis podcast segment
    const script = await generatePodcastScript(
      2, // Shorter segment for comment responses
      summary,
      true,
      comments as Comment[]
    );

    // Add to track queue with priority (comment tracks should be timely)
    const track = addTrackToQueue(roomId, script);

    // Update context
    if (script.turns.length > 0) {
      const lastTurn = script.turns[script.turns.length - 1];
      updateContext(
        roomId,
        `Just addressed audience comments. ${lastTurn.speakerName} said: "${lastTurn.text}"`
      );
    }

    // Extract mentioned usernames
    const mentionedUsernames = comments.map((c: Comment) => c.username);

    return NextResponse.json({
      trackId: track.id,
      summary,
      script,
      mentionedUsernames,
    });
  } catch (error) {
    console.error('Comment summarization error:', error);
    return NextResponse.json(
      { error: 'Failed to summarize comments' },
      { status: 500 }
    );
  }
}
