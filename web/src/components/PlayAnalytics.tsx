'use client';

interface Play {
  play_id: number;
  play_type: string;
  down: number;
  yards_to_go: number;
  absolute_yardline: number;
  scoring_play: boolean;
  match_confidence: number;
  quarter: number;
}

interface PlayAnalyticsProps {
  plays: Play[];
}

export default function PlayAnalytics({ plays }: PlayAnalyticsProps) {
  if (plays.length === 0) {
    return null;
  }

  // Calculate analytics
  const totalPlays = plays.length;
  
  // Play type distribution
  const playTypeCount: Record<string, number> = {};
  plays.forEach(play => {
    const type = play.play_type || 'Unknown';
    playTypeCount[type] = (playTypeCount[type] || 0) + 1;
  });
  
  // Pass vs Rush breakdown
  const passPlays = plays.filter(p => 
    p.play_type?.toLowerCase().includes('pass') || 
    p.play_type?.toLowerCase().includes('reception') ||
    p.play_type?.toLowerCase().includes('incompletion') ||
    p.play_type?.toLowerCase().includes('interception') ||
    p.play_type?.toLowerCase().includes('sack')
  ).length;
  const rushPlays = plays.filter(p => 
    p.play_type?.toLowerCase().includes('rush') ||
    p.play_type?.toLowerCase().includes('run')
  ).length;
  const otherPlays = totalPlays - passPlays - rushPlays;
  
  // Success rate by down
  const downStats: Record<number, { total: number; success: number }> = {};
  plays.forEach(play => {
    if (play.down >= 1 && play.down <= 4) {
      if (!downStats[play.down]) {
        downStats[play.down] = { total: 0, success: 0 };
      }
      downStats[play.down].total++;
      // Consider a play successful if it's not a sack, interception, or fumble
      const isSuccess = !play.play_type?.toLowerCase().includes('sack') &&
                       !play.play_type?.toLowerCase().includes('interception') &&
                       !play.play_type?.toLowerCase().includes('fumble') &&
                       !play.play_type?.toLowerCase().includes('incompletion');
      if (isSuccess) {
        downStats[play.down].success++;
      }
    }
  });
  
  // Scoring plays
  const scoringPlays = plays.filter(p => p.scoring_play).length;
  
  // Red zone plays (inside 20-yard line)
  const redZonePlays = plays.filter(p => {
    const yardline = p.absolute_yardline;
    return yardline >= 90 || yardline <= 30; // Simplified red zone check
  }).length;
  
  // 3rd down conversion (simplified - just count 3rd down plays)
  const thirdDownPlays = plays.filter(p => p.down === 3).length;
  const thirdDownSuccess = plays.filter(p => 
    p.down === 3 && 
    !p.play_type?.toLowerCase().includes('incompletion') &&
    !p.play_type?.toLowerCase().includes('sack')
  ).length;
  const thirdDownRate = thirdDownPlays > 0 ? (thirdDownSuccess / thirdDownPlays) * 100 : 0;

  // Average confidence
  const avgConfidence = plays.reduce((sum, p) => sum + (p.match_confidence || 0), 0) / totalPlays * 100;

  return (
    <div className="space-y-6">
      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Pass Plays"
          value={`${((passPlays / totalPlays) * 100).toFixed(0)}%`}
          subtext={`${passPlays} of ${totalPlays}`}
          color="blue"
        />
        <StatCard
          label="Rush Plays"
          value={`${((rushPlays / totalPlays) * 100).toFixed(0)}%`}
          subtext={`${rushPlays} of ${totalPlays}`}
          color="green"
        />
        <StatCard
          label="3rd Down Rate"
          value={`${thirdDownRate.toFixed(0)}%`}
          subtext={`${thirdDownSuccess}/${thirdDownPlays} conversions`}
          color="yellow"
        />
        <StatCard
          label="Scoring Plays"
          value={scoringPlays.toString()}
          subtext={`${((scoringPlays / totalPlays) * 100).toFixed(1)}% of plays`}
          color="purple"
        />
      </div>

      {/* Play Type Distribution */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-lg">📊</span>
          Play Type Distribution
        </h3>
        <div className="space-y-3">
          <PlayTypeBar label="Pass" count={passPlays} total={totalPlays} color="bg-blue-500" />
          <PlayTypeBar label="Rush" count={rushPlays} total={totalPlays} color="bg-green-500" />
          {otherPlays > 0 && (
            <PlayTypeBar label="Other" count={otherPlays} total={totalPlays} color="bg-slate-500" />
          )}
        </div>
      </div>

      {/* Success Rate by Down */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-lg">📈</span>
          Success Rate by Down
        </h3>
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(down => {
            const stats = downStats[down] || { total: 0, success: 0 };
            const rate = stats.total > 0 ? (stats.success / stats.total) * 100 : 0;
            return (
              <DownCard
                key={down}
                down={down}
                rate={rate}
                total={stats.total}
              />
            );
          })}
        </div>
      </div>

      {/* Detailed Play Types */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-lg">🏈</span>
          Play Type Breakdown
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(playTypeCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([type, count]) => (
              <div key={type} className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-slate-400 truncate">{type}</p>
                <p className="text-lg font-bold text-white">{count}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  subtext, 
  color 
}: { 
  label: string; 
  value: string; 
  subtext: string; 
  color: 'blue' | 'green' | 'yellow' | 'purple';
}) {
  const colorClasses = {
    blue: 'from-blue-600/20 to-blue-600/5 border-blue-500/30',
    green: 'from-green-600/20 to-green-600/5 border-green-500/30',
    yellow: 'from-yellow-600/20 to-yellow-600/5 border-yellow-500/30',
    purple: 'from-purple-600/20 to-purple-600/5 border-purple-500/30',
  };
  
  const textColors = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    purple: 'text-purple-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl border p-4`}>
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${textColors[color]}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{subtext}</p>
    </div>
  );
}

function PlayTypeBar({ 
  label, 
  count, 
  total, 
  color 
}: { 
  label: string; 
  count: number; 
  total: number; 
  color: string;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-400 w-12">{label}</span>
      <div className="flex-1 h-6 bg-slate-900/50 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm text-white font-medium w-16 text-right">
        {percentage.toFixed(0)}% ({count})
      </span>
    </div>
  );
}

function DownCard({ 
  down, 
  rate, 
  total 
}: { 
  down: number; 
  rate: number; 
  total: number;
}) {
  const getColor = (rate: number) => {
    if (rate >= 60) return 'text-green-400';
    if (rate >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const ordinal = ['1st', '2nd', '3rd', '4th'][down - 1];

  return (
    <div className="bg-slate-900/50 rounded-lg p-3 text-center">
      <p className="text-xs text-slate-400 mb-1">{ordinal} Down</p>
      <p className={`text-xl font-bold ${getColor(rate)}`}>
        {total > 0 ? `${rate.toFixed(0)}%` : 'N/A'}
      </p>
      <p className="text-xs text-slate-500">{total} plays</p>
    </div>
  );
}
