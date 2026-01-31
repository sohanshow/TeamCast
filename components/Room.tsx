'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  useParticipants,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import Comments from './Comments';
import ParticipantList from './ParticipantList';

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

  const handleBatchReady = useCallback(() => {
    console.log('[Room] Comment batch ready');
  }, []);

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
      <RoomContent
        roomName={roomName}
        username={username}
        userId={userId}
        isConnected={isConnected}
        connectionError={connectionError}
        onBatchReady={handleBatchReady}
      />
      {/* This renders audio from all published tracks */}
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

interface RoomContentProps {
  roomName: string;
  username: string;
  userId: string;
  isConnected: boolean;
  connectionError: string | null;
  onBatchReady: () => void;
}

function RoomContent({ 
  roomName, 
  username, 
  userId, 
  isConnected, 
  connectionError,
  onBatchReady 
}: RoomContentProps) {
  const [isBroadcastLive, setIsBroadcastLive] = useState(false);
  
  // Track audio streams from the host
  const audioTracks = useTracks([Track.Source.Microphone]);
  const participants = useParticipants();
  
  // Check if host is broadcasting
  useEffect(() => {
    const hostTrack = audioTracks.find(
      track => track.participant.identity === 'teamcast-host'
    );
    setIsBroadcastLive(!!hostTrack);
  }, [audioTracks]);

  const listenerCount = participants.filter(p => p.identity !== 'teamcast-host').length;

  return (
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
              {isBroadcastLive ? (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent-rose text-white text-sm font-bold tracking-wider rounded-full animate-glow">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  LIVE NOW
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-steel-800 text-steel-400 text-sm font-bold tracking-wider rounded-full">
                  <span className="w-2 h-2 bg-steel-600 rounded-full" />
                  WAITING FOR BROADCAST
                </div>
              )}
              <h2 className="font-display text-4xl lg:text-5xl font-bold tracking-tight">
                Super Bowl Pre-Game Analysis
              </h2>
              <p className="text-lg text-steel-400 max-w-xl">
                {isBroadcastLive 
                  ? 'Listen to Marcus & Jordan for expert analysis, predictions, and fan interactions.'
                  : 'The broadcast hasn\'t started yet. Wait for the host to begin streaming.'}
              </p>
            </div>

            {/* Audio Visualizer / Status Card */}
            <div className="card overflow-hidden">
              <div className="aspect-video bg-gradient-to-br from-steel-900 via-surface to-steel-800 flex items-center justify-center relative">
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`,
                    backgroundSize: '32px 32px'
                  }} />
                </div>
                
                {isBroadcastLive ? (
                  <div className="flex flex-col items-center gap-6 z-10">
                    {/* Audio visualization bars */}
                    <div className="flex items-end gap-1 h-16">
                      {[...Array(12)].map((_, i) => (
                        <div
                          key={i}
                          className="w-2 bg-gradient-to-t from-accent to-accent-cyan rounded-full animate-pulse"
                          style={{
                            height: `${20 + Math.random() * 80}%`,
                            animationDelay: `${i * 0.1}s`,
                            animationDuration: `${0.5 + Math.random() * 0.5}s`
                          }}
                        />
                      ))}
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-display font-bold text-white">🎧 Live Analysis</p>
                      <p className="text-steel-400 mt-1">Listening to the broadcast</p>
                      <p className="text-xs text-steel-600 mt-2">{listenerCount} listeners in room</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 z-10 text-center">
                    <span className="text-6xl opacity-50">📻</span>
                    <p className="text-xl font-display font-semibold text-steel-400">
                      Waiting for broadcast...
                    </p>
                    <p className="text-sm text-steel-600 max-w-xs">
                      The host will start streaming soon. Stay tuned!
                    </p>
                  </div>
                )}
              </div>
            </div>

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
                onBatchReady={onBatchReady}
              />
            </div>
            <ParticipantList />
          </div>
        </div>
      </main>
    </div>
  );
}
