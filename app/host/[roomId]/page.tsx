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

interface QueuedAudio {
  buffer: AudioBuffer;
  speakerName: string;
  turnIndex: number;
  text: string; // Store text for conversation history
}

function HostBroadcaster({ roomId }: { roomId: string }) {
  const { localParticipant } = useLocalParticipant();
  
  const [status, setStatus] = useState<'idle' | 'starting' | 'broadcasting' | 'generating' | 'prefetching'>('idle');
  const [currentSpeaker, setCurrentSpeaker] = useState('');
  const [listenerCount, setListenerCount] = useState(0);
  const [batchNumber, setBatchNumber] = useState(0);
  const [queueSize, setQueueSize] = useState(0);
  const [turnsPlayed, setTurnsPlayed] = useState(0);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const mediaStreamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const turnsRef = useRef<PodcastTurn[]>([]);
  const audioQueueRef = useRef<QueuedAudio[]>([]);
  const playedTurnsRef = useRef<PodcastTurn[]>([]); // Track last played turns for context
  const currentTurnIndexRef = useRef(0);
  const isPlayingRef = useRef(false);
  const isFetchingRef = useRef(false);
  const isGeneratingRef = useRef(false);
  const isBroadcastingRef = useRef(false);
  const isProcessingCommentsRef = useRef(false); // Block prefetching during comment processing
  const isTrackPublishedRef = useRef(false); // Track if LiveKit track is published
  const lastCommentCheckRef = useRef(Date.now());

  // Generate podcast script with conversation history
  const generateScript = useCallback(async (isCommentAnalysis = false, comments: unknown[] = []) => {
    if (isGeneratingRef.current) return null;
    isGeneratingRef.current = true;

    // Get last 3 played turns for context continuity
    const recentTurns = playedTurnsRef.current.slice(-3);
    const context = recentTurns.length > 0 
      ? recentTurns.map(t => `${t.speakerName}: ${t.text}`).join('\n')
      : undefined;

    console.log('[Host] Generating new script...', { 
      hasContext: !!context, 
      contextTurns: recentTurns.length,
      isCommentAnalysis 
    });

    try {
      const res = await fetch('/api/podcast/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, turns: 2, isCommentAnalysis, comments, context }),
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (!data.script?.turns?.length) return null;

      setBatchNumber(prev => prev + 1);
      console.log(`[Host] Generated ${data.script.turns.length} new turns`);
      return data.script as PodcastScript;
    } catch (err) {
      console.error('[Host] Script generation error:', err);
      return null;
    } finally {
      isGeneratingRef.current = false;
    }
  }, [roomId]);

  // Fetch TTS and return audio buffer
  const fetchTTSBuffer = async (turn: PodcastTurn, turnIndex: number): Promise<QueuedAudio | null> => {
    try {
      console.log(`[Host] Fetching TTS for turn #${turnIndex}: ${turn.speakerName}`);
      
      const res = await fetch('/api/podcast/tts/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: turn.text, 
          voiceId: turn.voiceId,
          turnIndex 
        }),
      });

      if (!res.ok) {
        console.error(`[Host] TTS failed for turn #${turnIndex}`);
        return null;
      }
      
      const data = await res.json();
      
      if (data.audioBase64 && audioContextRef.current) {
        const byteCharacters = atob(data.audioBase64);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteArray[i] = byteCharacters.charCodeAt(i);
        }
        const buffer = await audioContextRef.current.decodeAudioData(byteArray.buffer);
        console.log(`[Host] TTS ready for turn #${turnIndex}`);
        return { buffer, speakerName: turn.speakerName, turnIndex, text: turn.text };
      }
    } catch (err) {
      console.error('[Host] TTS fetch error:', err);
    }
    return null;
  };

  // Publish audio track to LiveKit (called on first audio play)
  const publishAudioTrack = async () => {
    if (isTrackPublishedRef.current || !mediaStreamDestRef.current) return;
    
    try {
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

      isTrackPublishedRef.current = true;
      console.log('[Host] Audio track published to LiveKit - listeners will now see LIVE');
    } catch (err) {
      console.error('[Host] Failed to publish audio track:', err);
    }
  };

  // Play audio buffer through LiveKit
  const playAudioBuffer = async (buffer: AudioBuffer): Promise<void> => {
    // Publish track on first audio play (this is when listeners should see "LIVE")
    if (!isTrackPublishedRef.current) {
      await publishAudioTrack();
    }

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

  // Prefetch TTS for upcoming turns
  const prefetchTTS = useCallback(async () => {
    // Don't prefetch if already fetching, not broadcasting, or processing comments
    if (isFetchingRef.current || !isBroadcastingRef.current || isProcessingCommentsRef.current) return;
    isFetchingRef.current = true;

    try {
      // Generate more script if needed (but not during comment processing)
      const remainingTurns = turnsRef.current.length - currentTurnIndexRef.current;
      if (remainingTurns <= 2 && !isGeneratingRef.current && !isProcessingCommentsRef.current) {
        setStatus(isPlayingRef.current ? 'broadcasting' : 'generating');
        const script = await generateScript();
        if (script) {
          turnsRef.current = [...turnsRef.current, ...script.turns];
        }
      }

      // Prefetch audio for upcoming turns (keep queue at 2) - skip if processing comments
      while (
        audioQueueRef.current.length < 2 &&
        currentTurnIndexRef.current < turnsRef.current.length &&
        !isProcessingCommentsRef.current // Stop if comments started processing
      ) {
        const turn = turnsRef.current[currentTurnIndexRef.current];
        const audio = await fetchTTSBuffer(turn, currentTurnIndexRef.current);
        
        if (audio && !isProcessingCommentsRef.current) {
          audioQueueRef.current.push(audio);
          setQueueSize(audioQueueRef.current.length);
          currentTurnIndexRef.current++;
        } else if (!isProcessingCommentsRef.current) {
          // Skip failed TTS
          currentTurnIndexRef.current++;
        } else {
          // Comments started, break out
          break;
        }
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [generateScript]);

  // Play next audio from queue
  const playNext = useCallback(async () => {
    if (!isBroadcastingRef.current) return;

    if (audioQueueRef.current.length > 0) {
      const audio = audioQueueRef.current.shift()!;
      setQueueSize(audioQueueRef.current.length);
      
      console.log(`[Host] Playing turn #${audio.turnIndex}: ${audio.speakerName}`);
      setCurrentSpeaker(audio.speakerName);
      setStatus('broadcasting');
      isPlayingRef.current = true;
      setTurnsPlayed(prev => prev + 1);

      // Track this turn in played history for context (keep last 5)
      playedTurnsRef.current.push({ 
        speakerName: audio.speakerName, 
        text: audio.text,
        speaker: 'Speaker1',
        voiceId: ''
      });
      if (playedTurnsRef.current.length > 5) {
        playedTurnsRef.current.shift();
      }

      await playAudioBuffer(audio.buffer);
      
      isPlayingRef.current = false;
      
      // Start prefetching more while we have a gap
      prefetchTTS();
      
      // Play next immediately
      playNext();
    } else {
      // Queue empty, wait for prefetch
      setStatus('prefetching');
      console.log('[Host] Queue empty, waiting for prefetch...');
      setTimeout(playNext, 500);
    }
  }, [prefetchTTS]);

  // Check for comments periodically - comments are PRIORITIZED
  const checkComments = useCallback(async () => {
    const now = Date.now();
    if (now - lastCommentCheckRef.current < 2000) return; // Check every 2 seconds for immediate comment response
    if (isGeneratingRef.current || isProcessingCommentsRef.current) return; // Don't interrupt ongoing generation
    lastCommentCheckRef.current = now;

    try {
      const res = await fetch(`/api/room/status?roomId=${roomId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.pendingCommentBatch && data.pendingCommentBatch.comments?.length > 0) {
          // SET FLAG IMMEDIATELY to stop all prefetching (but let current audio continue)
          isProcessingCommentsRef.current = true;
          
          console.log(`[Host] 🎤 Found ${data.pendingCommentBatch.comments.length} unprocessed comments - preparing response...`);
          
          // Mark comments as processed to prevent duplicate processing
          await fetch('/api/room/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId }),
          });
          
          // Generate comment analysis script (let current audio continue playing)
          const script = await generateScript(true, data.pendingCommentBatch.comments);
          if (script && script.turns.length > 0) {
            console.log(`[Host] Generated ${script.turns.length} comment response turns - fetching TTS...`);
            
            // Fetch TTS for ALL comment turns FIRST before clearing queue
            const commentAudios: QueuedAudio[] = [];
            for (let i = 0; i < script.turns.length; i++) {
              const turn = script.turns[i];
              console.log(`[Host] Fetching priority TTS for comment turn ${i + 1}/${script.turns.length}`);
              const audio = await fetchTTSBuffer(turn, -1 - i); // Negative index to indicate priority
              if (audio) {
                commentAudios.push(audio);
              }
            }
            
            // NOW clear the queue and insert comment audio (only after TTS is ready)
            if (commentAudios.length > 0) {
              const clearedCount = audioQueueRef.current.length;
              audioQueueRef.current = [...commentAudios]; // Replace with comment audio
              setQueueSize(audioQueueRef.current.length);
              console.log(`[Host] 🗑️ Cleared ${clearedCount} queued tracks, inserted ${commentAudios.length} comment turns - ready for playback`);
            }
          }
          
          // UNSET FLAG to allow prefetching to resume
          isProcessingCommentsRef.current = false;
        }
      }
    } catch (err) {
      console.error('[Host] Comment check error:', err);
      isProcessingCommentsRef.current = false; // Make sure to unset on error
    }
  }, [roomId, generateScript]);

  // Background tasks interval - check frequently for responsive comment handling
  useEffect(() => {
    if (status === 'idle' || status === 'starting') return;
    
    const interval = setInterval(() => {
      prefetchTTS();
      checkComments();
    }, 2000); // Check every 2 seconds for faster comment response

    return () => clearInterval(interval);
  }, [status, prefetchTTS, checkComments]);

  // Start broadcasting
  const startBroadcast = async () => {
    setStatus('starting');

    try {
      // Initialize audio context (track will be published on first audio play)
      audioContextRef.current = new AudioContext();
      mediaStreamDestRef.current = audioContextRef.current.createMediaStreamDestination();

      console.log('[Host] Audio context initialized, generating content...');

      // Generate initial content
      const script = await generateScript();
      if (!script) {
        throw new Error('Failed to generate initial script');
      }
      turnsRef.current = script.turns;

      // Start prefetching
      isBroadcastingRef.current = true;
      setStatus('prefetching');
      
      // Prefetch first few turns
      await prefetchTTS();
      
      // Start playback (track will be published when first audio plays)
      playNext();
    } catch (err) {
      console.error('[Host] Failed to start broadcast:', err);
      setStatus('idle');
    }
  };

  // Stop broadcasting
  const stopBroadcast = async () => {
    isBroadcastingRef.current = false;
    isTrackPublishedRef.current = false;
    
    if (audioTrackRef.current) {
      await localParticipant.unpublishTrack(audioTrackRef.current);
      audioTrackRef.current.stop();
      audioTrackRef.current = null;
    }

    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    audioQueueRef.current = [];
    setStatus('idle');
    setCurrentSpeaker('');
    setQueueSize(0);
  };

  // Track listener count using remote participants
  const tracks = useTracks([Track.Source.Microphone]);
  useEffect(() => {
    setListenerCount(Math.max(0, tracks.length - 1));
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

          {(status === 'broadcasting' || status === 'generating' || status === 'prefetching') && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 text-rose-400 rounded-lg font-semibold">
                    <span className="w-3 h-3 bg-rose-500 rounded-full animate-pulse" />
                    LIVE
                  </span>
                  <span className="text-gray-400">Batch #{batchNumber}</span>
                  <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded">
                    Queue: {queueSize}
                  </span>
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
                ) : status === 'prefetching' ? (
                  <>
                    <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-6" />
                    <p className="text-xl font-semibold text-gray-300">Buffering audio...</p>
                    <p className="text-sm text-gray-500 mt-2">Prefetching next segments</p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto mb-6" />
                    <p className="text-xl font-semibold text-gray-300">Generating next segment...</p>
                  </>
                )}
              </div>

              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-3xl font-bold text-orange-400">{listenerCount}</p>
                  <p className="text-sm text-gray-500">Listeners</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-3xl font-bold text-emerald-400">{batchNumber}</p>
                  <p className="text-sm text-gray-500">Batches</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-3xl font-bold text-blue-400">{turnsPlayed}</p>
                  <p className="text-sm text-gray-500">Turns Played</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-3xl font-bold text-purple-400">{queueSize}</p>
                  <p className="text-sm text-gray-500">In Queue</p>
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
