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

  // Check if we should process comments
  const timeSinceLastProcess = Date.now() - state.lastCommentProcessTime;
  const shouldProcessByCount = state.comments.length >= COMMENT_BATCH_SIZE;
  const shouldProcessByTime = timeSinceLastProcess >= COMMENT_BATCH_INTERVAL_MS && state.comments.length > 0;

  if (shouldProcessByCount || shouldProcessByTime) {
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
