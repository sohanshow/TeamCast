'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  useLocalParticipant,
  useTracks,
} from '@livekit/components-react';
import { Track, LocalAudioTrack, createLocalAudioTrack } from 'livekit-client';
import '@livekit/components-styles';
import { PodcastScript, PodcastTurn } from '@/lib/types';

interface TokenData {
  token: string;
  livekitUrl: string;
  identity: string;
}

export default function HostPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function getHostToken() {
      try {
        const response = await fetch('/api/livekit/host-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName: roomId }),
        });

        if (!response.ok) {
          throw new Error('Failed to get host token');
        }

        const data = await response.json();
        setTokenData({
          token: data.token,
          livekitUrl: data.livekitUrl,
          identity: data.identity,
        });
      } catch (err) {
        console.error('Host token error:', err);
        setError('Failed to connect as host. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    getHostToken();
  }, [roomId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-xl font-semibold text-white">Connecting as host...</p>
        </div>
      </div>
    );
  }

  if (error || !tokenData) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="max-w-md text-center space-y-6">
          <p className="text-6xl">❌</p>
          <h2 className="text-2xl font-bold text-white">Host Connection Failed</h2>
          <p className="text-gray-400">{error}</p>
          <button onClick={() => router.push('/admin')} className="px-6 py-3 bg-orange-500 text-white rounded-lg">
            Back to Admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={tokenData.token}
      serverUrl={tokenData.livekitUrl}
      connect={true}
      audio={false}
      video={false}
    >
      <HostBroadcaster roomId={roomId} />
    </LiveKitRoom>
  );
}

