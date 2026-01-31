'use client';

interface Play {
  match_confidence: number;
  play_type: string;
}

interface PipelineStatusProps {
  plays: Play[];
}

export default function PipelineStatus({ plays }: PipelineStatusProps) {
  const avgConfidence = plays.length > 0 
    ? plays.reduce((acc, p) => acc + p.match_confidence, 0) / plays.length 
    : 0;
  
  const playTypes = plays.reduce((acc, p) => {
    acc[p.play_type] = (acc[p.play_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topPlayTypes = Object.entries(playTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Total Plays */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <span className="text-xl">📊</span>
          </div>
          <div>
            <p className="text-sm text-slate-400">Total Plays</p>
            <p className="text-2xl font-bold text-white">{plays.length}</p>
          </div>
        </div>
      </div>

      {/* Match Confidence */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
            <span className="text-xl">✓</span>
          </div>
          <div>
            <p className="text-sm text-slate-400">Avg Confidence</p>
            <p className="text-2xl font-bold text-white">
              {plays.length > 0 ? `${(avgConfidence * 100).toFixed(0)}%` : '--'}
            </p>
          </div>
        </div>
      </div>

      {/* ESPN Enriched */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <span className="text-xl">🔗</span>
          </div>
          <div>
            <p className="text-sm text-slate-400">ESPN Enriched</p>
            <p className="text-2xl font-bold text-white">
              {plays.filter(p => p.match_confidence > 0).length}
            </p>
          </div>
        </div>
      </div>

      {/* Play Types */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
            <span className="text-xl">🏈</span>
          </div>
          <div>
            <p className="text-sm text-slate-400">Play Types</p>
            <p className="text-2xl font-bold text-white">{Object.keys(playTypes).length}</p>
          </div>
        </div>
      </div>

      {/* Play Type Breakdown */}
      {plays.length > 0 && (
        <div className="col-span-2 md:col-span-4 bg-slate-800/50 rounded-xl border border-slate-700 p-4">
          <p className="text-sm text-slate-400 mb-3">Play Type Distribution</p>
          <div className="flex flex-wrap gap-2">
            {topPlayTypes.map(([type, count]) => (
              <div 
                key={type}
                className="px-3 py-1.5 bg-slate-900/50 rounded-lg flex items-center gap-2"
              >
                <span className="text-sm text-white font-medium">{type}</span>
                <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
