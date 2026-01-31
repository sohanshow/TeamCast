import { NextRequest, NextResponse } from 'next/server';
import { generateToken, getLiveKitUrl } from '@/lib/livekit';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomName, username } = body;

    if (!roomName || !username) {
      return NextResponse.json(
        { error: 'roomName and username are required' },
        { status: 400 }
      );
    }

    const participantIdentity = `user-${uuidv4().slice(0, 8)}`;

    const token = await generateToken({
      roomName,
      participantName: username,
      participantIdentity,
      isPublisher: false, // Regular participants can only listen
    });

    return NextResponse.json({
      token,
      roomName,
      livekitUrl: getLiveKitUrl(),
      identity: participantIdentity,
    });
  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
