import { NextRequest, NextResponse } from 'next/server';

// Team abbreviations for ESPN API
const TEAM_MAP: Record<string, { abbrev: string; fullName: string; espnId: string }> = {
  seahawks: { abbrev: 'SEA', fullName: 'Seattle Seahawks', espnId: '26' },
  patriots: { abbrev: 'NE', fullName: 'New England Patriots', espnId: '17' },
};

interface PlayInfo {
  play_id: string;
  quarter: number;
  game_clock: string;
  down: number;
  yards_to_go: number;
  play_description: string;
  play_type: string;
  scoring_play: boolean;
  home_score: number;
  away_score: number;
  yard_line: number;
  match_confidence: number;
}

interface GameInfo {
  espn_id: string;
  date: string;
  home_team: string;
  away_team: string;
  stadium: string;
  home_score: number;
  away_score: number;
}

// ESPN API base URL
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

async function fetchESPN(url: string): Promise<unknown> {
  const response = await fetch(url, { 
    next: { revalidate: 3600 } // Cache for 1 hour
  });
  if (!response.ok) {
    throw new Error(`ESPN API error: ${response.status}`);
  }
  return response.json();
}

async function getTeamSchedule(teamId: string, season: number = 2024): Promise<GameInfo[]> {
  const url = `${ESPN_BASE}/teams/${teamId}/schedule?season=${season}`;
  const data = await fetchESPN(url) as { events?: unknown[] };
  
  const games: GameInfo[] = [];
  const events = data.events || [];
  
  for (const event of events as Array<{
    id: string;
    date: string;
    competitions?: Array<{
      competitors?: Array<{ homeAway: string; team: { displayName: string }; score?: string }>;
      venue?: { fullName: string };
      status?: { type: { completed: boolean } };
    }>;
  }>) {
    try {
      const competition = event.competitions?.[0];
      if (!competition?.status?.type?.completed) continue;
      
      const competitors = competition.competitors || [];
      const home = competitors.find((c: { homeAway: string }) => c.homeAway === 'home');
      const away = competitors.find((c: { homeAway: string }) => c.homeAway === 'away');
      
      games.push({
        espn_id: event.id,
        date: event.date,
        home_team: home?.team?.displayName || '',
        away_team: away?.team?.displayName || '',
        stadium: competition.venue?.fullName || '',
        home_score: parseInt(home?.score || '0'),
        away_score: parseInt(away?.score || '0'),
      });
    } catch {
      continue;
    }
  }
  
  return games.slice(0, 5); // Last 5 completed games
}

async function getGamePlays(gameId: string): Promise<PlayInfo[]> {
  const url = `${ESPN_BASE}/summary?event=${gameId}`;
  const data = await fetchESPN(url) as {
    drives?: {
      previous?: Array<{
        plays?: Array<{
          id: string;
          period?: { number: number };
          clock?: { displayValue: string };
          start?: { down: number; distance: number; yardLine: number };
          text?: string;
          type?: { text: string };
          scoringPlay?: boolean;
          homeScore?: number;
          awayScore?: number;
        }>;
      }>;
    };
  };
  
  const plays: PlayInfo[] = [];
  const drives = data.drives?.previous || [];
  
  for (const drive of drives) {
    for (const play of (drive.plays || [])) {
      try {
        plays.push({
          play_id: play.id || '',
          quarter: play.period?.number || 0,
          game_clock: play.clock?.displayValue || '',
          down: play.start?.down || 0,
          yards_to_go: play.start?.distance || 0,
          yard_line: play.start?.yardLine || 0,
          play_description: play.text || '',
          play_type: play.type?.text || 'Unknown',
          scoring_play: play.scoringPlay || false,
          home_score: play.homeScore || 0,
          away_score: play.awayScore || 0,
          match_confidence: 0.95,
        });
      } catch {
        continue;
      }
    }
  }
  
  return plays;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const team = searchParams.get('team')?.toLowerCase();
  
  if (!team || !TEAM_MAP[team]) {
    return NextResponse.json(
      { error: 'Invalid team. Use "seahawks" or "patriots"' },
      { status: 400 }
    );
  }
  
  const teamInfo = TEAM_MAP[team];
  
  try {
    // Get recent games for the team
    const games = await getTeamSchedule(teamInfo.espnId);
    
    if (games.length === 0) {
      return NextResponse.json({
        team: teamInfo.fullName,
        abbrev: teamInfo.abbrev,
        games: [],
        plays: [],
        message: 'No completed games found',
      });
    }
    
    // Get plays from the most recent game
    const latestGame = games[0];
    const plays = await getGamePlays(latestGame.espn_id);
    
    return NextResponse.json({
      team: teamInfo.fullName,
      abbrev: teamInfo.abbrev,
      games,
      plays,
      latestGame,
      playCount: plays.length,
    });
    
  } catch (error) {
    console.error('Error fetching team analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team data', details: String(error) },
      { status: 500 }
    );
  }
}
