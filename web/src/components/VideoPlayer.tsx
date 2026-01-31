'use client';

import { useState, useEffect } from 'react';

interface VideoPlayerProps {
  playId: number;
  gameId: string;
  sceneDescription?: string;
}

export default function VideoPlayer({ playId, gameId, sceneDescription }: VideoPlayerProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Check if video exists when play changes
  useEffect(() => {
    checkVideoExists();
  }, [playId, gameId]);

  const checkVideoExists = async () => {
    try {
      const response = await fetch(`/api/generate-video?playId=${playId}&gameId=${gameId}`);
      const data = await response.json();
      if (data.exists) {
        setVideoUrl(data.videoUrl);
      } else {
        setVideoUrl(null);
      }
    } catch (err) {
      console.error('Error checking video:', err);
      setVideoUrl(null);
    }
  };

  const generateVideo = async () => {
    setGenerating(true);
    setError(null);
    setProgress(0);

    // Simulate progress while waiting
    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 2, 90));
    }, 1000);

    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playId,
          gameId,
          sceneDescription,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setProgress(100);
        setVideoUrl(data.videoUrl);
      } else {
        setError(data.error || 'Failed to generate video');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      clearInterval(progressInterval);
      setGenerating(false);
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <span>🎬</span>
        AI Generated Play Video
      </h3>

      {videoUrl ? (
        <div className="space-y-4">
          {/* Video Player */}
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video
              key={videoUrl}
              controls
              autoPlay
              loop
              className="w-full h-full object-contain"
            >
              <source src={videoUrl} type="video/mp4" />
              Your browser does not support video playback.
            </video>
          </div>

          {/* Regenerate button */}
          <button
            onClick={generateVideo}
            disabled={generating}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Regenerating...
              </>
            ) : (
              <>
                <span>🔄</span>
                Regenerate Video
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* No video - show generate button */}
          <div className="aspect-video bg-slate-900/50 rounded-lg flex flex-col items-center justify-center">
            {generating ? (
              <div className="text-center">
                <div className="w-16 h-16 mb-4 relative">
                  <svg className="animate-spin w-full h-full text-blue-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <p className="text-white font-medium mb-2">Generating Video with AI</p>
                <p className="text-slate-400 text-sm mb-4">This may take 30-60 seconds...</p>
                
                {/* Progress bar */}
                <div className="w-48 h-2 bg-slate-700 rounded-full overflow-hidden mx-auto">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">{progress}%</p>
              </div>
            ) : error ? (
              <div className="text-center px-4">
                <div className="text-red-400 text-4xl mb-3">⚠️</div>
                <p className="text-red-400 font-medium mb-2">Generation Failed</p>
                <p className="text-slate-400 text-sm mb-4">{error}</p>
                <button
                  onClick={generateVideo}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-all"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-5xl mb-4">🎥</div>
                <p className="text-slate-400 mb-4">No video generated yet</p>
                <button
                  onClick={generateVideo}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-500/25"
                >
                  <span className="flex items-center gap-2">
                    <span>✨</span>
                    Generate AI Video
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Info text */}
          <p className="text-xs text-slate-500 text-center">
            Videos are generated using Google Veo AI based on play data and scene descriptions
          </p>
        </div>
      )}
    </div>
  );
}
