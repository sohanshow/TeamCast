import { GoogleGenAI } from '@google/genai';
import { PodcastScript, PodcastTurn, SPEAKERS, Comment } from './types';

// Initialize the Gemini AI client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Debug: Log if API key is present (not the actual key)
if (!process.env.GEMINI_API_KEY) {
  console.error('⚠️ GEMINI_API_KEY is not set in environment variables!');
} else {
  console.log('✓ GEMINI_API_KEY is set (length:', process.env.GEMINI_API_KEY.length, ')');
}

/**
 * Make a request to Gemini API using the SDK
 */
async function callGemini(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
  });

  const text = response.text;
  
  if (!text) {
    console.error('Unexpected Gemini response:', JSON.stringify(response, null, 2));
    throw new Error('No text in Gemini response');
  }

  return text;
}

/**
 * Generate a podcast script with alternating speakers
 */
export async function generatePodcastScript(
  turns: number = 3,
  context?: string,
  isCommentAnalysis: boolean = false,
  comments?: Comment[],
  basePrompt?: string
): Promise<PodcastScript> {
  let prompt: string;
  
  // Build the base context from room's base prompt
  const baseContext = basePrompt 
    ? `\n\nROOM CONTEXT (stay on this topic):\n${basePrompt}\n`
    : '';

  if (isCommentAnalysis && comments && comments.length > 0) {
    const commentsList = comments
      .map((c) => `@${c.username}: "${c.text}"`)
      .join('\n');

    prompt = `You are writing a podcast script for a live analysis show called "TeamCast". 
Two hosts are discussing the topic and addressing audience comments.
${baseContext}
Host 1: ${SPEAKERS.Speaker1.name} (${SPEAKERS.Speaker1.role}) - Analytical, data-driven, strategic insights
Host 2: ${SPEAKERS.Speaker2.name} (${SPEAKERS.Speaker2.role}) - Energetic, fan-focused, emotional takes

AUDIENCE COMMENTS TO ADDRESS:
${commentsList}

Generate exactly ${turns} conversational exchanges between the hosts addressing these comments.
Make it engaging, mention usernames when responding to their comments, and keep the analysis flowing naturally.
Each exchange should feel natural and conversational.

IMPORTANT: Return ONLY a valid JSON array with this structure (no markdown, no explanation, just the JSON):
[
  {"speaker": "Speaker1", "text": "..."},
  {"speaker": "Speaker2", "text": "..."}
]

Make it sound natural, engaging, and like a real sports podcast. Address the users by name when responding to their comments.`;
  } else {
    prompt = `You are writing a podcast script for a live analysis show called "TeamCast".
Two hosts are providing analysis, predictions, and engaging discussion.
${baseContext}
Host 1: ${SPEAKERS.Speaker1.name} (${SPEAKERS.Speaker1.role}) - Analytical, data-driven, discusses matchups, stats, and strategic insights
Host 2: ${SPEAKERS.Speaker2.name} (${SPEAKERS.Speaker2.role}) - Energetic, fan-focused, brings emotional takes and fan perspectives

${context ? `Previous context: ${context}\n\nContinue the discussion from where we left off.` : 'Start with an exciting intro to the show.'}

Generate exactly ${turns} conversational exchanges (${turns * 2} total speaker turns) between the hosts.
Each exchange should flow naturally and cover different aspects of the topic.

IMPORTANT: Return ONLY a valid JSON array with this structure (no markdown, no explanation, just the JSON):
[
  {"speaker": "Speaker1", "text": "..."},
  {"speaker": "Speaker2", "text": "..."}
]

Make it sound natural, engaging, and like a real podcast.`;
  }

  try {
    const text = await callGemini(prompt);

    // Clean up the response - remove markdown code blocks if present
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.slice(7);
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.slice(3);
    }
    if (cleanedText.endsWith('```')) {
      cleanedText = cleanedText.slice(0, -3);
    }
    cleanedText = cleanedText.trim();

    let rawTurns: Array<{ speaker: string; text: string }>;
    try {
      rawTurns = JSON.parse(cleanedText);
    } catch (e) {
      console.error('Failed to parse script response:', cleanedText);
      throw new Error('Failed to parse podcast script');
    }

    // Validate and map the turns with safety checks
    const podcastTurns: PodcastTurn[] = rawTurns.map((turn, index) => {
      // Normalize speaker key
      let speakerKey = turn.speaker as 'Speaker1' | 'Speaker2';
      
      // Handle variations in speaker naming
      if (turn.speaker.toLowerCase().includes('1') || turn.speaker.toLowerCase().includes('alex')) {
        speakerKey = 'Speaker1';
      } else if (turn.speaker.toLowerCase().includes('2') || turn.speaker.toLowerCase().includes('jordan')) {
        speakerKey = 'Speaker2';
      } else {
        // Alternate if can't determine
        speakerKey = index % 2 === 0 ? 'Speaker1' : 'Speaker2';
      }
      
      const speaker = SPEAKERS[speakerKey];
      
      if (!speaker) {
        console.error('Unknown speaker:', turn.speaker, 'using fallback');
        return {
          speaker: 'Speaker1',
          speakerName: SPEAKERS.Speaker1.name,
          text: turn.text || '',
          voiceId: SPEAKERS.Speaker1.voiceId,
        };
      }
      
      return {
        speaker: speakerKey,
        speakerName: speaker.name,
        text: turn.text || '',
        voiceId: speaker.voiceId,
      };
    });

    return {
      turns: podcastTurns,
      type: isCommentAnalysis ? 'comment-analysis' : 'base',
      generatedAt: Date.now(),
    };
  } catch (error) {
    console.error('Gemini script generation error:', error);
    throw error;
  }
}

