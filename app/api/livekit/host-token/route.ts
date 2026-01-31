import { NextRequest, NextResponse } from 'next/server';
import { generateHostToken, getLiveKitUrl } from '@/lib/livekit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomName } = body;

    if (!roomName) {
      return NextResponse.json(
        { error: 'roomName is required' },
        { status: 400 }
      );
    }

    const token = await generateHostToken(roomName);

    return NextResponse.json({
      token,
      roomName,
      livekitUrl: getLiveKitUrl(),
      identity: 'teamcast-host',
    });
  } catch (error) {
    console.error('Host token generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate host token' },
      { status: 500 }
    );
  }
}
