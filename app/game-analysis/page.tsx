'use client';

import { useState, useEffect } from 'react';
import PlayCard from '@/components/game-analysis/PlayCard';
import PlayAnalytics from '@/components/game-analysis/PlayAnalytics';
import TendencyChart from '@/components/game-analysis/TendencyChart';
import PlayDetailPanel from '@/components/game-analysis/PlayDetailPanel';

interface EnrichedPlay {
  game_id: string;
  play_id: number;
  absolute_yardline: number;
  play_direction: string;
  ball_land_x: number;
  ball_land_y: number;
  num_frames: number;
  quarter: number;
  game_clock: string;
  down: number;
  yards_to_go: number;
  play_description: string;
  play_type: string;
  scoring_play: boolean;
  home_team: string;
  away_team: string;
  stadium: string;
  home_score: number;
  away_score: number;
  match_confidence: number;
  scene_description?: string;
  camera_angle?: string;
  formation_offense?: string;
  formation_defense?: string;
}

export default function GameAnalysisPage() {
  const [plays, setPlays] = useState<EnrichedPlay[]>([]);
  const [selectedPlay, setSelectedPlay] = useState<EnrichedPlay | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [maxPlays, setMaxPlays] = useState(10);
  const [showAnalytics, setShowAnalytics] = useState(true);

  useEffect(() => {
    fetchPlays();
  }, []);

  const fetchPlays = async () => {
    try {
      const response = await fetch('/api/game-analysis/plays');
      const data = await response.json();
      setPlays(data.plays || []);
      if (data.plays?.length > 0) {
        setSelectedPlay(data.plays[0]);
      }
    } catch (error) {
      console.error('Error fetching plays:', error);
    } finally {
      setLoading(false);
    }
  };

  const processPlays = async () => {
    setProcessing(true);
    try {
      const response = await fetch('/api/game-analysis/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week: 1, maxPlays }),
      });
      const data = await response.json();
      if (data.success) {
        await fetchPlays();
      }
    } catch (error) {
      console.error('Error processing plays:', error);
    } finally {
      setProcessing(false);
    }
  };

  // Get game info from first play
  const gameInfo = plays.length > 0 ? {
    home: plays[0].home_team,
    away: plays[0].away_team,
    stadium: plays[0].stadium,
  } : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a href="/" className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 hover:scale-105 transition-transform">
                <span className="text-xl">🏈</span>
              </a>
              <div>
                <h1 className="text-xl font-bold text-white">Game Analysis</h1>
                <p className="text-xs text-slate-400">NFL Play Analytics & Video Generation</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Analytics Toggle */}
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  showAnalytics 
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {showAnalytics ? '📊 Analytics On' : '📊 Analytics Off'}
              </button>

              <div className="h-6 w-px bg-slate-700" />
              
              {/* Max Plays */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-400">Plays:</label>
                <input
                  type="number"
                  value={maxPlays}
                  onChange={(e) => setMaxPlays(parseInt(e.target.value) || 10)}
                  className="w-14 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
                  min={1}
                  max={100}
                />
              </div>
              
              {/* Process Button */}
              <button
                onClick={processPlays}
                disabled={processing}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-500/20"
              >
                {processing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    Process Plays
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Game Info Banner */}
          {gameInfo && (
            <div className="mt-3 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-blue-400 font-medium">{gameInfo.away}</span>
                <span className="text-slate-500">@</span>
                <span className="text-purple-400 font-medium">{gameInfo.home}</span>
              </div>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">{gameInfo.stadium}</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">{plays.length} plays loaded</span>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Analytics Section */}
        {showAnalytics && plays.length > 0 && (
          <div className="mb-6 space-y-4">
            <PlayAnalytics plays={plays} />
            <TendencyChart plays={plays} />
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Play List */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="sticky top-24">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span>📋</span>
                  Plays
                  <span className="text-sm font-normal text-slate-400">({plays.length})</span>
                </h2>
              </div>
              
              <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-2 scrollbar-thin">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : plays.length === 0 ? (
                  <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700 border-dashed">
                    <span className="text-4xl mb-3 block">🏈</span>
                    <p className="text-slate-400">No plays loaded</p>
                    <p className="text-sm mt-2 text-slate-500">Click &quot;Process Plays&quot; to get started</p>
                  </div>
                ) : (
                  plays.map((play) => (
                    <PlayCard
                      key={`${play.game_id}-${play.play_id}`}
                      play={play}
                      isSelected={selectedPlay?.play_id === play.play_id}
                      onClick={() => setSelectedPlay(play)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Selected Play Detail */}
          <div className="lg:col-span-8 xl:col-span-9">
            {selectedPlay ? (
              <PlayDetailPanel play={selectedPlay} />
            ) : (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center">
                <span className="text-5xl mb-4 block">👈</span>
                <p className="text-slate-400 text-lg">Select a play to view details</p>
                <p className="text-slate-500 text-sm mt-2">Choose from the play list on the left</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-sm">
            TeamCast - NFL Play Analytics powered by AI
          </p>
          <p className="text-slate-600 text-xs mt-1">
            Video generation by Google Veo 3.1 | Scene analysis by Gemini
          </p>
        </div>
      </footer>
    </main>
  );
}