/**
 * Summarize a batch of comments
 */
export async function summarizeComments(comments: Comment[]): Promise<string> {
  const commentsList = comments
    .map((c) => `@${c.username}: "${c.text}"`)
    .join('\n');

  const prompt = `Summarize the following audience comments from a Super Bowl pre-game podcast.
Identify the main themes, questions, and sentiments. Keep usernames for the most interesting comments.

Comments:
${commentsList}

Provide a brief summary (2-3 sentences) highlighting the key points the hosts should address.`;

  try {
    return await callGemini(prompt);
  } catch (error) {
    console.error('Gemini summarization error:', error);
    return 'Audience is engaged with the discussion.';
  }
}

// WAV conversion utilities
interface WavConversionOptions {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
}

function parseMimeType(mimeType: string): WavConversionOptions {
  const [fileType, ...params] = mimeType.split(';').map(s => s.trim());
  const format = fileType.split('/')[1];

  const options: Partial<WavConversionOptions> = {
    numChannels: 1,
  };

  if (format && format.startsWith('L')) {
    const bits = parseInt(format.slice(1), 10);
    if (!isNaN(bits)) {
      options.bitsPerSample = bits;
    }
  }

  for (const param of params) {
    const [key, value] = param.split('=').map(s => s.trim());
    if (key === 'rate') {
      options.sampleRate = parseInt(value, 10);
    }
  }

  return options as WavConversionOptions;
}

function createWavHeader(dataLength: number, options: WavConversionOptions): Uint8Array {
  const { numChannels, sampleRate, bitsPerSample } = options;

  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const buffer = Buffer.alloc(44);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);

  return new Uint8Array(buffer);
}

function convertToWav(rawData: string, mimeType: string): Uint8Array {
  const options = parseMimeType(mimeType);
  const dataBuffer = Buffer.from(rawData, 'base64');
  const wavHeader = createWavHeader(dataBuffer.length, options);
  
  // Combine header and data
  const result = new Uint8Array(wavHeader.length + dataBuffer.length);
  result.set(wavHeader, 0);
  result.set(new Uint8Array(dataBuffer), wavHeader.length);
  return result;
}

/**
 * Generate TTS audio from text using Gemini TTS SDK
 */
