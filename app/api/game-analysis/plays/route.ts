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
  scene_description?: string;
  camera_angle?: string;
  formation_offense?: string;
  formation_defense?: string;
}

function parseCSV(csvContent: string): { headers: string[], rows: string[][] } {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < csvContent.length; i++) {
    const char = csvContent[i];
    const nextChar = csvContent[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
      if (currentRow.length > 0 && currentRow.some(f => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      if (char === '\r') i++; // Skip \n in \r\n
    } else if (char !== '\r') {
      currentField += char;
    }
  }
  
  // Handle last field/row
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some(f => f.length > 0)) {
      rows.push(currentRow);
    }
  }
  
  const headers = rows[0] || [];
  const dataRows = rows.slice(1);
  
  return { headers, rows: dataRows };
}

export async function GET() {
  try {
    // Path to the enriched CSV file in playgenerate folder
    const csvPath = path.join(process.cwd(), 'playgenerate', 'output', 'enriched', 'enriched_2023_w01.csv');
    
    // Check if file exists
    try {
      await fs.access(csvPath);
    } catch {
      return NextResponse.json({ 
        plays: [],
        message: 'No enriched data found. Run the pipeline first.' 
      });
    }

    // Read and parse CSV (handles multi-line quoted fields)
    const csvContent = await fs.readFile(csvPath, 'utf-8');
    const { headers, rows } = parseCSV(csvContent);
    
    if (rows.length === 0) {
      return NextResponse.json({ plays: [], message: 'CSV file is empty' });
    }

    const plays: EnrichedPlay[] = [];

    for (const values of rows) {
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
