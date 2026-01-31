import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// WAV conversion utilities
interface WavOptions {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
}

function parseMimeType(mimeType: string): WavOptions {
  const [fileType, ...params] = mimeType.split(';').map(s => s.trim());
  const format = fileType.split('/')[1];

  const options: Partial<WavOptions> = { numChannels: 1 };

  if (format?.startsWith('L')) {
    const bits = parseInt(format.slice(1), 10);
    if (!isNaN(bits)) options.bitsPerSample = bits;
  }

  for (const param of params) {
    const [key, value] = param.split('=').map(s => s.trim());
    if (key === 'rate') options.sampleRate = parseInt(value, 10);
  }

  return options as WavOptions;
}

function createWavHeader(dataLength: number, opts: WavOptions): Uint8Array {
  const { numChannels, sampleRate, bitsPerSample } = opts;
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
  const opts = parseMimeType(mimeType);
  const dataBuffer = Buffer.from(rawData, 'base64');
  const wavHeader = createWavHeader(dataBuffer.length, opts);
  const result = new Uint8Array(wavHeader.length + dataBuffer.length);
  result.set(wavHeader, 0);
  result.set(new Uint8Array(dataBuffer), wavHeader.length);
  return result;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { text, voiceId, turnIndex } = body;

    if (!text || !voiceId) {
      return NextResponse.json({ error: 'text and voiceId required' }, { status: 400 });
    }

    console.log(`[TTS Single] Turn #${turnIndex ?? 'N/A'}, voice: ${voiceId}, length: ${text.length}`);

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
      contents: [{ role: 'user', parts: [{ text }] }],
    });

    // Extract audio
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidates = (response as any).candidates;
    let audioBase64 = '';
    let mimeType = 'audio/wav';

    if (candidates?.[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData) {
          const chunkMimeType = part.inlineData.mimeType || '';
          
          if (!chunkMimeType.includes('wav') && !chunkMimeType.includes('mp3')) {
            const wavData = convertToWav(part.inlineData.data || '', chunkMimeType);
            audioBase64 = Buffer.from(wavData).toString('base64');
            mimeType = 'audio/wav';
          } else {
            audioBase64 = part.inlineData.data;
            mimeType = chunkMimeType;
          }
          break;
        }
      }
    }

    if (!audioBase64) {
      console.error(`[TTS Single] No audio for turn ${turnIndex}`);
      return NextResponse.json({ error: 'No audio generated' }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    console.log(`[TTS Single] Turn #${turnIndex ?? 'N/A'} complete in ${duration}ms`);

    return NextResponse.json({ audioBase64, mimeType, turnIndex });
  } catch (error) {
    console.error('[TTS Single] Error:', error);
    
    // Check if it's a rate limit error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRateLimit = errorMessage.includes('429') || 
                        errorMessage.includes('quota') || 
                        errorMessage.includes('rate') ||
                        errorMessage.includes('RESOURCE_EXHAUSTED');
    
    if (isRateLimit) {
      console.error('[TTS Single] Rate limit detected!');
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before trying again.', rateLimited: true },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: 'TTS failed', details: errorMessage },
      { status: 500 }
    );
  }
}