export async function generateTTS(
  text: string,
  voiceId: string
): Promise<{ audioBase64: string; mimeType: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: any = {
    responseModalities: ['audio'],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: voiceId,
        },
      },
    },
  };

  const response = await ai.models.generateContentStream({
    model: 'gemini-2.5-flash-preview-tts',
    config,
    contents: [
      {
        role: 'user',
        parts: [{ text: `Read aloud in a natural, engaging podcast host tone:\n${text}` }],
      },
    ],
  });

  // Collect audio chunks from stream
  const audioChunks: Uint8Array[] = [];
  let mimeType = 'audio/wav';

  for await (const chunk of response) {
    if (!chunk.candidates || !chunk.candidates[0]?.content?.parts) {
      continue;
    }

    const inlineData = chunk.candidates[0].content.parts[0]?.inlineData;
    if (inlineData) {
      const chunkMimeType = inlineData.mimeType || '';
      let data: Uint8Array;
      
      // Convert to WAV if needed
      if (!chunkMimeType.includes('wav') && !chunkMimeType.includes('mp3')) {
        data = convertToWav(inlineData.data || '', chunkMimeType);
        mimeType = 'audio/wav';
      } else {
        data = new Uint8Array(Buffer.from(inlineData.data || '', 'base64'));
        mimeType = chunkMimeType || 'audio/wav';
      }
      
      audioChunks.push(data);
    }
  }

  if (audioChunks.length === 0) {
    throw new Error('No audio data received from TTS');
  }

  // Combine all chunks
  const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of audioChunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return {
    audioBase64: Buffer.from(combined).toString('base64'),
    mimeType,
  };
}

/**
 * Generate TTS for a single turn
 */
async function generateTurnAudio(
  text: string,
  voiceId: string,
  turnIndex: number
): Promise<{ turnIndex: number; audioBase64: string; mimeType: string }> {
  console.log(`[TTS] Generating audio for turn ${turnIndex}, voice: ${voiceId}, text length: ${text.length}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: any = {
    responseModalities: ['audio'],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: voiceId,
        },
      },
    },
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    config,
    contents: [
      {
        role: 'user',
        parts: [{ text }],
      },
    ],
  });

  // Extract audio from response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates = (response as any).candidates;
  let mimeType = 'audio/wav';
  let audioData: Uint8Array | null = null;

  if (candidates && candidates[0]?.content?.parts) {
    for (const part of candidates[0].content.parts) {
      if (part.inlineData) {
        const chunkMimeType = part.inlineData.mimeType || '';
        
        if (!chunkMimeType.includes('wav') && !chunkMimeType.includes('mp3')) {
          audioData = convertToWav(part.inlineData.data || '', chunkMimeType);
          mimeType = 'audio/wav';
        } else {
          audioData = new Uint8Array(Buffer.from(part.inlineData.data || '', 'base64'));
          mimeType = chunkMimeType || 'audio/wav';
        }
        break; // Take first audio part
      }
    }
  }

  if (!audioData) {
    throw new Error(`No audio data for turn ${turnIndex}`);
  }

  console.log(`[TTS] Turn ${turnIndex} complete, audio size: ${audioData.length} bytes`);

  return {
    turnIndex,
    audioBase64: Buffer.from(audioData).toString('base64'),
    mimeType,
  };
}

/**
 * Generate TTS for entire script - one turn at a time for faster response
 */
export async function generateScriptAudio(
  script: PodcastScript
): Promise<Array<{ turnIndex: number; audioBase64: string; mimeType: string }>> {
  console.log('[TTS] Generating audio for', script.turns.length, 'turns...');

  const results: Array<{ turnIndex: number; audioBase64: string; mimeType: string }> = [];

  // Generate each turn sequentially
  for (let i = 0; i < script.turns.length; i++) {
    const turn = script.turns[i];
    try {
      const audio = await generateTurnAudio(turn.text, turn.voiceId, i);
      results.push(audio);
    } catch (error) {
      console.error(`[TTS] Failed to generate turn ${i}:`, error);
      throw error;
    }
  }

  console.log('[TTS] All turns complete, total:', results.length);
  return results;
}

