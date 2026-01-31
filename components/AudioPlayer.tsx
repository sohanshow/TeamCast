'use client';

import { useEffect, useRef, useState } from 'react';
import { PodcastScript } from '@/lib/types';

interface AudioPlayerProps {
  roomId: string;
}

export default function AudioPlayer({ roomId }: AudioPlayerProps) {
  const [status, setStatus] = useState<'loading' | 'playing' | 'ended'>('loading');
  const [currentSpeaker, setCurrentSpeaker] = useState<string>('');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasStarted = useRef(false);
  const currentTurnRef = useRef(0);
  const scriptRef = useRef<PodcastScript | null>(null);
  const audioQueueRef = useRef<{ url: string; speakerName: string }[]>([]);
  const isPlayingRef = useRef(false);
  const isFetchingRef = useRef(false);

  // Fetch TTS for a single turn
  const fetchTurnAudio = async (turnIndex: number): Promise<{ url: string; speakerName: string } | null> => {
    if (!scriptRef.current || turnIndex >= scriptRef.current.turns.length) {
      return null;
    }

    const turn = scriptRef.current.turns[turnIndex];
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

      if (!res.ok) {
        console.error(`[Audio] TTS failed for turn ${turnIndex}`);
        return null;
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
        return { url: URL.createObjectURL(blob), speakerName: turn.speakerName };
      }
    } catch (err) {
      console.error(`[Audio] Error fetching turn ${turnIndex}:`, err);
    }
    return null;
  };

  // Play next audio from queue
  const playNext = async () => {
    if (!audioRef.current) return;

    if (audioQueueRef.current.length > 0) {
      const { url, speakerName } = audioQueueRef.current.shift()!;
      console.log(`[Audio] Playing: ${speakerName}`);
      audioRef.current.src = url;
      isPlayingRef.current = true;
      setStatus('playing');
      setCurrentSpeaker(speakerName);
      
      try {
        await audioRef.current.play();
      } catch (err) {
        console.error('[Audio] Play failed:', err);
        playNext();
      }
    } else {
      isPlayingRef.current = false;
      console.log('[Audio] Queue empty, waiting...');
    }
  };

  // Pre-fetch upcoming turns
  const prefetchTurns = async () => {
    if (isFetchingRef.current) return;
    if (!scriptRef.current) return;

    const script = scriptRef.current;
    const currentTurn = currentTurnRef.current;

    // Check if we've finished all turns
    if (currentTurn >= script.turns.length && audioQueueRef.current.length === 0 && !isPlayingRef.current) {
      setStatus('ended');
      return;
    }

    for (let i = currentTurn; i < Math.min(currentTurn + 2, script.turns.length); i++) {
      if (audioQueueRef.current.length >= 2) break;

      isFetchingRef.current = true;
      const audioData = await fetchTurnAudio(i);
      isFetchingRef.current = false;

      if (audioData) {
        audioQueueRef.current.push(audioData);
        currentTurnRef.current = i + 1;
        console.log(`[Audio] Queued turn ${i}, queue size: ${audioQueueRef.current.length}`);

        if (!isPlayingRef.current) {
          playNext();
        }
      }
    }
  };

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    console.log('[Audio] Starting podcast stream...');

    async function startPodcast() {
      try {
        setStatus('loading');
        
        console.log('[Audio] Generating script...');
        const scriptRes = await fetch('/api/podcast/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, turns: 3 }),
        });

        if (!scriptRes.ok) {
          console.error('[Audio] Script generation failed');
          return;
        }

        const scriptData = await scriptRes.json();
        if (!scriptData.script?.turns?.length) {
          console.error('[Audio] No script returned');
          return;
        }

        scriptRef.current = scriptData.script;
        console.log(`[Audio] Script ready: ${scriptData.script.turns.length} turns`);

        prefetchTurns();
      } catch (err) {
        console.error('[Audio] Error:', err);
      }
    }

    startPodcast();
  }, [roomId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      console.log('[Audio] Track ended');
      isPlayingRef.current = false;
      playNext();
      prefetchTurns();
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
  }, []);

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
                {currentSpeaker ? `Speaking: ${currentSpeaker}` : 'User hearing analysis'}
              </p>
            </div>
          </div>
        )}
        
        {status === 'ended' && (
          <div className="flex flex-col items-center gap-4 z-10">
            <span className="text-5xl">✅</span>
            <p className="text-xl font-display font-semibold text-steel-300">Analysis Complete</p>
          </div>
        )}
      </div>
    </div>
  );
}
