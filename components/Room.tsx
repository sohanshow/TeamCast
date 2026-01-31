'use client';

import { useState, useCallback } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import AudioPlayer from './AudioPlayer';
import Comments from './Comments';
import ParticipantList from './ParticipantList';
import { Comment } from '@/lib/types';

interface RoomProps {
  roomName: string;
  username: string;
  token: string;
  livekitUrl: string;
  userId: string;
}

export default function Room({ roomName, username, token, livekitUrl, userId }: RoomProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const handleBatchReady = useCallback(async (comments: Comment[]) => {
    try {
      await fetch('/api/comments/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: roomName, comments }),
      });
    } catch (error) {
      console.error('Failed to process comment batch:', error);
    }
  }, [roomName]);


  return (
    <LiveKitRoom
      token={token}
      serverUrl={livekitUrl}
      connect={true}
      audio={false}
      video={false}
      onConnected={() => setIsConnected(true)}
      onDisconnected={() => setIsConnected(false)}
      onError={(error) => setConnectionError(error.message)}
    >
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-50 flex items-center justify-between px-6 lg:px-8 py-4 bg-surface/90 backdrop-blur-xl border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏈</span>
            <h1 className="font-display text-2xl font-bold text-gradient">TEAMCAST</h1>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-block px-3 py-1.5 text-sm font-mono bg-surface-elevated border border-border rounded-lg">
              {roomName}
            </span>
            <span className={`text-sm transition-colors ${isConnected ? 'text-accent-emerald' : 'text-steel-500'}`}>
              {isConnected ? '● Connected' : '○ Connecting...'}
            </span>
          </div>

          <div className="flex items-center">
            <span className="px-4 py-2 text-sm font-semibold bg-surface-elevated border border-border rounded-full text-accent">
              @{username}
            </span>
          </div>
        </header>

        {connectionError && (
          <div className="px-6 py-3 bg-accent-rose/10 border-b border-accent-rose/30 text-center text-sm text-accent-rose">
            Connection error: {connectionError}
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-6 lg:p-8">
          <div className="grid lg:grid-cols-[1fr_400px] gap-8">
            {/* Left column - Player */}
            <div className="space-y-6">
              {/* Live badge & title */}
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent-rose text-white text-sm font-bold tracking-wider rounded-full animate-glow">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  LIVE NOW
                </div>
                <h2 className="font-display text-4xl lg:text-5xl font-bold tracking-tight">
                  Super Bowl Pre-Game Analysis
                </h2>
                <p className="text-lg text-steel-400 max-w-xl">
                  Join Marcus & Jordan for expert analysis, predictions, and fan interactions 
                  leading up to the big game.
                </p>
              </div>

              {/* Audio Player */}
              <AudioPlayer roomId={roomName} />

              {/* Features */}
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { icon: '🎙️', title: 'AI-Powered Analysis', desc: 'Real-time insights by Gemini' },
                  { icon: '💬', title: 'Interactive Comments', desc: 'Your comments shape the show' },
                  { icon: '👥', title: 'Community Listening', desc: 'Experience it with fellow fans' },
                ].map((feature) => (
                  <div key={feature.title} className="flex gap-4 p-5 bg-surface-overlay border border-border rounded-xl">
                    <span className="text-2xl">{feature.icon}</span>
                    <div>
                      <h4 className="font-semibold text-sm">{feature.title}</h4>
                      <p className="text-xs text-steel-500 mt-0.5">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column - Chat & Participants */}
            <div className="flex flex-col gap-6 lg:h-[calc(100vh-160px)] lg:sticky lg:top-24">
              <div className="flex-1 min-h-[400px]">
                <Comments
                  roomId={roomName}
                  username={username}
                  userId={userId}
                  onBatchReady={handleBatchReady}
                />
              </div>
              <ParticipantList />
            </div>
          </div>
        </main>

        <RoomAudioRenderer />
      </div>
    </LiveKitRoom>
  );
}
