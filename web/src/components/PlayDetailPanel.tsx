'use client';

import { useState } from 'react';
import FieldVisualization from './FieldVisualization';
import VideoPlayer from './VideoPlayer';

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

interface PlayDetailPanelProps {
  play: EnrichedPlay;
}

export default function PlayDetailPanel({ play }: PlayDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'field' | 'video' | 'analysis'>('field');

  return (
    <div className="space-y-4">
      {/* Play Header */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPlayTypeColor(play.play_type)}`}>
                {play.play_type}
              </span>
              {play.scoring_play && (
                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">
                  SCORING
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-white">
              Play #{play.play_id}
            </h3>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">Q{play.quarter} - {play.game_clock}</p>
            <p className="text-lg font-bold text-white">
              {getDownString(play.down)} & {play.yards_to_go}
            </p>
          </div>
        </div>
        
        {/* Play Description */}
        <p className="text-slate-300 text-sm leading-relaxed bg-slate-900/50 rounded-lg p-3">
          {play.play_description}
        </p>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <QuickStat label="Yardline" value={formatYardline(play.absolute_yardline)} />
          <QuickStat label="Direction" value={play.play_direction === 'right' ? '→ Right' : '← Left'} />
          <QuickStat label="Confidence" value={`${(play.match_confidence * 100).toFixed(0)}%`} />
          <QuickStat label="Frames" value={play.num_frames.toString()} />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        <TabButton 
          active={activeTab === 'field'} 
          onClick={() => setActiveTab('field')}
          icon="🏟️"
          label="Field View"
        />
        <TabButton 
          active={activeTab === 'video'} 
          onClick={() => setActiveTab('video')}
          icon="🎬"
          label="AI Video"
        />
        <TabButton 
          active={activeTab === 'analysis'} 
          onClick={() => setActiveTab('analysis')}
          icon="🎯"
          label="Tactical Analysis"
        />
      </div>

      {/* Tab Content */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        {activeTab === 'field' && (
          <div className="p-5">
            <FieldVisualization play={play} />
            
            {/* Team Scores */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
                <p className="text-xs text-blue-400 mb-1">Home</p>
                <p className="text-white font-medium truncate">{play.home_team}</p>
                <p className="text-3xl font-bold text-blue-400">{play.home_score}</p>
              </div>
              <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-4">
                <p className="text-xs text-purple-400 mb-1">Away</p>
                <p className="text-white font-medium truncate">{play.away_team}</p>
                <p className="text-3xl font-bold text-purple-400">{play.away_score}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'video' && (
          <div className="p-5">
            <VideoPlayer 
              playId={play.play_id}
              gameId={play.game_id}
              sceneDescription={play.scene_description}
            />
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="p-5">
            {play.scene_description ? (
              <div className="space-y-4">
                {/* Formation Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {play.formation_offense && play.formation_offense !== 'Unknown' && (
                    <FormationCard 
                      type="Offense" 
                      formation={play.formation_offense} 
                      color="blue" 
                    />
                  )}
                  {play.formation_defense && play.formation_defense !== 'Unknown' && (
                    <FormationCard 
                      type="Defense" 
                      formation={play.formation_defense} 
                      color="red" 
                    />
                  )}
                  {play.camera_angle && (
                    <FormationCard 
                      type="Camera" 
                      formation={play.camera_angle.split(',')[0]} 
                      color="purple" 
                    />
                  )}
                </div>

                {/* Scene Description */}
                <div className="bg-slate-900/50 rounded-lg p-4 border-l-4 border-green-500">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-green-400 text-sm font-semibold uppercase tracking-wider">
                      Coaching Film Analysis
                    </span>
                  </div>
                  <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                    {formatSceneDescription(play.scene_description)}
                  </div>
                </div>

                {/* Key Points */}
                <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-4">
                  <h4 className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    Coaching Points
                  </h4>
                  <ul className="text-sm text-slate-300 space-y-1">
                    {extractCoachingPoints(play).map((point, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-yellow-400 mt-0.5">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <span className="text-4xl mb-4 block">🎯</span>
                <p className="text-slate-400 mb-2">No tactical analysis available</p>
                <p className="text-slate-500 text-sm">Process plays to generate scene descriptions</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-2 text-center">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function TabButton({ 
  active, 
  onClick, 
  icon, 
  label 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: string; 
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
        active 
          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' 
          : 'bg-slate-800/50 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
      }`}
    >
      <span>{icon}</span>
      <span className="text-sm">{label}</span>
    </button>
  );
}

function FormationCard({ 
  type, 
  formation, 
  color 
}: { 
  type: string; 
  formation: string; 
  color: 'blue' | 'red' | 'purple';
}) {
  const colors = {
    blue: 'bg-blue-900/30 border-blue-700/50 text-blue-400',
    red: 'bg-red-900/30 border-red-700/50 text-red-400',
    purple: 'bg-purple-900/30 border-purple-700/50 text-purple-400',
  };

  return (
    <div className={`rounded-lg p-3 border ${colors[color]}`}>
      <p className={`text-xs mb-1 ${color === 'blue' ? 'text-blue-400' : color === 'red' ? 'text-red-400' : 'text-purple-400'}`}>
        {type}
      </p>
      <p className="text-white font-medium text-sm">{formation}</p>
    </div>
  );
}

// Helper functions
function getPlayTypeColor(playType: string): string {
  const type = playType?.toLowerCase() || '';
  if (type.includes('touchdown')) return 'bg-yellow-500/20 text-yellow-400';
  if (type.includes('reception') || type.includes('complete')) return 'bg-green-500/20 text-green-400';
  if (type.includes('rush') || type.includes('run')) return 'bg-blue-500/20 text-blue-400';
  if (type.includes('incompletion')) return 'bg-red-500/20 text-red-400';
  if (type.includes('sack') || type.includes('interception')) return 'bg-red-600/20 text-red-400';
  return 'bg-slate-500/20 text-slate-400';
}

function getDownString(down: number): string {
  const ordinals = ['1st', '2nd', '3rd', '4th'];
  return ordinals[down - 1] || `${down}th`;
}

function formatYardline(yardline: number): string {
  if (yardline <= 50) return `Own ${yardline}`;
  return `Opp ${100 - yardline}`;
}

function formatSceneDescription(description: string): string {
  // Clean up the description for display
  return description
    .replace(/\[SCENE START\]/g, '')
    .replace(/\[SCENE END\]/g, '')
    .replace(/\*\*/g, '')
    .trim();
}

function extractCoachingPoints(play: EnrichedPlay): string[] {
  const points: string[] = [];
  
  // Down and distance context
  if (play.down === 3 && play.yards_to_go > 7) {
    points.push('Long third down - expect aggressive passing');
  } else if (play.down === 3 && play.yards_to_go <= 3) {
    points.push('Short third down - potential run/pass balance');
  }
  
  // Play result analysis
  if (play.play_type?.toLowerCase().includes('incompletion')) {
    points.push('Incomplete pass - analyze coverage and protection');
  } else if (play.play_type?.toLowerCase().includes('reception')) {
    points.push('Completed pass - review route execution');
  } else if (play.play_type?.toLowerCase().includes('rush')) {
    points.push('Rush play - evaluate blocking scheme');
  }
  
  // Scoring context
  if (play.scoring_play) {
    points.push('Scoring play - identify key execution factors');
  }
  
  // Field position
  if (play.absolute_yardline >= 80 || play.absolute_yardline <= 20) {
    points.push('Red zone play - high-pressure situation');
  }
  
  if (points.length === 0) {
    points.push('Review player assignments and execution');
  }
  
  return points;
}
