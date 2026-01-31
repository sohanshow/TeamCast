// Podcast-related types
export interface PodcastTurn {
  speaker: 'Speaker1' | 'Speaker2';
  speakerName: string;
  text: string;
  voiceId: string;
}

export interface PodcastScript {
  turns: PodcastTurn[];
  type: 'base' | 'comment-analysis';
  generatedAt: number;
}

export interface AudioTrack {
  id: string;
  script: PodcastScript;
  audioData: ArrayBuffer | null;
  status: 'pending' | 'generating' | 'ready' | 'playing' | 'completed';
  duration?: number;
}

// Comment-related types
export interface Comment {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}

export interface CommentBatch {
  comments: Comment[];
  summary?: string;
  processedAt?: number;
}

// Room-related types
export interface RoomState {
  roomId: string;
  participantCount: number;
  isLive: boolean;
  currentTrackId?: string;
}

// API Response types
export interface TokenResponse {
  token: string;
  roomName: string;
}

export interface GenerateScriptResponse {
  script: PodcastScript;
}

export interface TTSResponse {
  audioBase64: string;
  mimeType: string;
}

export interface CommentSummaryResponse {
  summary: string;
  addressedUsernames: string[];
}

// Speaker configuration
export const SPEAKERS = {
  Speaker1: {
    name: 'Marcus',
    voiceId: 'Kore', // Gemini TTS voice
    role: 'Lead Analyst',
  },
  Speaker2: {
    name: 'Jordan',
    voiceId: 'Puck', // Gemini TTS voice
    role: 'Color Commentator',
  },
} as const;

// Constants
export const COMMENT_BATCH_SIZE = 50;
export const COMMENT_BATCH_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
export const PRE_GENERATE_TURNS = 3;
