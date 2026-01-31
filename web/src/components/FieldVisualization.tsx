'use client';

interface Play {
  absolute_yardline: number;
  play_direction: string;
  ball_land_x: number;
  ball_land_y: number;
  down: number;
  yards_to_go: number;
}

interface FieldVisualizationProps {
  play: Play;
}

export default function FieldVisualization({ play }: FieldVisualizationProps) {
  // Convert absolute yardline (0-120) to field position (0-100)
  const fieldPosition = Math.max(0, Math.min(100, play.absolute_yardline - 10));
  
  // Calculate first down marker position
  const firstDownPosition = play.play_direction === 'right' 
    ? Math.min(100, fieldPosition + play.yards_to_go)
    : Math.max(0, fieldPosition - play.yards_to_go);
  
  // Ball landing position (approximate)
  const ballLandPosition = Math.max(0, Math.min(100, play.ball_land_x - 10));

  return (
    <div className="relative">
      {/* Field Container */}
      <div className="relative h-32 bg-gradient-to-r from-green-800 via-green-700 to-green-800 rounded-lg overflow-hidden border border-green-600">
        {/* End Zones */}
        <div className="absolute left-0 top-0 bottom-0 w-[10%] bg-blue-800/50 border-r-2 border-white/30 flex items-center justify-center">
          <span className="text-white/50 text-xs font-bold rotate-90">END ZONE</span>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-[10%] bg-red-800/50 border-l-2 border-white/30 flex items-center justify-center">
          <span className="text-white/50 text-xs font-bold -rotate-90">END ZONE</span>
        </div>
        
        {/* Yard Lines */}
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((yard) => (
          <div
            key={yard}
            className="absolute top-0 bottom-0 w-px bg-white/20"
            style={{ left: `${yard}%` }}
          >
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-slate-400">
              {yard <= 50 ? yard : 100 - yard}
            </span>
          </div>
        ))}
        
        {/* 50 Yard Line */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-white/40 left-1/2" />
        
        {/* Hash Marks */}
        {Array.from({ length: 99 }, (_, i) => i + 1).map((yard) => (
          <div key={yard}>
            <div 
              className="absolute h-1 w-px bg-white/10"
              style={{ left: `${yard}%`, top: '30%' }}
            />
            <div 
              className="absolute h-1 w-px bg-white/10"
              style={{ left: `${yard}%`, top: '70%' }}
            />
          </div>
        ))}
        
        {/* First Down Marker */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-yellow-400/80 transition-all duration-300"
          style={{ left: `${firstDownPosition}%` }}
        >
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-yellow-400 text-black text-xs font-bold rounded">
            1ST
          </div>
        </div>
        
        {/* Line of Scrimmage */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-blue-400 transition-all duration-300"
          style={{ left: `${fieldPosition}%` }}
        >
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-blue-400 text-black text-xs font-bold rounded">
            LOS
          </div>
        </div>
        
        {/* Ball Position */}
        <div
          className="absolute w-4 h-4 bg-amber-700 rounded-full border-2 border-amber-500 shadow-lg transition-all duration-300 z-10"
          style={{ 
            left: `calc(${fieldPosition}% - 8px)`,
            top: '50%',
            transform: 'translateY(-50%)'
          }}
        >
          <div className="absolute inset-0.5 border border-white/30 rounded-full" />
        </div>
        
        {/* Ball Landing Indicator (if pass) */}
        {play.ball_land_x > 0 && (
          <div
            className="absolute w-3 h-3 bg-orange-500/50 rounded-full border border-orange-400 transition-all duration-300"
            style={{ 
              left: `calc(${ballLandPosition}% - 6px)`,
              top: '40%',
            }}
          >
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-orange-300 whitespace-nowrap">
              Ball
            </div>
          </div>
        )}
        
        {/* Direction Arrow */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 flex items-center text-white/50"
          style={{ 
            left: play.play_direction === 'right' ? `calc(${fieldPosition}% + 20px)` : `calc(${fieldPosition}% - 40px)` 
          }}
        >
          {play.play_direction === 'right' ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-blue-400 rounded" />
          <span>Line of Scrimmage</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-yellow-400 rounded" />
          <span>First Down</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-amber-700 border border-amber-500 rounded-full" />
          <span>Ball</span>
        </div>
      </div>
    </div>
  );
}
