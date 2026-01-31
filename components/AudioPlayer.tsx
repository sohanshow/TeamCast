'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { PodcastScript, PodcastTurn } from '@/lib/types';

interface AudioPlayerProps {
  roomId: string;
}

interface QueuedAudio {
  url: string;
  speakerName: string;
  turnIndex: number;
  isCommentAnalysis?: boolean;
}

export default function AudioPlayer({ roomId }: AudioPlayerProps) {
  const [status, setStatus] = useState<'loading' | 'playing' | 'generating' | 'rate_limited' | 'needs_interaction'>('loading');
  const [currentSpeaker, setCurrentSpeaker] = useState<string>('');
  const [batchNumber, setBatchNumber] = useState(1);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);
  const [queueSize, setQueueSize] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasStarted = useRef(false);
  const turnsRef = useRef<PodcastTurn[]>([]);
  const currentTurnIndexRef = useRef(0);
  const audioQueueRef = useRef<QueuedAudio[]>([]);
  const isPlayingRef = useRef(false);
  const isFetchingRef = useRef(false);
  const isGeneratingScriptRef = useRef(false);
  const commentQueueRef = useRef<PodcastTurn[]>([]);
  const lastCommentCheckRef = useRef(Date.now());
  const consecutiveFailuresRef = useRef(0);
  const isRateLimitedRef = useRef(false);
  const autoplayBlockedRef = useRef(false);

  // Generate a new script batch
  const generateNewScript = useCallback(async (isCommentAnalysis = false, comments: unknown[] = []) => {
    if (isGeneratingScriptRef.current) {
      console.log('[Audio] Script generation already in progress');
      return null;
    }

    isGeneratingScriptRef.current = true;
    setStatus('generating');
    console.log(`[Audio] Generating new script batch #${batchNumber + 1}...`);

    try {
      const scriptRes = await fetch('/api/podcast/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          roomId, 
          turns: 3,
          isCommentAnalysis,
          comments 
        }),
      });

      if (!scriptRes.ok) {
        console.error('[Audio] Script generation failed');
        return null;
      }

      const scriptData = await scriptRes.json();
      if (!scriptData.script?.turns?.length) {
        console.error('[Audio] No script returned');
        return null;
      }

      setBatchNumber(prev => prev + 1);
      console.log(`[Audio] New script ready: ${scriptData.script.turns.length} turns`);
      return scriptData.script as PodcastScript;
    } catch (err) {
      console.error('[Audio] Script generation error:', err);
      return null;
    } finally {
      isGeneratingScriptRef.current = false;
    }
  }, [roomId, batchNumber]);

  // Fetch TTS for a single turn - returns { audio, rateLimited }
  const fetchTurnAudio = async (turn: PodcastTurn, turnIndex: number): Promise<{ audio: QueuedAudio | null; rateLimited: boolean }> => {
    console.log(`[Audio] Fetching TTS for turn ${turnIndex}: "${turn.text.slice(0, 50)}..."`);

    try {
      const res = await fetch('/api/podcast/tts/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: turn.text,
          voiceId: turn.voiceId,
          turnIndex,
        }),
      });

      // Check for rate limiting
      if (res.status === 429 || res.status === 500) {
        const errorData = await res.json().catch(() => ({}));
        const isRateLimit = res.status === 429 || 
          (errorData.error && errorData.error.includes('429')) ||
          (errorData.error && errorData.error.includes('quota'));
        
        if (isRateLimit) {
          console.error(`[Audio] Rate limited! Stopping TTS requests.`);
          return { audio: null, rateLimited: true };
        }
        console.error(`[Audio] TTS failed for turn ${turnIndex}`);
        return { audio: null, rateLimited: false };
      }

      if (!res.ok) {
        console.error(`[Audio] TTS failed for turn ${turnIndex}`);
        return { audio: null, rateLimited: false };
      }

      const data = await res.json();
      if (data.audioBase64) {
        const byteCharacters = atob(data.audioBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.mimeType || 'audio/wav' });
        consecutiveFailuresRef.current = 0; // Reset on success
        return { 
          audio: { 
            url: URL.createObjectURL(blob), 
            speakerName: turn.speakerName,
            turnIndex 
          },
          rateLimited: false
        };
      }
    } catch (err) {
      console.error(`[Audio] Error fetching turn ${turnIndex}:`, err);
    }
    return { audio: null, rateLimited: false };
  };

  // Play next audio from queue
  const playNext = useCallback(async () => {
    if (!audioRef.current) return;

    setQueueSize(audioQueueRef.current.length);

    if (audioQueueRef.current.length > 0) {
      const queuedAudio = audioQueueRef.current.shift()!;
      console.log(`[Audio] Playing: ${queuedAudio.speakerName}, queue remaining: ${audioQueueRef.current.length}`);
      audioRef.current.src = queuedAudio.url;
      isPlayingRef.current = true;
      setStatus('playing');
      setCurrentSpeaker(queuedAudio.speakerName);
      setQueueSize(audioQueueRef.current.length);
      
      try {
        await audioRef.current.play();
        autoplayBlockedRef.current = false;
      } catch (err: unknown) {
        console.error('[Audio] Play failed:', err);
        // Check if it's an autoplay block
        if (err instanceof Error && err.name === 'NotAllowedError') {
          console.log('[Audio] Autoplay blocked - need user interaction');
          autoplayBlockedRef.current = true;
          setStatus('needs_interaction');
          // Put the audio back in the queue
          audioQueueRef.current.unshift(queuedAudio);
        } else {
          isPlayingRef.current = false;
          playNext();
        }
      }
    } else {
      isPlayingRef.current = false;
      if (!isRateLimitedRef.current) {
        setStatus('generating');
      }
      console.log('[Audio] Queue empty, generating more content...');
    }
  }, []);

  // Handle user click to enable audio
  const handleEnableAudio = useCallback(async () => {
    if (!audioRef.current) return;
    autoplayBlockedRef.current = false;
    
    // Try to play from the queue
    if (audioQueueRef.current.length > 0) {
      const queuedAudio = audioQueueRef.current.shift()!;
      audioRef.current.src = queuedAudio.url;
      isPlayingRef.current = true;
      setStatus('playing');
      setCurrentSpeaker(queuedAudio.speakerName);
      
      try {
        await audioRef.current.play();
      } catch (err) {
        console.error('[Audio] Play failed even after user interaction:', err);
        setStatus('generating');
      }
    } else {
      setStatus('generating');
    }
  }, []);

  // Process comment turns if any
  const processCommentTurns = useCallback(async () => {
    if (commentQueueRef.current.length === 0) return;
    
    console.log(`[Audio] Processing ${commentQueueRef.current.length} comment analysis turns`);
    const turns = [...commentQueueRef.current];
    commentQueueRef.current = [];
    
    // Add comment turns to the main turns queue (prioritize them)
    turnsRef.current = [...turns, ...turnsRef.current.slice(currentTurnIndexRef.current)];
    currentTurnIndexRef.current = 0;
  }, []);

  // Main content generation and prefetch loop
  const prefetchAndGenerate = useCallback(async () => {
    // Don't do anything if rate limited
    if (isRateLimitedRef.current) {
      const now = Date.now();
      if (rateLimitedUntil && now < rateLimitedUntil) {
        console.log(`[Audio] Rate limited, waiting ${Math.ceil((rateLimitedUntil - now) / 1000)}s...`);
        return;
      } else {
        // Rate limit period expired, try again
        console.log('[Audio] Rate limit period expired, retrying...');
        isRateLimitedRef.current = false;
        setRateLimitedUntil(null);
        setStatus('generating');
      }
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      // Process any pending comment turns first
      await processCommentTurns();

      // Check if we need more turns
      const remainingTurns = turnsRef.current.length - currentTurnIndexRef.current;
      
      // If we're running low on turns, generate more
      if (remainingTurns <= 2 && !isGeneratingScriptRef.current) {
        console.log(`[Audio] Low on turns (${remainingTurns} remaining), generating more...`);
        const newScript = await generateNewScript();
        if (newScript) {
          turnsRef.current = [...turnsRef.current, ...newScript.turns];
          console.log(`[Audio] Added ${newScript.turns.length} new turns. Total: ${turnsRef.current.length}`);
        }
      }

      // Prefetch audio for upcoming turns
      while (
        audioQueueRef.current.length < 3 && 
        currentTurnIndexRef.current < turnsRef.current.length &&
        !isRateLimitedRef.current
      ) {
        const turn = turnsRef.current[currentTurnIndexRef.current];
        const { audio: audioData, rateLimited } = await fetchTurnAudio(turn, currentTurnIndexRef.current);
        
        if (rateLimited) {
          // Stop all requests for 60 seconds
          console.log('[Audio] Rate limit detected! Pausing for 60 seconds.');
          isRateLimitedRef.current = true;
          const retryAt = Date.now() + 60000;
          setRateLimitedUntil(retryAt);
          setStatus('rate_limited');
          break;
        }

        if (audioData) {
          audioQueueRef.current.push(audioData);
          console.log(`[Audio] Queued turn ${currentTurnIndexRef.current}, queue size: ${audioQueueRef.current.length}`);
          currentTurnIndexRef.current++;
          consecutiveFailuresRef.current = 0;

          // Start playing if not already
          if (!isPlayingRef.current && audioQueueRef.current.length > 0) {
            playNext();
          }
        } else {
          // TTS failed (not rate limited), skip this turn but track failures
          consecutiveFailuresRef.current++;
          currentTurnIndexRef.current++;
          
          // If too many consecutive failures, slow down
          if (consecutiveFailuresRef.current >= 3) {
            console.log('[Audio] Too many consecutive failures, waiting 10 seconds...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            consecutiveFailuresRef.current = 0;
          }
        }
        
        // Small delay between TTS requests to avoid hammering API
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [generateNewScript, playNext, processCommentTurns, rateLimitedUntil]);

  // Check for comment batches to process
  const checkForComments = useCallback(async () => {
    const now = Date.now();
    const timeSinceLastCheck = now - lastCommentCheckRef.current;
    
    // Check every 30 seconds for pending comments
    if (timeSinceLastCheck < 30000) return;
    lastCommentCheckRef.current = now;

    try {
      const res = await fetch(`/api/room/status?roomId=${roomId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.pendingCommentBatch) {
          console.log('[Audio] Processing comment batch from server');
          const script = await generateNewScript(true, data.pendingCommentBatch.comments);
          if (script) {
            // Prioritize comment analysis by adding to front
            commentQueueRef.current = [...commentQueueRef.current, ...script.turns];
          }
        }
      }
    } catch (err) {
      console.error('[Audio] Comment check error:', err);
    }
  }, [roomId, generateNewScript]);

  // Initial setup
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    console.log('[Audio] Starting continuous podcast stream...');

    async function startPodcast() {
      try {
        setStatus('loading');
        
        console.log('[Audio] Generating initial script...');
        const script = await generateNewScript();
        
        if (!script) {
          console.error('[Audio] Failed to generate initial script');
          return;
        }

        turnsRef.current = script.turns;
        console.log(`[Audio] Initial script ready: ${script.turns.length} turns`);

        // Start prefetching and playing
        prefetchAndGenerate();
      } catch (err) {
        console.error('[Audio] Error:', err);
      }
    }

    startPodcast();
  }, [generateNewScript, prefetchAndGenerate]);

  // Continuous generation loop
  useEffect(() => {
    const interval = setInterval(() => {
      prefetchAndGenerate();
      checkForComments();
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [prefetchAndGenerate, checkForComments]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      console.log('[Audio] Track ended');
      isPlayingRef.current = false;
      playNext();
      prefetchAndGenerate();
    };

    const handleError = (e: Event) => {
      console.error('[Audio] Playback error:', e);
      isPlayingRef.current = false;
      playNext();
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [playNext, prefetchAndGenerate]);

  return (
    <div className="card overflow-hidden">
      {/* Hidden audio element */}
      <audio ref={audioRef} />
      
      {/* Visual display area - will be used for images/videos later */}
      <div className="aspect-video bg-gradient-to-br from-steel-900 via-surface to-steel-800 flex items-center justify-center relative">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }} />
        </div>
        
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4 z-10">
            <div className="w-16 h-16 border-4 border-steel-700 border-t-accent rounded-full animate-spin" />
            <p className="text-xl font-display font-semibold text-steel-300">Podcast Loading...</p>
            <p className="text-sm text-steel-500">Generating AI content, this may take 10-15 seconds</p>
          </div>
        )}
        
        {status === 'playing' && (
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
              <p className="text-steel-400 mt-1">
                {currentSpeaker ? `Speaking: ${currentSpeaker}` : 'Listening to analysis'}
              </p>
              <p className="text-xs text-steel-600 mt-2">Batch #{batchNumber}</p>
            </div>
          </div>
        )}
        
        {status === 'generating' && (
          <div className="flex flex-col items-center gap-4 z-10">
            <div className="w-12 h-12 border-4 border-steel-700 border-t-accent-emerald rounded-full animate-spin" />
            <p className="text-xl font-display font-semibold text-steel-300">Generating More Content...</p>
            <p className="text-sm text-steel-500">The hosts are preparing their next segment</p>
          </div>
        )}
        
        {status === 'rate_limited' && (
          <div className="flex flex-col items-center gap-4 z-10">
            <div className="text-6xl">⏳</div>
            <p className="text-xl font-display font-semibold text-amber-400">API Rate Limited</p>
            <p className="text-sm text-steel-400">
              Waiting {rateLimitedUntil ? Math.max(0, Math.ceil((rateLimitedUntil - Date.now()) / 1000)) : 60}s before retrying...
            </p>
            <p className="text-xs text-steel-600 mt-2">The AI service is temporarily unavailable</p>
          </div>
        )}
        
        {status === 'needs_interaction' && (
          <div className="flex flex-col items-center gap-4 z-10">
            <div className="text-6xl">🔊</div>
            <p className="text-xl font-display font-semibold text-white">Click to Enable Audio</p>
            <p className="text-sm text-steel-400 mb-2">
              Browser requires user interaction to play audio
            </p>
            <button
              onClick={handleEnableAudio}
              className="px-6 py-3 bg-gradient-to-r from-accent to-accent-cyan text-white font-bold rounded-lg
                       hover:shadow-glow transition-all transform hover:scale-105"
            >
              🎧 Start Listening
            </button>
            {queueSize > 0 && (
              <p className="text-xs text-steel-600">{queueSize} audio clips ready to play</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
