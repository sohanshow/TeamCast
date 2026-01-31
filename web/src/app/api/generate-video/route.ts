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
    const videoPath = path.join(process.cwd(), '..', 'playgenerate', 'output', 'videos', videoFilename);
    const publicVideoPath = path.join(process.cwd(), 'public', 'videos', videoFilename);
    
    try {
      await fs.access(videoPath);
      // Video exists, copy to public folder if not already there
      try {
        await fs.access(publicVideoPath);
      } catch {
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

    // Build the Python command to generate video
    const playgenDir = path.join(process.cwd(), '..', 'playgenerate');
    
    // Create a simple Python script to generate just this one video
    const pythonScript = `
import sys
import os
sys.path.insert(0, '${playgenDir}/src')
os.chdir('${playgenDir}')

from dotenv import load_dotenv
load_dotenv('${path.join(process.cwd(), '..', '.env')}')

from generation.video_gen import VideoGenerator

generator = VideoGenerator(output_dir='${path.join(playgenDir, 'output', 'videos')}')

scene = """${sceneDescription || `Football stadium, packed with cheering fans. The quarterback takes the snap from shotgun formation, 
drops back scanning the field. He spots his receiver and throws a pass. The ball spirals through the air 
toward the sideline. The crowd watches in anticipation as the play unfolds.`}"""

result = generator.generate_video(
    scene_description=scene,
    play_id=${playId},
    game_id="${gameId}",
    style_hints=["broadcast camera", "dramatic", "slow motion"]
)

if result.success:
    print(f"SUCCESS:{result.video_path}")
else:
    print(f"ERROR:{result.error_message}")
`;

    const venvActivate = `source ${path.join(playgenDir, 'venv', 'bin', 'activate')}`;
    const pythonCmd = `python3 -c '${pythonScript.replace(/'/g, "'\"'\"'")}'`;
    const fullCmd = `cd ${playgenDir} && ${venvActivate} && ${pythonCmd}`;

    console.log('Starting video generation for play', playId);

    // Execute with timeout (2 minutes)
    const { stdout, stderr } = await execAsync(fullCmd, {
      timeout: 180000,
      maxBuffer: 10 * 1024 * 1024,
    });

    console.log('Video generation stdout:', stdout);
    if (stderr) console.log('Video generation stderr:', stderr);

    // Check if successful
    if (stdout.includes('SUCCESS:')) {
      const generatedPath = stdout.split('SUCCESS:')[1].trim();
      
      // Copy to public folder
      try {
        await fs.mkdir(path.join(process.cwd(), 'public', 'videos'), { recursive: true });
        await fs.copyFile(generatedPath, publicVideoPath);
      } catch (copyError) {
        console.error('Error copying video:', copyError);
      }

      return NextResponse.json({
        success: true,
        videoUrl: `/videos/${videoFilename}`,
        message: 'Video generated successfully',
        cached: false,
      });
    } else if (stdout.includes('ERROR:')) {
      const errorMsg = stdout.split('ERROR:')[1].trim();
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 500 }
      );
    } else {
      return NextResponse.json(
        { success: false, error: 'Unknown error', stdout },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Video generation error:', error);
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
