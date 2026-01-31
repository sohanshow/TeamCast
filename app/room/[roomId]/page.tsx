'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Room from '@/components/Room';
import { v4 as uuidv4 } from 'uuid';

interface TokenData {
  token: string;
  livekitUrl: string;
  identity: string;
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [username, setUsername] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUsername = sessionStorage.getItem('teamcast_username');
    
    if (!storedUsername) {
      router.push('/');
      return;
    }

    setUsername(storedUsername);
    const newUserId = uuidv4();
    setUserId(newUserId);

    // Get LiveKit token
    async function getToken() {
      try {
        const response = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName: roomId,
            username: storedUsername,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get access token');
        }

        const data = await response.json();
        setTokenData({
          token: data.token,
          livekitUrl: data.livekitUrl,
          identity: data.identity,
        });
      } catch (err) {
        console.error('Token error:', err);
        setError('Failed to connect to the room. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    getToken();
  }, [roomId, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-steel-800 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-xl font-display font-semibold">Connecting to room...</p>
            <p className="text-sm text-steel-500 mt-1">{roomId}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md text-center space-y-6">
          <div className="flex justify-center">
            <span className="text-6xl">😕</span>
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold">Connection Failed</h2>
            <p className="text-steel-400 mt-2">{error}</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="btn-primary"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!tokenData) {
    return null;
  }

  return (
    <Room
      roomName={roomId}
      username={username}
      token={tokenData.token}
      livekitUrl={tokenData.livekitUrl}
      userId={userId}
    />
  );
}
