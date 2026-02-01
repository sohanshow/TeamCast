'use client';

import { useState, useEffect, useCallback } from 'react';

interface Room {
  roomId: string;
  name: string;
  basePrompt: string;
  isActive: boolean;
  createdAt: number;
  livekitActive?: boolean;
  participants?: number;
}

export default function AdminPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // New room form
  const [newRoomId, setNewRoomId] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newBasePrompt, setNewBasePrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Edit mode
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  
  // Kill all state
  const [isKilling, setIsKilling] = useState(false);
  const [killResult, setKillResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/rooms');
      if (!res.ok) throw new Error('Failed to fetch rooms');
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomId.trim()) return;

    setIsCreating(true);
    try {
      const res = await fetch('/api/admin/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: newRoomId.trim().toLowerCase().replace(/\s+/g, '-'),
          name: newRoomName.trim() || newRoomId.trim(),
          basePrompt: newBasePrompt.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create room');
      }

      setNewRoomId('');
      setNewRoomName('');
      setNewBasePrompt('');
      fetchRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const deleteRoom = async (roomId: string) => {
    if (!confirm(`Are you sure you want to delete room "${roomId}"?`)) return;

    try {
      const res = await fetch(`/api/admin/rooms?roomId=${encodeURIComponent(roomId)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete room');
      }

      fetchRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete room');
    }
  };

  const updateRoom = async (roomId: string, basePrompt: string) => {
    try {
      const room = rooms.find(r => r.roomId === roomId);
      const res = await fetch('/api/admin/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          name: room?.name,
          basePrompt,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update room');
      }

      setEditingRoom(null);
      fetchRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update room');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const killEverything = async () => {
    const confirmMessage = 
      '⚠️ DANGER ZONE ⚠️\n\n' +
      'This will:\n' +
      '• Delete ALL rooms from Firestore\n' +
      '• Delete ALL comments from Firestore\n' +
      '• Delete ALL participants from Firestore\n' +
      '• Kill ALL active LiveKit rooms\n\n' +
      'Type "KILL" to confirm:';
    
    const userInput = prompt(confirmMessage);
    if (userInput !== 'KILL') {
      return;
    }

    setIsKilling(true);
    setKillResult(null);
    
    try {
      const res = await fetch('/api/admin/reset-firestore', {
        method: 'DELETE',
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to kill everything');
      }
      
      setKillResult({
        success: true,
        message: `💥 Nuked! Firestore: ${JSON.stringify(data.deleted.firestore)}, LiveKit rooms: ${data.deleted.livekitRooms}`,
      });
      
      // Refresh the rooms list
      fetchRooms();
    } catch (err) {
      setKillResult({
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsKilling(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚙️</span>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-rose-500 bg-clip-text text-transparent">
            TEAMCAST ADMIN
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={killEverything}
            disabled={isKilling}
            className="px-4 py-2 text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-rose-500/20 hover:shadow-rose-500/40"
          >
            {isKilling ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Killing...
              </>
            ) : (
              <>
                💀 KILL ALL
              </>
            )}
          </button>
          <a 
            href="/" 
            className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
          >
            ← Back to App
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400">
            {error}
            <button onClick={() => setError(null)} className="ml-4 underline">Dismiss</button>
          </div>
        )}

        {killResult && (
          <div className={`mb-6 p-4 rounded-lg border ${
            killResult.success 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            {killResult.message}
            <button onClick={() => setKillResult(null)} className="ml-4 underline">Dismiss</button>
          </div>
        )}

        {/* Create Room Form */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="text-orange-400">+</span> Create New Room
          </h2>
          <form onSubmit={createRoom} className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Room ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={newRoomId}
                  onChange={(e) => setNewRoomId(e.target.value)}
                  placeholder="e.g., superbowl-2026"
                  className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
                  required
                />
                <p className="mt-1 text-xs text-gray-600">Lowercase, no spaces (use dashes)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g., Super Bowl 2026 Pre-Game"
                  className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Base Prompt (Topic Context)
              </label>
              <textarea
                value={newBasePrompt}
                onChange={(e) => setNewBasePrompt(e.target.value)}
                placeholder="This is a pre-game analysis show for Super Bowl 2026 between the Kansas City Chiefs and the Philadelphia Eagles. Focus on key matchups, player stats, injury reports, and predictions..."
                rows={4}
                className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors resize-none"
              />
              <p className="mt-1 text-xs text-gray-600">
                This prompt guides the AI to stay on topic. Be specific about the event, teams, or subjects to discuss.
              </p>
            </div>
            <button
              type="submit"
              disabled={isCreating || !newRoomId.trim()}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isCreating ? 'Creating...' : 'Create Room'}
            </button>
          </form>
        </section>

        {/* Rooms List */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span className="text-orange-400">📋</span> Active Rooms
            </h2>
            <button
              onClick={fetchRooms}
              className="px-3 py-1 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
            >
              ↻ Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-12 bg-white/5 border border-white/10 rounded-xl">
              <span className="text-4xl mb-4 block">🎙️</span>
              <p className="text-gray-400">No rooms created yet</p>
              <p className="text-sm text-gray-600 mt-1">Create your first room above to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rooms.map((room) => (
                <div
                  key={room.roomId}
                  className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-white/20 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold">{room.name}</h3>
                        {room.livekitActive && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-full">
                            ● Live
                          </span>
                        )}
                        {room.participants !== undefined && room.participants > 0 && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 rounded-full">
                            {room.participants} listening
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 font-mono">{room.roomId}</p>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`/host/${room.roomId}`}
                        target="_blank"
                        className="px-3 py-1.5 text-sm bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg transition-colors font-semibold"
                      >
                        🎙️ Broadcast
                      </a>
                      <a
                        href={`/room/${room.roomId}`}
                        target="_blank"
                        className="px-3 py-1.5 text-sm bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 rounded-lg transition-colors"
                      >
                        Preview →
                      </a>
                      <button
                        onClick={() => deleteRoom(room.roomId)}
                        className="px-3 py-1.5 text-sm bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-400">Base Prompt</label>
                      {editingRoom === room.roomId ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateRoom(room.roomId, editPrompt)}
                            className="text-xs text-emerald-400 hover:underline"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingRoom(null)}
                            className="text-xs text-gray-500 hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingRoom(room.roomId);
                            setEditPrompt(room.basePrompt);
                          }}
                          className="text-xs text-orange-400 hover:underline"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    {editingRoom === room.roomId ? (
                      <textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500 transition-colors resize-none"
                      />
                    ) : (
                      <p className="text-sm text-gray-300 bg-black/30 rounded-lg p-3">
                        {room.basePrompt || <span className="text-gray-600 italic">No base prompt set</span>}
                      </p>
                    )}
                  </div>

                  <div className="text-xs text-gray-600">
                    Created: {formatDate(room.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
