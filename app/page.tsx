'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import patriotLogo from './assets/patriot.png';
import seahawkLogo from './assets/seahawk.png';
import googleLogo from './assets/sponsors/google.png';
import vercelLogo from './assets/sponsors/vercel.png';
import livekitLogo from './assets/sponsors/livekit.jpeg';

interface ActiveRoom {
  roomId: string;
  name: string;
  listenerCount: number;
  createdAt: number;
}

export default function Home() {
  const [username, setUsername] = useState('');
  const [hasEnteredUsername, setHasEnteredUsername] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);
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

  const getListenerCount = (roomId: string) => {
    const room = activeRooms.find(r => r.roomId.toLowerCase() === roomId.toLowerCase());
    return room?.listenerCount || 0;
  };

  const isRoomActive = (roomId: string) => {
    return activeRooms.some(r => r.roomId.toLowerCase() === roomId.toLowerCase());
  };

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    setError('');
      sessionStorage.setItem('teamcast_username', username.trim());
    setHasEnteredUsername(true);
  };

  const handleTeamSelect = (team: 'patriots' | 'seahawks') => {
    if (!isRoomActive(team)) return;
    setIsJoining(true);
    sessionStorage.setItem('teamcast_room', team);
    router.push(`/room/${team}`);
  };

  const patriotsActive = isRoomActive('patriots');
  const seahawksActive = isRoomActive('seahawks');

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

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-16 lg:py-24">
        <div className="flex flex-col items-center text-center space-y-8">
          {/* Conditional rendering based on username state */}
          {!hasEnteredUsername ? (
            /* Username Entry - First Page */
            <>
            {/* Live badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent-rose/10 border border-accent-rose/30 rounded-full">
              <span className="w-2 h-2 bg-accent-rose rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-accent-rose tracking-wide">LIVE PODCAST</span>
            </div>

            {/* Logo & Title */}
            <div className="space-y-4">
                <div className="flex items-center justify-center gap-4">
                <span className="text-5xl">🏈</span>
                <h1 className="font-display text-6xl lg:text-7xl font-bold text-gradient tracking-tight">
                  TeamCast
                </h1>
              </div>
              <p className="text-2xl lg:text-3xl text-steel-300 font-display">
                Super Bowl Pre-Game Analysis
              </p>
            </div>

              <p className="text-lg text-steel-400 leading-relaxed max-w-xl">
              Join the ultimate pre-game experience. Listen to AI-powered analysis, 
              make predictions, and engage with fellow fans in real-time.
            </p>

              {/* Username Entry Form */}
              <div className="w-full max-w-md mt-8">
                <div className="bg-surface/80 backdrop-blur-xl p-8 rounded-2xl border border-steel-800/50 shadow-2xl">
                  <div className="space-y-2 text-center mb-6">
                    <h2 className="text-xl font-semibold text-white">Welcome!</h2>
                    <p className="text-steel-500 text-sm">Enter your display name to get started</p>
              </div>
                  
                  <form onSubmit={handleUsernameSubmit} className="space-y-4">
              <div className="space-y-2">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                        placeholder="Your display name"
                        className="w-full px-4 py-4 bg-black/60 border border-steel-800 rounded-xl
                                   text-white text-center text-lg placeholder-steel-600
                                   focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30
                                   transition-all duration-200"
                  maxLength={20}
                        autoFocus
                />
              </div>

              {error && (
                <p className="text-sm text-accent-rose">{error}</p>
              )}

              <button
                type="submit"
                className="btn-primary w-full py-4 text-lg"
                      disabled={!username.trim()}
                    >
                      Continue
              </button>
            </form>
                </div>
              </div>

              {/* Sponsors section */}
              <div className="flex items-center justify-center gap-4 pt-8 mt-8 border-t border-border w-full max-w-md">
                <div className="relative w-6 h-6 overflow-hidden rounded">
                  <Image src={livekitLogo} alt="LiveKit" fill className="object-cover" />
                </div>
                <div className="relative w-6 h-6 overflow-hidden rounded">
                  <Image src={googleLogo} alt="Google" fill className="object-cover" />
                </div>
                <div className="relative w-6 h-6 overflow-hidden rounded">
                  <Image src={vercelLogo} alt="Vercel" fill className="object-cover" />
                </div>
              </div>
            </>
          ) : (
            /* Team Selection - Second Page */
            <div className="w-full space-y-10">
              {/* Title */}
              <div className="space-y-2">
                <p className="text-steel-500 text-sm uppercase tracking-[0.3em] font-medium">Pre-Game</p>
                <h1 className="text-5xl lg:text-6xl font-bold text-white tracking-tight">
                  Super Bowl 2026
                </h1>
                <p className="text-steel-400 mt-4 text-lg">
                  Choose your team, <span className="text-accent font-semibold">{username}</span>
              </p>
            </div>

              {loadingRooms ? (
                <div className="flex items-center justify-center gap-3 py-12 text-steel-500">
                  <div className="w-5 h-5 border-2 border-steel-700 border-t-accent rounded-full animate-spin" />
                  <span>Finding live rooms...</span>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
                  {/* Patriots Card */}
                  <button
                    onClick={() => handleTeamSelect('patriots')}
                    onMouseEnter={() => patriotsActive && setHoveredTeam('patriots')}
                    onMouseLeave={() => setHoveredTeam(null)}
                    disabled={isJoining || !patriotsActive}
                    className={`group relative aspect-square rounded-2xl overflow-hidden border-2 transition-all duration-300 
                      ${!patriotsActive 
                        ? 'opacity-40 cursor-not-allowed border-steel-900 grayscale' 
                        : hoveredTeam === 'patriots' 
                          ? 'border-[#C8102E] shadow-lg shadow-[#C8102E]/20 scale-[1.02]' 
                          : 'border-steel-800 hover:border-steel-600 cursor-pointer'
                      }
                      ${isJoining ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {/* Background gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#C8102E] via-[#0C2340] to-[#0C2340]" />
                    
                    {/* Logo container */}
                    <div className="absolute inset-0 flex items-center justify-center p-8">
                      <div className={`relative w-full h-full transition-transform duration-300 ${patriotsActive ? 'group-hover:scale-110' : ''}`}>
                        <Image
                          src={patriotLogo}
                          alt="New England Patriots"
                          fill
                          className="object-contain drop-shadow-2xl"
                        />
                      </div>
                    </div>

                    {/* Overlay info */}
                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                      <h3 className="text-xl font-bold text-white">Patriots</h3>
                      <div className="flex items-center justify-center gap-2 mt-1">
                        {patriotsActive ? (
                          <>
                            <span className="w-2 h-2 bg-accent-emerald rounded-full animate-pulse" />
                            <span className="text-sm text-steel-300">
                              {getListenerCount('patriots')} listening
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-steel-500">Room not available</span>
                        )}
                      </div>
                    </div>

                    {/* Hover effect overlay */}
                    {patriotsActive && (
                      <div className={`absolute inset-0 bg-white/5 transition-opacity duration-300 ${hoveredTeam === 'patriots' ? 'opacity-100' : 'opacity-0'}`} />
                    )}
                  </button>

                  {/* Seahawks Card */}
                  <button
                    onClick={() => handleTeamSelect('seahawks')}
                    onMouseEnter={() => seahawksActive && setHoveredTeam('seahawks')}
                    onMouseLeave={() => setHoveredTeam(null)}
                    disabled={isJoining || !seahawksActive}
                    className={`group relative aspect-square rounded-2xl overflow-hidden border-2 transition-all duration-300 
                      ${!seahawksActive 
                        ? 'opacity-40 cursor-not-allowed border-steel-900 grayscale' 
                        : hoveredTeam === 'seahawks' 
                          ? 'border-[#69BE28] shadow-lg shadow-[#69BE28]/20 scale-[1.02]' 
                          : 'border-steel-800 hover:border-steel-600 cursor-pointer'
                      }
                      ${isJoining ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {/* Background gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#002244] via-[#002244] to-[#69BE28]/30" />
                    
                    {/* Logo container */}
                    <div className="absolute inset-0 flex items-center justify-center p-8">
                      <div className={`relative w-full h-full transition-transform duration-300 ${seahawksActive ? 'group-hover:scale-110' : ''}`}>
                        <Image
                          src={seahawkLogo}
                          alt="Seattle Seahawks"
                          fill
                          className="object-contain drop-shadow-2xl"
                        />
                      </div>
            </div>

                    {/* Overlay info */}
                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                      <h3 className="text-xl font-bold text-white">Seahawks</h3>
                      <div className="flex items-center justify-center gap-2 mt-1">
                        {seahawksActive ? (
                          <>
                            <span className="w-2 h-2 bg-accent-emerald rounded-full animate-pulse" />
                            <span className="text-sm text-steel-300">
                              {getListenerCount('seahawks')} listening
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-steel-500">Room not available</span>
                        )}
                      </div>
            </div>

                    {/* Hover effect overlay */}
                    {seahawksActive && (
                      <div className={`absolute inset-0 bg-white/5 transition-opacity duration-300 ${hoveredTeam === 'seahawks' ? 'opacity-100' : 'opacity-0'}`} />
                    )}
                  </button>
                </div>
              )}

              {/* No rooms available message */}
              {!loadingRooms && !patriotsActive && !seahawksActive && (
                <div className="text-center py-4">
                  <p className="text-steel-500">No rooms are currently live. Check back soon!</p>
                </div>
              )}

              {/* Back button */}
              <button
                onClick={() => setHasEnteredUsername(false)}
                className="text-steel-500 hover:text-steel-300 text-sm transition-colors inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Change username
              </button>

              {/* Sponsors section */}
              <div className="flex items-center justify-center gap-4 pt-8 border-t border-border w-full max-w-md mx-auto">
                <div className="relative w-6 h-6 overflow-hidden rounded">
                  <Image src={livekitLogo} alt="LiveKit" fill className="object-cover" />
                </div>
                <div className="relative w-6 h-6 overflow-hidden rounded">
                  <Image src={googleLogo} alt="Google" fill className="object-cover" />
                </div>
                <div className="relative w-6 h-6 overflow-hidden rounded">
                  <Image src={vercelLogo} alt="Vercel" fill className="object-cover" />
                </div>
              </div>
          </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 text-center text-sm text-steel-600">
        TeamCast © 2026 • Built for Super Bowl Fans
      </footer>
    </div>
  );
}
