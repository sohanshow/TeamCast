'use client';

import { useState, useEffect } from 'react';
import PlayCard from '@/components/PlayCard';
import FieldVisualization from '@/components/FieldVisualization';
import PipelineStatus from '@/components/PipelineStatus';

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

export default function Home() {
  const [plays, setPlays] = useState<EnrichedPlay[]>([]);
  const [selectedPlay, setSelectedPlay] = useState<EnrichedPlay | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [maxPlays, setMaxPlays] = useState(10);

  useEffect(() => {
    fetchPlays();
  }, []);

  const fetchPlays = async () => {
    try {
      const response = await fetch('/api/plays');
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
      const response = await fetch('/api/process', {
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-xl">🏈</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">TeamCast</h1>
              <p className="text-xs text-slate-400">NFL Play Video Generator</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">Max plays:</label>
              <input
                type="number"
                value={maxPlays}
                onChange={(e) => setMaxPlays(parseInt(e.target.value) || 10)}
                className="w-16 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                min={1}
                max={100}
              />
            </div>
            <button
              onClick={processPlays}
              disabled={processing}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Pipeline Status */}
        <PipelineStatus plays={plays} />

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Play List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span>📋</span>
              Enriched Plays
              <span className="text-sm font-normal text-slate-400">({plays.length})</span>
            </h2>
            
            <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : plays.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p>No plays processed yet.</p>
                  <p className="text-sm mt-2">Click "Process Plays" to enrich data.</p>
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

          {/* Visualization & Details */}
          <div className="lg:col-span-2 space-y-6">
            {selectedPlay ? (
              <>
                {/* Field Visualization */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <span>🏟️</span>
                    Field Position
                  </h3>
                  <FieldVisualization play={selectedPlay} />
                </div>

                {/* Play Details */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <span>📊</span>
                    Play Details
                  </h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <StatBox label="Quarter" value={`Q${selectedPlay.quarter}`} />
                    <StatBox label="Clock" value={selectedPlay.game_clock} />
                    <StatBox label="Down" value={`${selectedPlay.down} & ${selectedPlay.yards_to_go}`} />
                    <StatBox label="Confidence" value={`${(selectedPlay.match_confidence * 100).toFixed(0)}%`} />
                  </div>

                  <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
                    <p className="text-sm text-slate-400 mb-1">Play Description</p>
                    <p className="text-white">{selectedPlay.play_description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900/50 rounded-lg p-4">
                      <p className="text-sm text-slate-400 mb-1">Home Team</p>
                      <p className="text-white font-medium">{selectedPlay.home_team}</p>
                      <p className="text-2xl font-bold text-blue-400">{selectedPlay.home_score}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                      <p className="text-sm text-slate-400 mb-1">Away Team</p>
                      <p className="text-white font-medium">{selectedPlay.away_team}</p>
                      <p className="text-2xl font-bold text-purple-400">{selectedPlay.away_score}</p>
                    </div>
                  </div>
                </div>

                {/* Tactical Analysis - Scene Description */}
                {selectedPlay.scene_description && (
                  <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <span>🎯</span>
                      Tactical Film Analysis
                    </h3>
                    
                    {/* Formation & Camera Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                      {selectedPlay.formation_offense && (
                        <div className="bg-blue-900/30 rounded-lg p-3 border border-blue-700/50">
                          <p className="text-xs text-blue-400 mb-1">Offensive Formation</p>
                          <p className="text-white font-medium">{selectedPlay.formation_offense}</p>
                        </div>
                      )}
                      {selectedPlay.formation_defense && (
                        <div className="bg-red-900/30 rounded-lg p-3 border border-red-700/50">
                          <p className="text-xs text-red-400 mb-1">Defensive Alignment</p>
                          <p className="text-white font-medium">{selectedPlay.formation_defense}</p>
                        </div>
                      )}
                      {selectedPlay.camera_angle && (
                        <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-700/50">
                          <p className="text-xs text-purple-400 mb-1">Film Angle</p>
                          <p className="text-white font-medium text-sm">{selectedPlay.camera_angle.split(',')[0]}</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Scene Description - Coaching Film Style */}
                    <div className="bg-slate-900/50 rounded-lg p-4 border-l-4 border-green-500">
                      <p className="text-xs text-green-400 mb-2 font-medium">ALL-22 COACHING FILM DESCRIPTION</p>
                      <p className="text-slate-300 leading-relaxed whitespace-pre-line">
                        {selectedPlay.scene_description}
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center">
                <p className="text-slate-400">Select a play to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-3 text-center">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  );
}
