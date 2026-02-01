'use client';

import { useState, useEffect } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRemoteParticipants,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import Comments from './Comments';
import ParticipantList from './ParticipantList';
import TeamAnalyticsPanel from './TeamAnalyticsPanel';
import Image from 'next/image';

// Import banner image
import bannerImg from '@/app/assets/banner.jpg';

// Import Patriots images (12 images)
import patriots2 from '@/app/assets/patriots/2.jpeg';
import patriots3 from '@/app/assets/patriots/3.jpeg';
import patriots4 from '@/app/assets/patriots/4.webp';
import patriots5 from '@/app/assets/patriots/5.jpeg';
import patriots7 from '@/app/assets/patriots/7.webp';
import patriots8 from '@/app/assets/patriots/8.webp';
import patriots9 from '@/app/assets/patriots/9.jpeg';
import patriots10 from '@/app/assets/patriots/10.webp';
import patriots12 from '@/app/assets/patriots/12.webp';
import patriots13 from '@/app/assets/patriots/13.webp';
import patriots14 from '@/app/assets/patriots/14.webp';
import patriots15 from '@/app/assets/patriots/15.webp';

// Import Seahawks images (12 images)
import seahawks1 from '@/app/assets/seahawks/1.jpg';
import seahawks2 from '@/app/assets/seahawks/2.webp';
import seahawks4 from '@/app/assets/seahawks/4.webp';
import seahawks5 from '@/app/assets/seahawks/5.webp';
import seahawks6 from '@/app/assets/seahawks/6.webp';
import seahawks7 from '@/app/assets/seahawks/7.webp';
import seahawks8 from '@/app/assets/seahawks/8.webp';
import seahawks9 from '@/app/assets/seahawks/9.webp';
import seahawks11 from '@/app/assets/seahawks/11.jpg';
import seahawks12 from '@/app/assets/seahawks/12.jpg';
import seahawks14 from '@/app/assets/seahawks/14.webp';
import seahawks15 from '@/app/assets/seahawks/15.jpg';

const patriotsImages = [
  patriots2, patriots3, patriots4, patriots5, patriots7,
  patriots8, patriots9, patriots10, patriots12, patriots13,
  patriots14, patriots15,
];

const seahawksImages = [
  seahawks1, seahawks2, seahawks4, seahawks5, seahawks6,
  seahawks7, seahawks8, seahawks9, seahawks11, seahawks12,
  seahawks14, seahawks15,
];

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

  return (
    <LiveKitRoom
      token={token}
      serverUrl={livekitUrl}
      connect={true}
      audio={false}  // Listeners don't publish audio
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
      />
      {/* This renders audio from ALL tracks in the room - the host's broadcast */}
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
}

