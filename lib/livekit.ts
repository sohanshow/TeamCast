import { AccessToken } from 'livekit-server-sdk';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY!;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET!;

export interface TokenOptions {
  roomName: string;
  participantName: string;
  participantIdentity: string;
  isPublisher?: boolean;
}

/**
 * Generate a LiveKit access token for a participant
 */
export async function generateToken(options: TokenOptions): Promise<string> {
  const { roomName, participantName, participantIdentity, isPublisher = false } = options;

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: participantIdentity,
    name: participantName,
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: isPublisher,
    canSubscribe: true,
    canPublishData: true, // For chat/comments
  });

  return await token.toJwt();
}

/**
 * Generate a token for the podcast host (audio publisher)
 */
export async function generateHostToken(roomName: string): Promise<string> {
  return generateToken({
    roomName,
    participantName: 'TeamCast Host',
    participantIdentity: 'teamcast-host',
    isPublisher: true,
  });
}

/**
 * Get the LiveKit WebSocket URL
 */
export function getLiveKitUrl(): string {
  return process.env.LIVEKIT_URL!;
}
