'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ActiveRoom {
  roomId: string;
  name: string;
  listenerCount: number;
  createdAt: number;
}

export default function Home() {
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const router = useRouter();

  // Fetch active rooms on mount
  useEffect(() => {
    async function fetchActiveRooms() {
      try {
        const res = await fetch('/api/rooms');
        if (res.ok) {
          const data = await res.json();
          setActiveRooms(data.rooms || []);
        }
      } catch (err) {
        console.error('Failed to fetch active rooms:', err);
      } finally {
        setLoadingRooms(false);
      }
    }
    fetchActiveRooms();

    // Poll for updates every 10 seconds
    const interval = setInterval(fetchActiveRooms, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleJoin = async (e: React.FormEvent, selectedRoomId?: string) => {
    e.preventDefault();
    const targetRoom = selectedRoomId || roomCode;
    
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    if (!targetRoom.trim()) {
      setError('Please select or enter a room code');
      return;
    }

    setIsJoining(true);
    setError('');

    try {
      sessionStorage.setItem('teamcast_username', username.trim());
      sessionStorage.setItem('teamcast_room', targetRoom);
      router.push(`/room/${targetRoom}`);
    } catch (err) {
      setError('Failed to join room. Please try again.');
      setIsJoining(false);
    }
  };

  const handleRoomSelect = (room: ActiveRoom) => {
    setRoomCode(room.roomId);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent-cyan/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-steel-950/50 to-transparent" />
        {/* Grid overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Hero content */}
          <div className="space-y-8">
            {/* Live badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent-rose/10 border border-accent-rose/30 rounded-full">
              <span className="w-2 h-2 bg-accent-rose rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-accent-rose tracking-wide">LIVE PODCAST</span>
            </div>

            {/* Logo & Title */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-5xl">🏈</span>
                <h1 className="font-display text-6xl lg:text-7xl font-bold text-gradient tracking-tight">
                  TEAMCAST
                </h1>
              </div>
              <p className="text-2xl lg:text-3xl text-steel-300 font-display">
                Super Bowl Pre-Game Analysis
              </p>
            </div>

            <p className="text-lg text-steel-400 leading-relaxed max-w-lg">
              Join the ultimate pre-game experience. Listen to AI-powered analysis, 
              make predictions, and engage with fellow fans in real-time.
            </p>

            {/* Active Rooms Section */}
            {activeRooms.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-steel-300 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 bg-accent-emerald rounded-full animate-pulse" />
                  Live Rooms
                </h3>
                <div className="space-y-2">
                  {activeRooms.map((room) => (
                    <button
                      key={room.roomId}
                      onClick={() => handleRoomSelect(room)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all
                        ${roomCode === room.roomId 
                          ? 'bg-accent/10 border-accent' 
                          : 'bg-surface-overlay border-border hover:border-steel-700'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🎙️</span>
                        <div className="text-left">
                          <p className="font-semibold text-white">{room.name}</p>
                          <p className="text-xs text-steel-500 font-mono">{room.roomId}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 text-xs font-medium bg-accent-emerald/20 text-accent-emerald rounded-full">
                          {room.listenerCount} listening
                        </span>
                        {roomCode === room.roomId && (
                          <span className="text-accent">✓</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loadingRooms && (
              <div className="flex items-center gap-3 text-steel-500">
                <div className="w-5 h-5 border-2 border-steel-700 border-t-accent rounded-full animate-spin" />
                <span className="text-sm">Finding live rooms...</span>
              </div>
            )}

            {!loadingRooms && activeRooms.length === 0 && (
              <div className="p-4 bg-surface-overlay border border-border rounded-xl">
                <p className="text-steel-400 text-sm">
                  No live rooms at the moment. Enter a room code below or check back soon!
                </p>
              </div>
            )}

            {/* Join Form */}
            <form onSubmit={(e) => handleJoin(e)} className="space-y-4 max-w-md">
              <div className="space-y-2">
                <label htmlFor="username" className="block text-sm font-medium text-steel-300">
                  Your Display Name
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. SuperFan49"
                  className="input-field"
                  maxLength={20}
                  disabled={isJoining}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="room" className="block text-sm font-medium text-steel-300">
                  Room Code {activeRooms.length > 0 && <span className="text-steel-600">(or select above)</span>}
                </label>
                <input
                  id="room"
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder="Enter room code"
                  className="input-field font-mono"
                  disabled={isJoining}
                />
              </div>

              {error && (
                <p className="text-sm text-accent-rose">{error}</p>
              )}

              <button
                type="submit"
                className="btn-primary w-full py-4 text-lg"
                disabled={isJoining || !roomCode.trim()}
              >
                {isJoining ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    Join the Broadcast
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Features pills */}
            <div className="flex flex-wrap gap-3">
              {[
                { icon: '🎙️', label: 'AI Hosts' },
                { icon: '💬', label: 'Live Chat' },
                { icon: '👥', label: '100 Listeners' },
                { icon: '⚡', label: 'Real-time' },
              ].map((feature) => (
                <div
                  key={feature.label}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-elevated border border-border rounded-full"
                >
                  <span>{feature.icon}</span>
                  <span className="text-sm font-medium text-steel-300">{feature.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Info cards */}
          <div className="space-y-6">
            <div className="card p-6 space-y-3 hover:border-steel-700 transition-colors">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <span>🎯</span> What is TeamCast?
              </h3>
              <p className="text-steel-400 leading-relaxed">
                TeamCast is an AI-powered live podcast experience for the Super Bowl. 
                Our hosts Marcus & Jordan provide real-time analysis, respond to your 
                comments, and keep the energy high as we count down to kickoff.
              </p>
            </div>

            <div className="card p-6 space-y-3 hover:border-steel-700 transition-colors">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <span>📢</span> Your Voice Matters
              </h3>
              <p className="text-steel-400 leading-relaxed">
                Drop a comment and our AI hosts will address your questions and takes 
                live on air. The best comments get featured in the broadcast!
              </p>
            </div>

            <div className="card p-6 space-y-3 hover:border-steel-700 transition-colors">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <span>🔊</span> How It Works
              </h3>
              <ul className="space-y-2 text-steel-400">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-accent rounded-full" />
                  Enter your name and join the room
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-accent rounded-full" />
                  Listen to the live AI-generated podcast
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-accent rounded-full" />
                  Share your thoughts in the chat
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-accent rounded-full" />
                  Hear the hosts respond to the community
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-between p-4 bg-surface-raised rounded-lg border border-border-subtle">
              <span className="text-sm text-steel-500">Powered by</span>
              <div className="flex gap-2">
                <span className="badge badge-accent">LiveKit</span>
                <span className="badge badge-accent">Gemini AI</span>
                <span className="badge badge-accent">Next.js</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 text-center text-sm text-steel-600">
        TeamCast © 2026 • Built for Super Bowl Fans
      </footer>
    </div>
  );
}
