"""
Game ID Mapper for NFL Big Data Bowl to ESPN.

Big Data Bowl game_id format: YYYYMMDD + 2-digit game number (e.g., 2023090700)
ESPN game_id format: 9-digit numeric ID (e.g., 401547353)

This module provides mapping between the two ID systems.
"""

from dataclasses import dataclass
from typing import Optional
import json
import os
import sys

# Handle both module and script execution
try:
    from .espn_client import ESPNClient, GameInfo
except ImportError:
    # Running as script - import directly
    from espn_client import ESPNClient, GameInfo


# Team name normalization mapping
TEAM_ALIASES = {
    # Full names to abbreviations
    "Arizona Cardinals": "ARI",
    "Atlanta Falcons": "ATL",
    "Baltimore Ravens": "BAL",
    "Buffalo Bills": "BUF",
    "Carolina Panthers": "CAR",
    "Chicago Bears": "CHI",
    "Cincinnati Bengals": "CIN",
    "Cleveland Browns": "CLE",
    "Dallas Cowboys": "DAL",
    "Denver Broncos": "DEN",
    "Detroit Lions": "DET",
    "Green Bay Packers": "GB",
    "Houston Texans": "HOU",
    "Indianapolis Colts": "IND",
    "Jacksonville Jaguars": "JAX",
    "Kansas City Chiefs": "KC",
    "Las Vegas Raiders": "LV",
    "Los Angeles Chargers": "LAC",
    "Los Angeles Rams": "LAR",
    "Miami Dolphins": "MIA",
    "Minnesota Vikings": "MIN",
    "New England Patriots": "NE",
    "New Orleans Saints": "NO",
    "New York Giants": "NYG",
    "New York Jets": "NYJ",
    "Philadelphia Eagles": "PHI",
    "Pittsburgh Steelers": "PIT",
    "San Francisco 49ers": "SF",
    "Seattle Seahawks": "SEA",
    "Tampa Bay Buccaneers": "TB",
    "Tennessee Titans": "TEN",
    "Washington Commanders": "WAS",
    # Alternative abbreviations
    "JAC": "JAX",
    "LA": "LAR",
    "OAK": "LV",  # Raiders moved
    "SD": "LAC",  # Chargers moved
    "STL": "LAR",  # Rams moved
    "WSH": "WAS",
}


@dataclass
class GameMapping:
    """Mapping between Big Data Bowl game_id and ESPN game_id."""
    bdb_game_id: str  # Big Data Bowl game_id (e.g., "2023090700")
    espn_game_id: str  # ESPN game_id (e.g., "401547353")
    date: str  # Date in YYYYMMDD format
    home_team: str
    home_team_abbrev: str
    away_team: str
    away_team_abbrev: str
    stadium: str


