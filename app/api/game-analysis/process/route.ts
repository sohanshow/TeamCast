import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { week = 1, maxPlays = 10 } = body;

    // Path to the pipeline in playgenerate folder
    const playgenDir = path.join(process.cwd(), 'playgenerate');
    const venvPath = path.join(playgenDir, 'venv', 'bin', 'activate');
    
    // Check if venv exists, if not use system Python
    let pythonCmd: string;
    try {
      const { promises: fs } = await import('fs');
      await fs.access(venvPath);
      pythonCmd = `source ${venvPath} && python3`;
    } catch {
      pythonCmd = 'python3';
    }
    
    // Use --scenes-only to generate tactical scene descriptions from existing enriched data
    const pipelineScript = path.join(playgenDir, 'src', 'pipeline.py');
    const fullCmd = `cd ${playgenDir} && ${pythonCmd} ${pipelineScript} --week ${week} --max-plays ${maxPlays} --scenes-only`;

    console.log('Running pipeline:', fullCmd);

    // Execute the pipeline
    const { stdout, stderr } = await execAsync(fullCmd, {
      timeout: 120000, // 2 minute timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    console.log('Pipeline stdout:', stdout);
    if (stderr) console.log('Pipeline stderr:', stderr);

    // Parse output to extract stats
    const linesProcessed = stdout.match(/Successfully enriched (\d+)/)?.[1] || '0';

    return NextResponse.json({
      success: true,
      message: 'Pipeline completed successfully',
      playsProcessed: parseInt(linesProcessed),
      stdout: stdout.slice(-2000), // Last 2000 chars of output
    });

  } catch (error) {
    console.error('Pipeline error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Pipeline failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
