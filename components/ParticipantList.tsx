'use client';

import { useParticipants } from '@livekit/components-react';

export default function ParticipantList() {
  const participants = useParticipants();

  return (
    <div className="flex flex-col bg-surface-overlay border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-raised">
        <h3 className="font-display text-lg font-semibold">Listeners</h3>
        <span className="px-3 py-1 text-sm font-semibold bg-gradient-to-r from-accent to-accent-cyan text-white rounded-full">
          {participants.length}
        </span>
      </div>

      {/* List */}
      <div className="flex-1 p-3 space-y-2 max-h-72 overflow-y-auto">
        {participants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="text-2xl opacity-50 mb-2">👥</span>
            <p className="text-sm text-steel-500">No listeners yet</p>
          </div>
        ) : (
          participants.map((participant, index) => (
            <div
              key={participant.identity}
              className="flex items-center gap-3 p-3 bg-surface-raised rounded-lg animate-fade-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-center justify-center w-9 h-9 bg-surface-elevated rounded-full text-sm font-semibold text-accent">
                {participant.name?.charAt(0).toUpperCase() || '?'}
              </div>
              <span className="flex-1 text-sm font-medium truncate">
                {participant.name || 'Anonymous'}
              </span>
              {participant.identity === 'teamcast-host' && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 rounded tracking-wider">
                  HOST
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface-raised">
        <div className="flex items-center gap-2 text-xs font-bold text-accent-rose tracking-wider">
          <span className="w-2 h-2 bg-accent-rose rounded-full animate-pulse" />
          LIVE
        </div>
        <span className="text-xs text-steel-600">{participants.length} / 100</span>
      </div>
    </div>
  );
}
