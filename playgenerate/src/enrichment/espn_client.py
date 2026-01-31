"""
ESPN API Client for NFL play-by-play data.

Uses ESPN's unofficial (but free) API endpoints:
- Scoreboard: Get games by date
- Summary: Get full play-by-play for a game
"""

import requests
import time
from typing import Optional
from dataclasses import dataclass


@dataclass
class GameInfo:
    """Basic game information from ESPN."""
    espn_id: str
    date: str
    home_team: str
    home_team_abbrev: str
    away_team: str
    away_team_abbrev: str
    stadium: str
    home_score: int
    away_score: int
    status: str


@dataclass
class PlayInfo:
    """Play-by-play information from ESPN."""
    play_id: str
    quarter: int
    clock: str
    down: int
    distance: int
    yard_line: int
    yard_line_side: str  # Team abbreviation
    play_text: str
    play_type: str
    scoring_play: bool
    home_score: int
    away_score: int


class ESPNClient:
    """Client for ESPN's NFL API endpoints."""
    
    BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl"
    
    def __init__(self, cache_enabled: bool = True, rate_limit_seconds: float = 0.5):
        """
        Initialize ESPN client.
        
        Args:
            cache_enabled: Whether to cache API responses
            rate_limit_seconds: Minimum seconds between API calls
        """
        self.cache_enabled = cache_enabled
        self.rate_limit_seconds = rate_limit_seconds
        self._cache: dict = {}
        self._last_request_time: float = 0
    
    def _rate_limit(self) -> None:
        """Enforce rate limiting between requests."""
        elapsed = time.time() - self._last_request_time
        if elapsed < self.rate_limit_seconds:
            time.sleep(self.rate_limit_seconds - elapsed)
        self._last_request_time = time.time()
    
    def _get(self, url: str) -> Optional[dict]:
        """
        Make a GET request with caching and rate limiting.
        
        Args:
            url: Full URL to request
            
        Returns:
            JSON response as dict, or None if request failed
        """
        # Check cache
        if self.cache_enabled and url in self._cache:
            return self._cache[url]
        
        # Rate limit
        self._rate_limit()
        
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            # Cache successful response
            if self.cache_enabled:
                self._cache[url] = data
            
            return data
        except requests.RequestException as e:
            print(f"ESPN API request failed: {e}")
            return None
    
    def get_scoreboard(self, date: str) -> list[GameInfo]:
        """
        Get all NFL games for a specific date.
        
        Args:
            date: Date in YYYYMMDD format (e.g., "20230907")
            
        Returns:
            List of GameInfo objects for games on that date
        """
        url = f"{self.BASE_URL}/scoreboard?dates={date}"
        data = self._get(url)
        
        if not data or 'events' not in data:
            return []
        
        games = []
        for event in data['events']:
            try:
                competitions = event.get('competitions', [{}])[0]
                competitors = competitions.get('competitors', [])
                
                home = next((c for c in competitors if c.get('homeAway') == 'home'), {})
                away = next((c for c in competitors if c.get('homeAway') == 'away'), {})
                
                venue = competitions.get('venue', {})
                
                game = GameInfo(
                    espn_id=event.get('id', ''),
                    date=event.get('date', ''),
                    home_team=home.get('team', {}).get('displayName', ''),
                    home_team_abbrev=home.get('team', {}).get('abbreviation', ''),
                    away_team=away.get('team', {}).get('displayName', ''),
                    away_team_abbrev=away.get('team', {}).get('abbreviation', ''),
                    stadium=venue.get('fullName', ''),
                    home_score=int(home.get('score', 0)),
                    away_score=int(away.get('score', 0)),
                    status=event.get('status', {}).get('type', {}).get('name', '')
                )
                games.append(game)
            except (KeyError, IndexError, ValueError) as e:
                print(f"Error parsing game: {e}")
                continue
        
        return games
    
    def get_game_summary(self, espn_game_id: str) -> Optional[dict]:
        """
        Get full game summary including play-by-play.
        
        Args:
            espn_game_id: ESPN's game ID (e.g., "401547353")
            
        Returns:
            Full game summary dict, or None if request failed
        """
        url = f"{self.BASE_URL}/summary?event={espn_game_id}"
        return self._get(url)
    
    def get_plays(self, espn_game_id: str) -> list[PlayInfo]:
        """
        Get all plays for a game.
        
        Args:
            espn_game_id: ESPN's game ID
            
        Returns:
            List of PlayInfo objects for all plays in the game
        """
        summary = self.get_game_summary(espn_game_id)
        
        if not summary:
            return []
        
        plays = []
        drives = summary.get('drives', {}).get('previous', [])
        
        # Also check current drive if game is in progress
        current = summary.get('drives', {}).get('current', {})
        if current:
            drives.append(current)
        
        for drive in drives:
            drive_plays = drive.get('plays', [])
            
            for play in drive_plays:
                try:
                    # Parse yard line
                    yard_line = play.get('start', {}).get('yardLine', 0)
                    yard_line_side = play.get('start', {}).get('team', {}).get('abbreviation', '')
                    
                    play_info = PlayInfo(
                        play_id=str(play.get('id', '')),
                        quarter=play.get('period', {}).get('number', 0),
                        clock=play.get('clock', {}).get('displayValue', ''),
                        down=play.get('start', {}).get('down', 0),
                        distance=play.get('start', {}).get('distance', 0),
                        yard_line=yard_line,
                        yard_line_side=yard_line_side,
                        play_text=play.get('text', ''),
                        play_type=play.get('type', {}).get('text', ''),
                        scoring_play=play.get('scoringPlay', False),
                        home_score=play.get('homeScore', 0),
                        away_score=play.get('awayScore', 0)
                    )
                    plays.append(play_info)
                except (KeyError, ValueError) as e:
                    print(f"Error parsing play: {e}")
                    continue
        
        return plays
    
    def get_game_info(self, espn_game_id: str) -> Optional[GameInfo]:
        """
        Get game info from a game summary.
        
        Args:
            espn_game_id: ESPN's game ID
            
        Returns:
            GameInfo object, or None if request failed
        """
        summary = self.get_game_summary(espn_game_id)
        
        if not summary:
            return None
        
        try:
            header = summary.get('header', {})
            competitions = header.get('competitions', [{}])[0]
            competitors = competitions.get('competitors', [])
            
            home = next((c for c in competitors if c.get('homeAway') == 'home'), {})
            away = next((c for c in competitors if c.get('homeAway') == 'away'), {})
            
            game_info = summary.get('gameInfo', {})
            venue = game_info.get('venue', {})
            
            return GameInfo(
                espn_id=espn_game_id,
                date=competitions.get('date', ''),
                home_team=home.get('team', {}).get('displayName', ''),
                home_team_abbrev=home.get('team', {}).get('abbreviation', ''),
                away_team=away.get('team', {}).get('displayName', ''),
                away_team_abbrev=away.get('team', {}).get('abbreviation', ''),
                stadium=venue.get('fullName', ''),
                home_score=int(home.get('score', 0)),
                away_score=int(away.get('score', 0)),
                status=competitions.get('status', {}).get('type', {}).get('name', '')
            )
        except (KeyError, IndexError, ValueError) as e:
            print(f"Error parsing game info: {e}")
            return None
    
    def clear_cache(self) -> None:
        """Clear the response cache."""
        self._cache.clear()


# Example usage
if __name__ == "__main__":
    client = ESPNClient()
    
    # Get games for September 7, 2023 (Lions vs Chiefs)
    print("Fetching games for 2023-09-07...")
    games = client.get_scoreboard("20230907")
    
    for game in games:
        print(f"\n{game.away_team} @ {game.home_team}")
        print(f"  ESPN ID: {game.espn_id}")
        print(f"  Stadium: {game.stadium}")
        print(f"  Score: {game.away_score} - {game.home_score}")
    
    if games:
        # Get plays for first game
        print(f"\n\nFetching plays for game {games[0].espn_id}...")
        plays = client.get_plays(games[0].espn_id)
        
        print(f"Total plays: {len(plays)}")
        for play in plays[:5]:
            print(f"\nQ{play.quarter} {play.clock} - {play.down}&{play.distance} at {play.yard_line_side} {play.yard_line}")
            print(f"  {play.play_text}")
