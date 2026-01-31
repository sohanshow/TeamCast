'use client';

interface Play {
  play_id: number;
  play_type: string;
  down: number;
  yards_to_go: number;
  absolute_yardline: number;
  quarter: number;
  game_clock: string;
  scoring_play: boolean;
}

interface TendencyChartProps {
  plays: Play[];
}

export default function TendencyChart({ plays }: TendencyChartProps) {
  if (plays.length === 0) {
    return null;
  }

  // Calculate tendencies by situation
  const situationTendencies = calculateSituationTendencies(plays);
  const quarterTendencies = calculateQuarterTendencies(plays);
  const distanceTendencies = calculateDistanceTendencies(plays);

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
      <h3 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
        <span className="text-lg">🎯</span>
        Play Calling Tendencies
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* By Situation */}
        <div>
          <h4 className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wider">
            By Situation
          </h4>
          <div className="space-y-2">
            {situationTendencies.map(({ situation, passRate, total }) => (
              <TendencyRow
                key={situation}
                label={situation}
                passRate={passRate}
                total={total}
              />
            ))}
          </div>
        </div>

        {/* By Quarter */}
        <div>
          <h4 className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wider">
            By Quarter
          </h4>
          <div className="space-y-2">
            {quarterTendencies.map(({ quarter, passRate, total }) => (
              <TendencyRow
                key={quarter}
                label={`Q${quarter}`}
                passRate={passRate}
                total={total}
              />
            ))}
          </div>
        </div>

        {/* By Distance */}
        <div>
          <h4 className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wider">
            By Distance to Go
          </h4>
          <div className="space-y-2">
            {distanceTendencies.map(({ distance, passRate, total }) => (
              <TendencyRow
                key={distance}
                label={distance}
                passRate={passRate}
                total={total}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="mt-6 pt-4 border-t border-slate-700">
        <h4 className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wider">
          Key Insights
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <InsightCard
            icon="📊"
            title="Overall Pass Rate"
            value={calculateOverallPassRate(plays)}
          />
          <InsightCard
            icon="🎯"
            title="Red Zone Tendency"
            value={calculateRedZoneTendency(plays)}
          />
        </div>
      </div>
    </div>
  );
}

function TendencyRow({ 
  label, 
  passRate, 
  total 
}: { 
  label: string; 
  passRate: number; 
  total: number;
}) {
  const rushRate = 100 - passRate;
  
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-300">{label}</span>
        <span className="text-xs text-slate-500">{total} plays</span>
      </div>
      <div className="flex h-5 rounded-md overflow-hidden bg-slate-900/50">
        <div 
          className="bg-blue-500/80 flex items-center justify-center transition-all duration-300 group-hover:bg-blue-500"
          style={{ width: `${passRate}%` }}
        >
          {passRate > 15 && (
            <span className="text-[10px] text-white font-medium">
              {passRate.toFixed(0)}% Pass
            </span>
          )}
        </div>
        <div 
          className="bg-green-500/80 flex items-center justify-center transition-all duration-300 group-hover:bg-green-500"
          style={{ width: `${rushRate}%` }}
        >
          {rushRate > 15 && (
            <span className="text-[10px] text-white font-medium">
              {rushRate.toFixed(0)}% Rush
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function InsightCard({ 
  icon, 
  title, 
  value 
}: { 
  icon: string; 
  title: string; 
  value: string;
}) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-3 flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <div>
        <p className="text-xs text-slate-400">{title}</p>
        <p className="text-sm text-white font-medium">{value}</p>
      </div>
    </div>
  );
}

// Helper functions
function isPassPlay(playType: string): boolean {
  const type = playType?.toLowerCase() || '';
  return type.includes('pass') || 
         type.includes('reception') || 
         type.includes('incompletion') ||
         type.includes('interception') ||
         type.includes('sack');
}

function calculateSituationTendencies(plays: Play[]) {
  const situations: { situation: string; filter: (p: Play) => boolean }[] = [
    { situation: '1st Down', filter: p => p.down === 1 },
    { situation: '2nd & Short', filter: p => p.down === 2 && p.yards_to_go <= 3 },
    { situation: '2nd & Long', filter: p => p.down === 2 && p.yards_to_go > 6 },
    { situation: '3rd & Short', filter: p => p.down === 3 && p.yards_to_go <= 3 },
    { situation: '3rd & Long', filter: p => p.down === 3 && p.yards_to_go > 6 },
  ];

  return situations.map(({ situation, filter }) => {
    const filtered = plays.filter(filter);
    const passPlays = filtered.filter(p => isPassPlay(p.play_type)).length;
    const total = filtered.length;
    const passRate = total > 0 ? (passPlays / total) * 100 : 50;
    return { situation, passRate, total };
  }).filter(s => s.total > 0);
}

function calculateQuarterTendencies(plays: Play[]) {
  const quarters = [1, 2, 3, 4];
  return quarters.map(quarter => {
    const filtered = plays.filter(p => p.quarter === quarter);
    const passPlays = filtered.filter(p => isPassPlay(p.play_type)).length;
    const total = filtered.length;
    const passRate = total > 0 ? (passPlays / total) * 100 : 50;
    return { quarter, passRate, total };
  }).filter(q => q.total > 0);
}

function calculateDistanceTendencies(plays: Play[]) {
  const distances: { distance: string; filter: (p: Play) => boolean }[] = [
    { distance: 'Short (1-3)', filter: p => p.yards_to_go >= 1 && p.yards_to_go <= 3 },
    { distance: 'Medium (4-6)', filter: p => p.yards_to_go >= 4 && p.yards_to_go <= 6 },
    { distance: 'Long (7-10)', filter: p => p.yards_to_go >= 7 && p.yards_to_go <= 10 },
    { distance: 'Very Long (11+)', filter: p => p.yards_to_go > 10 },
  ];

  return distances.map(({ distance, filter }) => {
    const filtered = plays.filter(filter);
    const passPlays = filtered.filter(p => isPassPlay(p.play_type)).length;
    const total = filtered.length;
    const passRate = total > 0 ? (passPlays / total) * 100 : 50;
    return { distance, passRate, total };
  }).filter(d => d.total > 0);
}

function calculateOverallPassRate(plays: Play[]): string {
  const passPlays = plays.filter(p => isPassPlay(p.play_type)).length;
  const rushPlays = plays.filter(p => {
    const type = p.play_type?.toLowerCase() || '';
    return type.includes('rush') || type.includes('run');
  }).length;
  const total = passPlays + rushPlays;
  
  if (total === 0) return 'N/A';
  
  const passRate = (passPlays / total) * 100;
  const rushRate = (rushPlays / total) * 100;
  
  return `${passRate.toFixed(0)}% Pass / ${rushRate.toFixed(0)}% Rush`;
}

function calculateRedZoneTendency(plays: Play[]): string {
  const redZonePlays = plays.filter(p => {
    const yardline = p.absolute_yardline;
    return yardline >= 90 || yardline <= 30;
  });
  
  if (redZonePlays.length === 0) return 'No red zone data';
  
  const passPlays = redZonePlays.filter(p => isPassPlay(p.play_type)).length;
  const passRate = (passPlays / redZonePlays.length) * 100;
  
  return `${passRate.toFixed(0)}% Pass in Red Zone (${redZonePlays.length} plays)`;
}
