import {
  AudioTrack,
  Comment,
  CommentBatch,
  PodcastScript,
  COMMENT_BATCH_SIZE,
  COMMENT_BATCH_INTERVAL_MS,
  PRE_GENERATE_TURNS,
} from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Room Configuration - stores base prompts and settings for each room
 */
export interface RoomConfig {
  roomId: string;
  name: string;
  basePrompt: string;
  isActive: boolean;
  createdAt: number;
}

// In-memory room configurations (in production, use a database)
const roomConfigs = new Map<string, RoomConfig>();

/**
 * Create or update a room configuration
 */
export function upsertRoomConfig(config: Partial<RoomConfig> & { roomId: string }): RoomConfig {
  const existing = roomConfigs.get(config.roomId);
  const updated: RoomConfig = {
    roomId: config.roomId,
    name: config.name ?? existing?.name ?? config.roomId,
    basePrompt: config.basePrompt ?? existing?.basePrompt ?? '',
    isActive: config.isActive ?? existing?.isActive ?? true,
    createdAt: existing?.createdAt ?? Date.now(),
  };
  roomConfigs.set(config.roomId, updated);
  return updated;
}

/**
 * Get room configuration
 */
export function getRoomConfig(roomId: string): RoomConfig | null {
  return roomConfigs.get(roomId) || null;
}

/**
 * Get all room configurations
 */
export function getAllRoomConfigs(): RoomConfig[] {
  return Array.from(roomConfigs.values());
}

/**
 * Delete room configuration
 */
export function deleteRoomConfig(roomId: string): boolean {
  cleanupRoom(roomId); // Also cleanup runtime state
  return roomConfigs.delete(roomId);
}

/**
 * Podcast Engine State Management
 * This manages the state of the podcast for a room
 */
export interface PodcastEngineState {
  roomId: string;
  trackQueue: AudioTrack[];
  currentTrackIndex: number;
  comments: Comment[];
  lastCommentProcessTime: number;
  isGenerating: boolean;
  lastContext: string;
  pendingCommentBatch: CommentBatch | null; // Batch ready for AudioPlayer to pick up
}

// In-memory state store (in production, use Redis or similar)
const roomStates = new Map<string, PodcastEngineState>();

/**
 * Initialize or get room state
 */
export function getRoomState(roomId: string): PodcastEngineState {
  if (!roomStates.has(roomId)) {
    roomStates.set(roomId, {
      roomId,
      trackQueue: [],
      currentTrackIndex: 0,
      comments: [],
      lastCommentProcessTime: Date.now(),
      isGenerating: false,
      lastContext: '',
      pendingCommentBatch: null,
    });
  }
  return roomStates.get(roomId)!;
}

/**
 * Add a comment to the room
 */
export function addComment(roomId: string, comment: Comment): CommentBatch | null {
  const state = getRoomState(roomId);
  state.comments.push(comment);

  // Check if we should process comments (by count)
  const shouldProcessByCount = state.comments.length >= COMMENT_BATCH_SIZE;

  if (shouldProcessByCount && !state.pendingCommentBatch) {
    const batch: CommentBatch = {
      comments: [...state.comments],
      processedAt: Date.now(),
    };
    state.comments = [];
    state.lastCommentProcessTime = Date.now();
    state.pendingCommentBatch = batch; // Store for AudioPlayer to pick up
    return batch;
  }

  return null;
}

/**
 * Check if there's a pending comment batch ready for processing
 * This is called periodically to check time-based processing
 * Returns and clears the pending batch so it's only processed once
 */
export function checkPendingCommentBatch(roomId: string): CommentBatch | null {
  const state = getRoomState(roomId);
  
  // First, check if there's already a pending batch from count-based trigger
  if (state.pendingCommentBatch) {
    const batch = state.pendingCommentBatch;
    state.pendingCommentBatch = null;
    return batch;
  }
  
  // Then check for time-based processing
  if (state.comments.length === 0) {
    return null;
  }

  const timeSinceLastProcess = Date.now() - state.lastCommentProcessTime;
  const shouldProcessByTime = timeSinceLastProcess >= COMMENT_BATCH_INTERVAL_MS;

  if (shouldProcessByTime) {
    const batch: CommentBatch = {
      comments: [...state.comments],
      processedAt: Date.now(),
    };
    state.comments = [];
    state.lastCommentProcessTime = Date.now();
    return batch;
  }

  return null;
}

/**
 * Add a track to the queue
 */
export function addTrackToQueue(roomId: string, script: PodcastScript): AudioTrack {
  const state = getRoomState(roomId);
  const track: AudioTrack = {
    id: uuidv4(),
    script,
    audioData: null,
    status: 'pending',
  };
  state.trackQueue.push(track);
  return track;
}

/**
 * Update track status
 */
export function updateTrackStatus(
  roomId: string,
  trackId: string,
  status: AudioTrack['status'],
  audioData?: ArrayBuffer
): void {
  const state = getRoomState(roomId);
  const track = state.trackQueue.find((t) => t.id === trackId);
  if (track) {
    track.status = status;
    if (audioData) {
      track.audioData = audioData;
    }
  }
}

/**
 * Get the next track to play
 */
export function getNextTrack(roomId: string): AudioTrack | null {
  const state = getRoomState(roomId);
  const readyTracks = state.trackQueue.filter((t) => t.status === 'ready');
  return readyTracks[0] || null;
}

/**
 * Get pending tracks count
 */
export function getPendingTracksCount(roomId: string): number {
  const state = getRoomState(roomId);
  return state.trackQueue.filter((t) => 
    t.status === 'pending' || t.status === 'generating' || t.status === 'ready'
  ).length;
}

/**
 * Check if we need to generate more tracks
 */
export function needsMoreTracks(roomId: string): boolean {
  return getPendingTracksCount(roomId) < PRE_GENERATE_TURNS;
}

/**
 * Set generating flag
 */
export function setGenerating(roomId: string, isGenerating: boolean): void {
  const state = getRoomState(roomId);
  state.isGenerating = isGenerating;
}

/**
 * Check if already generating
 */
export function isGenerating(roomId: string): boolean {
  return getRoomState(roomId).isGenerating;
}

/**
 * Update last context for continuity
 */
export function updateContext(roomId: string, context: string): void {
  const state = getRoomState(roomId);
  state.lastContext = context;
}

/**
 * Get last context
 */
export function getLastContext(roomId: string): string {
  return getRoomState(roomId).lastContext;
}

/**
 * Get all tracks for a room
 */
export function getAllTracks(roomId: string): AudioTrack[] {
  return getRoomState(roomId).trackQueue;
}

/**
 * Clean up room state
 */
export function cleanupRoom(roomId: string): void {
  roomStates.delete(roomId);
}

/**
 * Get room statistics
 */
export function getRoomStats(roomId: string): {
  totalTracks: number;
  pendingTracks: number;
  completedTracks: number;
  pendingComments: number;
} {
  const state = getRoomState(roomId);
  return {
    totalTracks: state.trackQueue.length,
    pendingTracks: state.trackQueue.filter((t) => t.status === 'pending' || t.status === 'generating').length,
    completedTracks: state.trackQueue.filter((t) => t.status === 'completed').length,
    pendingComments: state.comments.length,
  };
}