function RoomContent({ roomName, username, userId, isConnected, connectionError }: RoomContentProps) {
  // Get audio tracks from the room (from host)
  const audioTracks = useTracks([Track.Source.Microphone], { onlySubscribed: true });
  const remoteParticipants = useRemoteParticipants();
  
  // Check if host is broadcasting
  const hostTrack = audioTracks.find(track => 
    track.participant.identity === 'teamcast-host' || 
    track.publication?.trackName === 'podcast-audio'
  );
  
  const isBroadcasting = audioTracks.length > 0;
  const [showWaitingMessage, setShowWaitingMessage] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Determine team from room name (seahawks or patriots)
  const team = roomName.toLowerCase().includes('seahawk') ? 'seahawks' 
             : roomName.toLowerCase().includes('patriot') ? 'patriots' 
             : null;

  // Get team-specific images
  const teamImages = team === 'patriots' ? patriotsImages 
                   : team === 'seahawks' ? seahawksImages 
                   : [];

  // Hide waiting message after connection
  useEffect(() => {
    if (isBroadcasting) {
      setShowWaitingMessage(false);
    }
  }, [isBroadcasting]);

  // Cycle through images when broadcasting
  useEffect(() => {
    if (!isBroadcasting || teamImages.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % teamImages.length);
    }, 15000); // Change image every 15 seconds
    
    return () => clearInterval(interval);
  }, [isBroadcasting, teamImages.length]);

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
          {team && (
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                showAnalytics 
                  ? 'bg-accent text-white shadow-glow' 
                  : 'bg-surface-elevated border border-border text-steel-300 hover:text-white hover:border-accent'
              }`}
            >
              <span>📊</span>
              {showAnalytics ? 'Hide Analytics' : 'Coach Analytics'}
            </button>
          )}
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
              {isBroadcasting ? (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent-rose text-white text-sm font-bold tracking-wider rounded-full animate-glow">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  LIVE NOW
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-steel-700 text-steel-300 text-sm font-bold tracking-wider rounded-full">
                  <span className="w-2 h-2 bg-steel-500 rounded-full" />
                  WAITING FOR HOST
                </div>
              )}
              <h2 className="font-display text-4xl lg:text-5xl font-bold tracking-tight">
                Super Bowl Pre-Game Analysis
              </h2>
              <p className="text-lg text-steel-400 max-w-xl">
                Join Marcus & Jordan for expert analysis, predictions, and fan interactions 
                leading up to the big game.
              </p>
            </div>

            {/* Audio Player Visual - Listener Mode */}
            <div className="card overflow-hidden">
              <div className="aspect-video bg-gradient-to-br from-steel-900 via-surface to-steel-800 flex items-center justify-center relative">
                {/* Waiting state: Show banner with overlay */}
                {(!isConnected || !isBroadcasting) && (
                  <>
                    <Image
                      src={bannerImg}
                      alt="Super Bowl LIX"
                      fill
                      className="object-cover"
                      priority
                    />
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                      {!isConnected ? (
                        <>
                          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mb-6" />
                          <p className="text-2xl font-display font-bold text-white">Connecting to room...</p>
                        </>
                      ) : (
                        <>
                          <div className="relative mb-6">
                            <div className="w-20 h-20 border-4 border-white/20 rounded-full" />
                            <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-t-cyan-400 border-r-pink-500 rounded-full animate-spin" />
                          </div>
                          <p className="text-3xl font-display font-bold text-white mb-2">Hosts shall join shortly.</p>
                          <p className="text-lg text-white/60">Get ready for Super Bowl LIX coverage</p>
                        </>
                      )}
                    </div>
                  </>
                )}

                {/* Broadcasting state: Cycle through team images */}
                {isConnected && isBroadcasting && (
                  <>
                    {/* Team images cycling */}
                    {teamImages.length > 0 ? (
                      <>
                        {teamImages.map((img, index) => (
                          <Image
                            key={index}
                            src={img}
                            alt={`${team} image ${index + 1}`}
                            fill
                            className={`object-cover transition-opacity duration-1000 ${
                              index === currentImageIndex ? 'opacity-100' : 'opacity-0'
                            }`}
                            priority={index === 0}
                          />
                        ))}
                      </>
                    ) : (
                      /* Fallback for non-team rooms */
                      <div className="absolute inset-0 opacity-10">
                        <div className="absolute inset-0" style={{
                          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`,
                          backgroundSize: '32px 32px'
                        }} />
                      </div>
                    )}
                    
                  </>
                )}
              </div>
            </div>

          </div>

          {/* Right column - Chat & Participants */}
          <div className="flex flex-col gap-6 lg:h-[calc(100vh-160px)] lg:sticky lg:top-24">
            <div className="flex-1 min-h-[400px]">
              <Comments
                roomId={roomName}
                username={username}
                userId={userId}
              />
            </div>
            <ParticipantList />
          </div>
        </div>
      </main>

      {/* Analytics Panel - Slides in from right */}
      {team && (
        <TeamAnalyticsPanel 
          team={team} 
          isOpen={showAnalytics} 
          onClose={() => setShowAnalytics(false)} 
        />
      )}
    </div>
  );
}
