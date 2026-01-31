import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playId, gameId, sceneDescription } = body;

    if (!playId || !gameId) {
      return NextResponse.json(
        { success: false, error: 'Missing playId or gameId' },
        { status: 400 }
      );
    }

    // Check if video already exists
    const videoFilename = `play_${gameId}_${playId}.mp4`;
    const playgenDir = path.join(process.cwd(), '..', 'playgenerate');
    const videoPath = path.join(playgenDir, 'output', 'videos', videoFilename);
    const publicVideoPath = path.join(process.cwd(), 'public', 'videos', videoFilename);
    
    try {
      await fs.access(videoPath);
      // Video exists, copy to public folder if not already there
      try {
        await fs.access(publicVideoPath);
      } catch {
        await fs.mkdir(path.join(process.cwd(), 'public', 'videos'), { recursive: true });
        await fs.copyFile(videoPath, publicVideoPath);
      }
      
      return NextResponse.json({
        success: true,
        videoUrl: `/videos/${videoFilename}`,
        message: 'Video already exists',
        cached: true,
      });
    } catch {
      // Video doesn't exist, generate it
    }

    // Escape the scene description for Python
    const escapedScene = (sceneDescription || getDefaultScene())
      .replace(/\\/g, '\\\\')
      .replace(/"""/g, '\\"\\"\\"')
      .replace(/\n/g, '\\n');

    // Create Python script to generate video using Veo 3.1
    const pythonScript = `
import sys
import os

# Setup paths
playgen_dir = '${playgenDir.replace(/\\/g, '/')}'
sys.path.insert(0, os.path.join(playgen_dir, 'src'))
os.chdir(playgen_dir)

# Load environment variables
from dotenv import load_dotenv
env_path = os.path.join(playgen_dir, '..', '.env')
load_dotenv(env_path)

# Import and run video generator
from generation.video_gen import VideoGenerator

generator = VideoGenerator(
    output_dir=os.path.join(playgen_dir, 'output', 'videos')
)

# Check generator status
status = generator.get_status()
print(f"Generator status: {status}")

if not status['client_initialized']:
    print("ERROR:Veo client not initialized. Check GOOGLE_API_KEY.")
    sys.exit(1)

scene = """${escapedScene}"""

print(f"Generating video for play ${playId}...")
result = generator.generate_video(
    scene_description=scene,
    play_id=${playId},
    game_id="${gameId}",
    style_hints=["professional broadcast", "tactical coaching film", "clear player visibility"]
)

if result.success:
    print(f"SUCCESS:{result.video_path}")
else:
    print(f"ERROR:{result.error_message}")
`;

    // Write script to temp file to avoid shell escaping issues
    const scriptPath = path.join(playgenDir, 'temp_video_gen.py');
    await fs.writeFile(scriptPath, pythonScript);

    const venvActivate = `source ${path.join(playgenDir, 'venv', 'bin', 'activate')}`;
    const pythonCmd = `python3 ${scriptPath}`;
    const fullCmd = `cd ${playgenDir} && ${venvActivate} && ${pythonCmd}`;

    console.log('Starting Veo 3.1 video generation for play', playId);
    console.log('Scene description length:', sceneDescription?.length || 0);

    // Execute with longer timeout for Veo (5 minutes)
    // Veo 3.1 fast model typically takes 1-3 minutes
    const { stdout, stderr } = await execAsync(fullCmd, {
      timeout: 300000, // 5 minute timeout
      maxBuffer: 10 * 1024 * 1024,
    });

    // Clean up temp script
    try {
      await fs.unlink(scriptPath);
    } catch {
      // Ignore cleanup errors
    }

    console.log('Video generation stdout:', stdout);
    if (stderr) console.log('Video generation stderr:', stderr);

    // Check if successful
    if (stdout.includes('SUCCESS:')) {
      const generatedPath = stdout.split('SUCCESS:')[1].trim().split('\n')[0];
      
      // Copy to public folder
      try {
        await fs.mkdir(path.join(process.cwd(), 'public', 'videos'), { recursive: true });
        await fs.copyFile(generatedPath, publicVideoPath);
        console.log('Video copied to public folder:', publicVideoPath);
      } catch (copyError) {
        console.error('Error copying video:', copyError);
      }

      return NextResponse.json({
        success: true,
        videoUrl: `/videos/${videoFilename}`,
        message: 'Video generated successfully with Veo 3.1',
        cached: false,
        generationTime: extractGenerationTime(stdout),
      });
    } else if (stdout.includes('ERROR:')) {
      const errorMsg = stdout.split('ERROR:')[1].trim().split('\n')[0];
      console.error('Video generation failed:', errorMsg);
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 500 }
      );
    } else {
      return NextResponse.json(
        { success: false, error: 'Unknown error during video generation', details: stdout.slice(-500) },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Video generation error:', error);
    
    // Check for timeout
    if (error instanceof Error && error.message.includes('TIMEOUT')) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Video generation timed out. Veo may be experiencing high demand. Please try again.',
        },
        { status: 504 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check if video exists
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const playId = searchParams.get('playId');
  const gameId = searchParams.get('gameId');

  if (!playId || !gameId) {
    return NextResponse.json({ exists: false });
  }

  const videoFilename = `play_${gameId}_${playId}.mp4`;
  const videoPath = path.join(process.cwd(), 'public', 'videos', videoFilename);

  try {
    await fs.access(videoPath);
    return NextResponse.json({ 
      exists: true, 
      videoUrl: `/videos/${videoFilename}` 
    });
  } catch {
    // Check in playgenerate output folder
    const outputPath = path.join(process.cwd(), '..', 'playgenerate', 'output', 'videos', videoFilename);
    try {
      await fs.access(outputPath);
      // Copy to public
      await fs.mkdir(path.join(process.cwd(), 'public', 'videos'), { recursive: true });
      await fs.copyFile(outputPath, videoPath);
      return NextResponse.json({ 
        exists: true, 
        videoUrl: `/videos/${videoFilename}` 
      });
    } catch {
      return NextResponse.json({ exists: false });
    }
  }
}

// Helper functions
function getDefaultScene(): string {
  return `Bird's eye view looking straight down at a football field from above. 
The camera is fixed 50 yards above midfield showing the entire field with yard lines and hash marks visible.
All 22 players are clearly visible - 11 on offense lined up in formation, 11 on defense in their alignment.
At the snap, the play develops: offensive linemen engage blockers, receivers run routes across the field,
the quarterback drops back and delivers the ball. Defenders react and pursue.
Clean overhead tactical view like Madden NFL video game or coaching software.
Static camera, no movement, full field visible at all times.`;
}

function extractGenerationTime(stdout: string): string | undefined {
  const match = stdout.match(/(\d+\.?\d*)\s*s\)/);
  if (match) {
    return `${parseFloat(match[1]).toFixed(1)}s`;
  }
  return undefined;
}
