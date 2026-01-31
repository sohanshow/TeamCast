'use client';

interface Play {
  game_id: string;
  play_id: number;
  quarter: number;
  game_clock: string;
  down: number;
  yards_to_go: number;
  play_description: string;
  play_type: string;
  scoring_play: boolean;
  match_confidence: number;
}

interface PlayCardProps {
  play: Play;
  isSelected: boolean;
  onClick: () => void;
}

const playTypeColors: Record<string, string> = {
  'Pass Reception': 'from-green-500 to-emerald-600',
  'Pass Incompletion': 'from-orange-500 to-amber-600',
  'Rush': 'from-blue-500 to-cyan-600',
  'Sack': 'from-red-500 to-rose-600',
  'Interception': 'from-purple-500 to-violet-600',
  'Touchdown': 'from-yellow-500 to-amber-500',
  'Field Goal': 'from-teal-500 to-cyan-600',
  'Punt': 'from-slate-500 to-gray-600',
};

export default function PlayCard({ play, isSelected, onClick }: PlayCardProps) {
  const gradientColor = playTypeColors[play.play_type] || 'from-slate-500 to-gray-600';
  
  return (
    <div
      onClick={onClick}
      className={`
        relative p-4 rounded-xl cursor-pointer transition-all duration-200
        ${isSelected 
          ? 'bg-slate-700/80 border-2 border-blue-500 shadow-lg shadow-blue-500/20' 
          : 'bg-slate-800/50 border border-slate-700 hover:bg-slate-700/50 hover:border-slate-600'
        }
      `}
    >
      {/* Play Type Badge */}
      <div className={`absolute -top-2 -right-2 px-2 py-0.5 text-xs font-medium rounded-full bg-gradient-to-r ${gradientColor} text-white shadow-lg`}>
        {play.play_type}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2 py-0.5 bg-slate-900 rounded text-slate-300">
            Q{play.quarter}
          </span>
          <span className="text-sm text-slate-400">{play.game_clock}</span>
        </div>
        <span className="text-xs text-slate-500">#{play.play_id}</span>
      </div>

      {/* Down & Distance */}
      <div className="text-lg font-bold text-white mb-2">
        {play.down}<sup className="text-xs">{getOrdinalSuffix(play.down)}</sup> & {play.yards_to_go}
      </div>

      {/* Description */}
      <p className="text-sm text-slate-300 line-clamp-2 mb-3">
        {play.play_description}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {play.scoring_play && (
          <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full">
            🏈 Scoring Play
          </span>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${
                play.match_confidence >= 0.8 ? 'bg-green-500' :
                play.match_confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${play.match_confidence * 100}%` }}
            />
          </div>
          <span className="text-xs text-slate-500">
            {(play.match_confidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
