import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

interface EnrichedPlay {
  game_id: string;
  play_id: number;
  absolute_yardline: number;
  play_direction: string;
  ball_land_x: number;
  ball_land_y: number;
  num_frames: number;
  quarter: number;
  game_clock: string;
  down: number;
  yards_to_go: number;
  play_description: string;
  play_type: string;
  scoring_play: boolean;
  home_team: string;
  away_team: string;
  stadium: string;
  home_score: number;
  away_score: number;
  match_confidence: number;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
}

export async function GET() {
  try {
    // Path to the enriched CSV file
    const csvPath = path.join(process.cwd(), '..', 'playgenerate', 'output', 'enriched', 'enriched_2023_w01.csv');
    
    // Check if file exists
    try {
      await fs.access(csvPath);
    } catch {
      return NextResponse.json({ 
        plays: [],
        message: 'No enriched data found. Run the pipeline first.' 
      });
    }

    // Read and parse CSV
    const csvContent = await fs.readFile(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');
    
    if (lines.length < 2) {
      return NextResponse.json({ plays: [], message: 'CSV file is empty' });
    }

    const headers = parseCSVLine(lines[0]);
    const plays: EnrichedPlay[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const play: Record<string, string | number | boolean> = {};
      
      headers.forEach((header, index) => {
        const value = values[index] || '';
        
        // Type conversion based on field name
        if (['play_id', 'absolute_yardline', 'num_frames', 'quarter', 'down', 'yards_to_go', 'home_score', 'away_score'].includes(header)) {
          play[header] = parseInt(value) || 0;
        } else if (['ball_land_x', 'ball_land_y', 'match_confidence'].includes(header)) {
          play[header] = parseFloat(value) || 0;
        } else if (header === 'scoring_play') {
          play[header] = value.toLowerCase() === 'true';
        } else {
          play[header] = value;
        }
      });
      
      plays.push(play as unknown as EnrichedPlay);
    }

    return NextResponse.json({ 
      plays,
      count: plays.length,
      source: 'enriched_2023_w01.csv'
    });

  } catch (error) {
    console.error('Error reading plays:', error);
    return NextResponse.json(
      { error: 'Failed to read plays', details: String(error) },
      { status: 500 }
    );
  }
}
