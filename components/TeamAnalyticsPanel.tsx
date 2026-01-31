'use client';

import { useState, useEffect } from 'react';

interface PlayInfo {
  play_id: string;
  quarter: number;
  game_clock: string;
  down: number;
  yards_to_go: number;
  play_description: string;
  play_type: string;
  scoring_play: boolean;
  home_score: number;
  away_score: number;
  yard_line: number;
  match_confidence: number;
}

interface GameInfo {
  espn_id: string;
  date: string;
  home_team: string;
  away_team: string;
  stadium: string;
  home_score: number;
  away_score: number;
}

interface TeamAnalyticsPanelProps {
  team: 'seahawks' | 'patriots';
  isOpen: boolean;
  onClose: () => void;
}

export default function TeamAnalyticsPanel({ team, isOpen, onClose }: TeamAnalyticsPanelProps) {
  const [plays, setPlays] = useState<PlayInfo[]>([]);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [latestGame, setLatestGame] = useState<GameInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');

  useEffect(() => {
    if (isOpen && plays.length === 0) {
      fetchAnalytics();
    }
  }, [isOpen, team]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/team-analytics?team=${team}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch');
      }
      
      setPlays(data.plays || []);
      setGames(data.games || []);
      setLatestGame(data.latestGame || null);
      setTeamName(data.team || team);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  // Calculate analytics from plays
  const analytics = calculateAnalytics(plays);

  const teamColors = team === 'seahawks' 
    ? { primary: 'from-green-600 to-blue-600', text: 'text-green-400', border: 'border-green-500/30' }
    : { primary: 'from-red-600 to-blue-800', text: 'text-red-400', border: 'border-red-500/30' };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div 
        className={`fixed right-0 top-0 h-full w-full max-w-lg bg-surface border-l border-border z-50 
                    transform transition-transform duration-300 ease-out overflow-y-auto
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className={`sticky top-0 bg-gradient-to-r ${teamColors.primary} p-6 z-10`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-display font-bold text-white">
                {team === 'seahawks' ? '🦅' : '🏈'} {teamName || 'Team'} Analytics
              </h2>
              <p className="text-white/70 text-sm mt-1">Historical play data & tendencies</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            >
              <span className="text-xl">✕</span>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-steel-700 border-t-accent rounded-full animate-spin" />
              <p className="mt-4 text-steel-400">Loading team data...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-accent-rose/10 border border-accent-rose/30 rounded-xl p-4">
              <p className="text-accent-rose">{error}</p>
              <button 
                onClick={fetchAnalytics}
                className="mt-3 px-4 py-2 bg-accent-rose/20 text-accent-rose rounded-lg text-sm hover:bg-accent-rose/30"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Latest Game Info */}
          {!loading && latestGame && (
            <div className="bg-surface-overlay border border-border rounded-xl p-4">
              <p className="text-xs text-steel-500 uppercase tracking-wider mb-2">Latest Game</p>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">{latestGame.away_team}</span>
                <span className="text-steel-400 text-sm">@</span>
                <span className="font-semibold text-white">{latestGame.home_team}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-2xl font-bold text-accent">{latestGame.away_score}</span>
                <span className="text-steel-600">-</span>
                <span className="text-2xl font-bold text-accent">{latestGame.home_score}</span>
              </div>
              <p className="text-xs text-steel-500 mt-2">{latestGame.stadium}</p>
            </div>
          )}

          {/* Analytics Stats */}
          {!loading && plays.length > 0 && (
            <>
              {/* Play Distribution */}
              <div className="space-y-4">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <span>📊</span> Play Distribution
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard 
                    label="Pass Plays" 
                    value={`${analytics.passPercent}%`}
                    subtext={`${analytics.passPlays} plays`}
                    color="blue"
                  />
                  <StatCard 
                    label="Rush Plays" 
                    value={`${analytics.rushPercent}%`}
                    subtext={`${analytics.rushPlays} plays`}
                    color="green"
                  />
                  <StatCard 
                    label="3rd Down Rate" 
                    value={`${analytics.thirdDownRate}%`}
                    subtext={`${analytics.thirdDownSuccess}/${analytics.thirdDownTotal}`}
                    color="yellow"
                  />
                  <StatCard 
                    label="Scoring Plays" 
                    value={analytics.scoringPlays.toString()}
                    subtext={`${((analytics.scoringPlays / plays.length) * 100).toFixed(1)}%`}
                    color="purple"
                  />
                </div>
              </div>

              {/* Play Type Breakdown */}
              <div className="space-y-3">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <span>🏈</span> Play Types
                </h3>
                <div className="bg-surface-overlay border border-border rounded-xl p-4 space-y-2">
                  {analytics.playTypes.slice(0, 5).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm text-steel-300 truncate flex-1">{type}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-steel-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-accent rounded-full"
                            style={{ width: `${(count / plays.length) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-steel-500 w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Games */}
              {games.length > 1 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <span>📅</span> Recent Games
                  </h3>
                  <div className="space-y-2">
                    {games.map((game) => (
                      <div 
                        key={game.espn_id} 
                        className="bg-surface-overlay border border-border rounded-lg p-3 flex items-center justify-between"
                      >
                        <div className="text-sm">
                          <span className="text-steel-400">{game.away_team}</span>
                          <span className="text-steel-600 mx-2">@</span>
                          <span className="text-steel-400">{game.home_team}</span>
                        </div>
                        <div className="text-sm font-semibold text-white">
                          {game.away_score} - {game.home_score}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total Plays Footer */}
              <div className="text-center pt-4 border-t border-border">
                <p className="text-sm text-steel-500">
                  Analyzing <span className="text-accent font-semibold">{plays.length}</span> plays from latest game
                </p>
              </div>
            </>
          )}

          {/* Empty State */}
          {!loading && !error && plays.length === 0 && (
            <div className="text-center py-12">
              <span className="text-4xl">📭</span>
              <p className="mt-4 text-steel-400">No play data available</p>
              <button 
                onClick={fetchAnalytics}
                className="mt-4 btn-secondary text-sm"
              >
                Refresh Data
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, subtext, color }: { 
  label: string; 
  value: string; 
  subtext: string; 
  color: 'blue' | 'green' | 'yellow' | 'purple';
}) {
  const colorClasses = {
    blue: 'from-blue-600/20 to-blue-600/5 border-blue-500/30 text-blue-400',
    green: 'from-green-600/20 to-green-600/5 border-green-500/30 text-green-400',
    yellow: 'from-yellow-600/20 to-yellow-600/5 border-yellow-500/30 text-yellow-400',
    purple: 'from-purple-600/20 to-purple-600/5 border-purple-500/30 text-purple-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color].split(' ').slice(0, 3).join(' ')} border rounded-xl p-4`}>
      <p className="text-xs text-steel-400">{label}</p>
      <p className={`text-2xl font-bold ${colorClasses[color].split(' ').slice(-1)[0]}`}>{value}</p>
      <p className="text-xs text-steel-500 mt-1">{subtext}</p>
    </div>
  );
}

function calculateAnalytics(plays: PlayInfo[]) {
  if (plays.length === 0) {
    return {
      passPlays: 0,
      rushPlays: 0,
      passPercent: 0,
      rushPercent: 0,
      thirdDownRate: 0,
      thirdDownSuccess: 0,
      thirdDownTotal: 0,
      scoringPlays: 0,
      playTypes: [] as [string, number][],
    };
  }

  const passPlays = plays.filter(p => 
    p.play_type?.toLowerCase().includes('pass') || 
    p.play_type?.toLowerCase().includes('reception') ||
    p.play_type?.toLowerCase().includes('incompletion') ||
    p.play_type?.toLowerCase().includes('sack')
  ).length;
  
  const rushPlays = plays.filter(p => 
    p.play_type?.toLowerCase().includes('rush') ||
    p.play_type?.toLowerCase().includes('run')
  ).length;

  const thirdDownPlays = plays.filter(p => p.down === 3);
  const thirdDownSuccess = thirdDownPlays.filter(p => 
    !p.play_type?.toLowerCase().includes('incompletion') &&
    !p.play_type?.toLowerCase().includes('sack')
  ).length;

  const scoringPlays = plays.filter(p => p.scoring_play).length;

  const playTypeCount: Record<string, number> = {};
  plays.forEach(play => {
    const type = play.play_type || 'Unknown';
    playTypeCount[type] = (playTypeCount[type] || 0) + 1;
  });

  return {
    passPlays,
    rushPlays,
    passPercent: Math.round((passPlays / plays.length) * 100),
    rushPercent: Math.round((rushPlays / plays.length) * 100),
    thirdDownRate: thirdDownPlays.length > 0 
      ? Math.round((thirdDownSuccess / thirdDownPlays.length) * 100) 
      : 0,
    thirdDownSuccess,
    thirdDownTotal: thirdDownPlays.length,
    scoringPlays,
    playTypes: Object.entries(playTypeCount).sort((a, b) => b[1] - a[1]),
  };
}