class GameMapper:
    """Maps Big Data Bowl game IDs to ESPN game IDs."""
    
    def __init__(self, espn_client: Optional[ESPNClient] = None, cache_file: Optional[str] = None):
        """
        Initialize the game mapper.
        
        Args:
            espn_client: ESPN client instance (creates new one if not provided)
            cache_file: Path to JSON file for caching mappings
        """
        self.espn_client = espn_client or ESPNClient()
        self.cache_file = cache_file
        self._mappings: dict[str, GameMapping] = {}
        
        # Load cached mappings if file exists
        if cache_file and os.path.exists(cache_file):
            self._load_cache()
    
    def _load_cache(self) -> None:
        """Load cached mappings from file."""
        try:
            with open(self.cache_file, 'r') as f:
                data = json.load(f)
                for bdb_id, mapping_data in data.items():
                    self._mappings[bdb_id] = GameMapping(**mapping_data)
            print(f"Loaded {len(self._mappings)} cached game mappings")
        except (json.JSONDecodeError, FileNotFoundError, TypeError) as e:
            print(f"Error loading cache: {e}")
    
    def _save_cache(self) -> None:
        """Save mappings to cache file."""
        if not self.cache_file:
            return
        
        try:
            data = {
                bdb_id: {
                    'bdb_game_id': m.bdb_game_id,
                    'espn_game_id': m.espn_game_id,
                    'date': m.date,
                    'home_team': m.home_team,
                    'home_team_abbrev': m.home_team_abbrev,
                    'away_team': m.away_team,
                    'away_team_abbrev': m.away_team_abbrev,
                    'stadium': m.stadium,
                }
                for bdb_id, m in self._mappings.items()
            }
            
            os.makedirs(os.path.dirname(self.cache_file) or '.', exist_ok=True)
            with open(self.cache_file, 'w') as f:
                json.dump(data, f, indent=2)
        except (IOError, OSError) as e:
            print(f"Error saving cache: {e}")
    
    @staticmethod
    def parse_bdb_game_id(bdb_game_id: str) -> tuple[str, int]:
        """
        Parse a Big Data Bowl game_id.
        
        Args:
            bdb_game_id: Game ID in format YYYYMMDDNN (e.g., "2023090700")
            
        Returns:
            Tuple of (date in YYYYMMDD, game_number)
        """
        bdb_game_id = str(bdb_game_id)
        date = bdb_game_id[:8]
        game_num = int(bdb_game_id[8:]) if len(bdb_game_id) > 8 else 0
        return date, game_num
    
    @staticmethod
    def normalize_team(team_name: str) -> str:
        """
        Normalize team name to standard abbreviation.
        
        Args:
            team_name: Team name or abbreviation
            
        Returns:
            Standard 2-3 letter team abbreviation
        """
        # Check if it's already an abbreviation
        if team_name.upper() in TEAM_ALIASES:
            return TEAM_ALIASES[team_name.upper()]
        
        # Check if it's a full name
        if team_name in TEAM_ALIASES:
            return TEAM_ALIASES[team_name]
        
        # Return uppercase if not found
        return team_name.upper()[:3]
    
    def get_mapping(self, bdb_game_id: str, teams: Optional[tuple[str, str]] = None) -> Optional[GameMapping]:
        """
        Get ESPN game ID mapping for a Big Data Bowl game ID.
        
        Args:
            bdb_game_id: Big Data Bowl game ID (e.g., "2023090700")
            teams: Optional tuple of (home_team, away_team) to help match
            
        Returns:
            GameMapping object if found, None otherwise
        """
        bdb_game_id = str(bdb_game_id)
        
        # Check cache first
        if bdb_game_id in self._mappings:
            return self._mappings[bdb_game_id]
        
        # Parse the game ID
        date, game_num = self.parse_bdb_game_id(bdb_game_id)
        
        # Fetch games for that date from ESPN
        games = self.espn_client.get_scoreboard(date)
        
        if not games:
            print(f"No games found for date {date}")
            return None
        
        # If teams provided, try to match by team
        matched_game: Optional[GameInfo] = None
        
        if teams:
            home_abbrev = self.normalize_team(teams[0])
            away_abbrev = self.normalize_team(teams[1])
            
            for game in games:
                espn_home = self.normalize_team(game.home_team_abbrev)
                espn_away = self.normalize_team(game.away_team_abbrev)
                
                if (espn_home == home_abbrev and espn_away == away_abbrev) or \
                   (espn_home == away_abbrev and espn_away == home_abbrev):
                    matched_game = game
                    break
        
        # If no team match, use game number as index
        if not matched_game and game_num < len(games):
            matched_game = games[game_num]
        
        # If still no match, return first game (for single-game days like Thursday Night Football)
        if not matched_game and len(games) == 1:
            matched_game = games[0]
        
        if not matched_game:
            print(f"Could not match game {bdb_game_id} to ESPN games")
            return None
        
        # Create and cache mapping
        mapping = GameMapping(
            bdb_game_id=bdb_game_id,
            espn_game_id=matched_game.espn_id,
            date=date,
            home_team=matched_game.home_team,
            home_team_abbrev=matched_game.home_team_abbrev,
            away_team=matched_game.away_team,
            away_team_abbrev=matched_game.away_team_abbrev,
            stadium=matched_game.stadium,
        )
        
        self._mappings[bdb_game_id] = mapping
        self._save_cache()
        
        return mapping
    
    def get_all_mappings(self) -> dict[str, GameMapping]:
        """Get all cached mappings."""
        return self._mappings.copy()


# Example usage
if __name__ == "__main__":
    # Create mapper with cache
    cache_path = os.path.join(os.path.dirname(__file__), '..', '..', 'output', 'game_mappings.json')
    mapper = GameMapper(cache_file=cache_path)
    
    # Test mapping for Lions vs Chiefs game
    print("Testing game mapping for 2023090700 (Lions vs Chiefs)...")
    mapping = mapper.get_mapping("2023090700")
    
    if mapping:
        print(f"\nMapping found:")
        print(f"  BDB Game ID: {mapping.bdb_game_id}")
        print(f"  ESPN Game ID: {mapping.espn_game_id}")
        print(f"  {mapping.away_team} @ {mapping.home_team}")
        print(f"  Stadium: {mapping.stadium}")
    else:
        print("Mapping not found!")
    
    # Test with team hints
    print("\n\nTesting with team hints (KC home, DET away)...")
    mapping2 = mapper.get_mapping("2023090700", teams=("KC", "DET"))
    
    if mapping2:
        print(f"  ESPN Game ID: {mapping2.espn_game_id}")
        print(f"  {mapping2.away_team} @ {mapping2.home_team}")