function HostBroadcaster({ roomId }: { roomId: string }) {
  const { localParticipant } = useLocalParticipant();
  
  const [status, setStatus] = useState<'idle' | 'starting' | 'broadcasting' | 'generating'>('idle');
  const [currentSpeaker, setCurrentSpeaker] = useState('');
  const [listenerCount, setListenerCount] = useState(0);
  const [batchNumber, setBatchNumber] = useState(0);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const mediaStreamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const turnsRef = useRef<PodcastTurn[]>([]);
  const currentTurnIndexRef = useRef(0);
  const isPlayingRef = useRef(false);
  const isGeneratingRef = useRef(false);
  const isBroadcastingRef = useRef(false);
  const lastCommentCheckRef = useRef(Date.now());

  // Generate podcast script
  const generateScript = useCallback(async (isCommentAnalysis = false, comments: unknown[] = []) => {
    if (isGeneratingRef.current) return null;
    isGeneratingRef.current = true;
    setStatus('generating');

    try {
      const res = await fetch('/api/podcast/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, turns: 3, isCommentAnalysis, comments }),
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (!data.script?.turns?.length) return null;

      setBatchNumber(prev => prev + 1);
      return data.script as PodcastScript;
    } catch (err) {
      console.error('[Host] Script generation error:', err);
      return null;
    } finally {
      isGeneratingRef.current = false;
    }
  }, [roomId]);

  // Fetch TTS and return audio buffer
  const fetchTTSBuffer = async (turn: PodcastTurn): Promise<AudioBuffer | null> => {
    try {
      const res = await fetch('/api/podcast/tts/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: turn.text, voiceId: turn.voiceId }),
      });

      if (!res.ok) return null;
      const data = await res.json();
      
      if (data.audioBase64 && audioContextRef.current) {
        const byteCharacters = atob(data.audioBase64);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteArray[i] = byteCharacters.charCodeAt(i);
        }
        return await audioContextRef.current.decodeAudioData(byteArray.buffer);
      }
    } catch (err) {
      console.error('[Host] TTS fetch error:', err);
    }
    return null;
  };

  // Play audio buffer through LiveKit
  const playAudioBuffer = (buffer: AudioBuffer): Promise<void> => {
    return new Promise((resolve) => {
      if (!audioContextRef.current || !mediaStreamDestRef.current) {
        resolve();
        return;
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(mediaStreamDestRef.current);
      source.onended = () => resolve();
      source.start();
    });
  };

  // Main broadcast loop
  const broadcastLoop = useCallback(async () => {
    if (!isBroadcastingRef.current) return;

    // Generate more content if needed
    if (currentTurnIndexRef.current >= turnsRef.current.length) {
      const script = await generateScript();
      if (script) {
        turnsRef.current = [...turnsRef.current, ...script.turns];
      } else {
        // Wait and retry
        setTimeout(broadcastLoop, 5000);
        return;
      }
    }

    // Play current turn
    const turn = turnsRef.current[currentTurnIndexRef.current];
    if (turn) {
      setCurrentSpeaker(turn.speakerName);
      setStatus('broadcasting');
      isPlayingRef.current = true;

      const buffer = await fetchTTSBuffer(turn);
      if (buffer) {
        await playAudioBuffer(buffer);
      }

      currentTurnIndexRef.current++;
      isPlayingRef.current = false;
    }

    // Check for comments periodically
    const now = Date.now();
    if (now - lastCommentCheckRef.current > 30000) {
      lastCommentCheckRef.current = now;
      try {
        const res = await fetch(`/api/room/status?roomId=${roomId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.pendingCommentBatch) {
            const script = await generateScript(true, data.pendingCommentBatch.comments);
            if (script) {
              // Insert comment analysis next
              turnsRef.current.splice(currentTurnIndexRef.current, 0, ...script.turns);
            }
          }
        }
      } catch (err) {
        console.error('[Host] Comment check error:', err);
      }
    }

    // Continue loop
    if (isBroadcastingRef.current) {
      setTimeout(broadcastLoop, 100);
    }
  }, [generateScript, roomId]);

  // Start broadcasting
  const startBroadcast = async () => {
    setStatus('starting');

    try {
      // Initialize audio context
      audioContextRef.current = new AudioContext();
      mediaStreamDestRef.current = audioContextRef.current.createMediaStreamDestination();

      // Create and publish LiveKit track
      const audioTrack = new LocalAudioTrack(
        mediaStreamDestRef.current.stream.getAudioTracks()[0],
        undefined,
        false
      );
      audioTrackRef.current = audioTrack;

      await localParticipant.publishTrack(audioTrack, {
        name: 'podcast-audio',
        source: Track.Source.Microphone,
      });

      console.log('[Host] Audio track published to LiveKit');

      // Generate initial content
      const script = await generateScript();
      if (!script) {
        throw new Error('Failed to generate initial script');
      }
      turnsRef.current = script.turns;

      // Start broadcast loop
      isBroadcastingRef.current = true;
      broadcastLoop();
    } catch (err) {
      console.error('[Host] Failed to start broadcast:', err);
      setStatus('idle');
    }
  };

  // Stop broadcasting
  const stopBroadcast = async () => {
    isBroadcastingRef.current = false;
    
    if (audioTrackRef.current) {
      await localParticipant.unpublishTrack(audioTrackRef.current);
      audioTrackRef.current.stop();
      audioTrackRef.current = null;
    }

    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setStatus('idle');
    setCurrentSpeaker('');
  };

  // Track listener count
  const tracks = useTracks([Track.Source.Microphone]);
  useEffect(() => {
    // Count remote participants
    setListenerCount(tracks.length > 0 ? tracks.length - 1 : 0);
  }, [tracks]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <header className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎙️</span>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-rose-500 bg-clip-text text-transparent">
            HOST BROADCAST
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="px-3 py-1.5 text-sm font-mono bg-white/5 border border-white/10 rounded-lg">
            {roomId}
          </span>
          {status !== 'idle' && (
            <span className="flex items-center gap-2 px-3 py-1.5 text-sm bg-emerald-500/20 text-emerald-400 rounded-lg">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              {listenerCount} listening
            </span>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-8 py-12">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          {status === 'idle' && (
            <div className="text-center space-y-6">
              <div className="text-6xl">🎧</div>
              <h2 className="text-3xl font-bold">Ready to Broadcast</h2>
              <p className="text-gray-400 max-w-md mx-auto">
                Start the podcast broadcast. Audio will be streamed to all users who join this room.
              </p>
              <button
                onClick={startBroadcast}
                className="px-8 py-4 text-lg bg-gradient-to-r from-orange-500 to-rose-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
              >
                🎙️ Start Broadcasting
              </button>
            </div>
          )}

          {status === 'starting' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto" />
              <h2 className="text-2xl font-bold">Starting Broadcast...</h2>
              <p className="text-gray-400">Generating initial podcast content</p>
            </div>
          )}

          {(status === 'broadcasting' || status === 'generating') && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 text-rose-400 rounded-lg font-semibold">
                    <span className="w-3 h-3 bg-rose-500 rounded-full animate-pulse" />
                    LIVE
                  </span>
                  <span className="text-gray-400">Batch #{batchNumber}</span>
                </div>
                <button
                  onClick={stopBroadcast}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                >
                  Stop Broadcast
                </button>
              </div>

              <div className="bg-black/30 rounded-xl p-8 text-center">
                {status === 'broadcasting' ? (
                  <>
                    <div className="flex items-end justify-center gap-1 h-16 mb-6">
                      {[...Array(12)].map((_, i) => (
                        <div
                          key={i}
                          className="w-3 bg-gradient-to-t from-orange-500 to-rose-500 rounded-full animate-pulse"
                          style={{
                            height: `${20 + Math.random() * 80}%`,
                            animationDelay: `${i * 0.1}s`,
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-2xl font-bold text-white">{currentSpeaker}</p>
                    <p className="text-gray-500 mt-2">Speaking now...</p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto mb-6" />
                    <p className="text-xl font-semibold text-gray-300">Generating next segment...</p>
                  </>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-3xl font-bold text-orange-400">{listenerCount}</p>
                  <p className="text-sm text-gray-500">Listeners</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-3xl font-bold text-emerald-400">{batchNumber}</p>
                  <p className="text-sm text-gray-500">Segments</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-3xl font-bold text-blue-400">{currentTurnIndexRef.current}</p>
                  <p className="text-sm text-gray-500">Turns Played</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <p className="text-amber-400 text-sm">
            ⚠️ <strong>Keep this page open</strong> to continue broadcasting. 
            Users can join at <code className="bg-black/30 px-2 py-0.5 rounded">/room/{roomId}</code>
          </p>
        </div>
      </main>
    </div>
  );
}
