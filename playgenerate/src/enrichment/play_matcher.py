"""
Play Matcher for NFL Big Data Bowl to ESPN play-by-play.

Matches plays from tracking data to ESPN's play-by-play using:
- Yard line position (absolute_yardline_number)
- Sequential order within game
- Ball landing coordinates (for pass plays)
"""

from dataclasses import dataclass
from typing import Optional
import os
import sys

# Handle both module and script execution
try:
    from .espn_client import ESPNClient, PlayInfo, GameInfo
    from .game_mapper import GameMapper, GameMapping
except ImportError:
    from espn_client import ESPNClient, PlayInfo, GameInfo
    from game_mapper import GameMapper, GameMapping


@dataclass
class EnrichedPlay:
    """Play data enriched with ESPN metadata."""
    # Big Data Bowl fields
    game_id: str
    play_id: int
    absolute_yardline: int
    play_direction: str
    ball_land_x: float
    ball_land_y: float
    num_frames: int
    
    # ESPN enriched fields
    quarter: int
    game_clock: str
    down: int
    yards_to_go: int
    play_description: str
    play_type: str
    scoring_play: bool
    
    # Game context
    home_team: str
    away_team: str
    stadium: str
    home_score: int
    away_score: int
    
    # Confidence
    match_confidence: float  # 0.0 to 1.0


class PlayMatcher:
    """Matches Big Data Bowl plays to ESPN play-by-play data."""
    
    def __init__(self, espn_client: Optional[ESPNClient] = None, game_mapper: Optional[GameMapper] = None):
        """
        Initialize the play matcher.
        
        Args:
            espn_client: ESPN client instance
            game_mapper: Game mapper instance
        """
        self.espn_client = espn_client or ESPNClient()
        self.game_mapper = game_mapper or GameMapper(espn_client=self.espn_client)
        self._espn_plays_cache: dict[str, list[PlayInfo]] = {}
        self._game_info_cache: dict[str, GameInfo] = {}
    
    def _get_espn_plays(self, espn_game_id: str) -> list[PlayInfo]:
        """Get and cache ESPN plays for a game."""
        if espn_game_id not in self._espn_plays_cache:
            self._espn_plays_cache[espn_game_id] = self.espn_client.get_plays(espn_game_id)
        return self._espn_plays_cache[espn_game_id]
    
    def _get_game_info(self, espn_game_id: str) -> Optional[GameInfo]:
        """Get and cache game info."""
        if espn_game_id not in self._game_info_cache:
            info = self.espn_client.get_game_info(espn_game_id)
            if info:
                self._game_info_cache[espn_game_id] = info
        return self._game_info_cache.get(espn_game_id)
    
    @staticmethod
    def absolute_to_espn_yardline(absolute_yardline: int) -> int:
        """
        Convert Big Data Bowl absolute yardline to ESPN's yardline format.
        
        In Big Data Bowl:
        - Field is 120 yards (0-120): 10 yards each endzone + 100 yard field
        - Left endzone: 0-10
        - Field: 10-110
        - Right endzone: 110-120
        
        ESPN appears to report yardline from home team's goal line.
        Home team's endzone is typically on the right (110-120 absolute).
        
        So: ESPN yardline = 110 - absolute_yardline
        
        Args:
            absolute_yardline: Position on 120-yard field (0-120)
            
        Returns:
            Yard line in ESPN's format (from home team's goal line)
        """
        # ESPN yardline = distance from home team's goal line
        # Home team's goal line is at absolute 110
        return 110 - absolute_yardline
    
    @staticmethod
    def absolute_to_field_position(absolute_yardline: int, play_direction: str = 'right') -> int:
        """
        Convert absolute yardline (0-120) to standard field position (own 1-50, opp 1-50).
        
        Args:
            absolute_yardline: Position on 120-yard field (0-120)
            play_direction: 'left' or 'right' indicating offense direction
            
        Returns:
            Yard line on field (1-50 on either side)
        """
        # Convert to field position (remove endzones)
        field_pos = absolute_yardline - 10  # Now 0-100
        
        # Convert to ESPN-style (1-50 from either endzone)
        if field_pos <= 50:
            return field_pos
        else:
            return 100 - field_pos
    
    @staticmethod
    def calculate_match_score(
        bdb_yardline: int,
        espn_yardline: int,
        bdb_direction: str,
        espn_down: int,
        sequence_distance: int
    ) -> float:
        """
        Calculate a match confidence score between BDB and ESPN plays.
        
        Args:
            bdb_yardline: Big Data Bowl absolute yardline
            espn_yardline: ESPN yard line (from home team's goal line)
            bdb_direction: Play direction from BDB
            espn_down: Down from ESPN (0 if special teams)
            sequence_distance: How far apart in sequence (0 = same position)
            
        Returns:
            Match confidence score (0.0 to 1.0)
        """
        score = 0.0
        
        # Convert BDB yardline to ESPN's format (from home team's goal line)
        bdb_converted = PlayMatcher.absolute_to_espn_yardline(bdb_yardline)
        
        # Yardline match (most important - up to 0.6)
        yardline_diff = abs(bdb_converted - espn_yardline)
        if yardline_diff == 0:
            score += 0.6
        elif yardline_diff <= 2:
            score += 0.5
        elif yardline_diff <= 5:
            score += 0.3
        elif yardline_diff <= 10:
            score += 0.1
        
        # Sequence distance (up to 0.3)
        if sequence_distance == 0:
            score += 0.3
        elif sequence_distance <= 2:
            score += 0.2
        elif sequence_distance <= 5:
            score += 0.1
        
        # Regular play bonus (up to 0.1)
        if espn_down > 0:  # Regular scrimmage play
            score += 0.1
        
        return min(score, 1.0)
    
    def match_play(
        self,
        game_id: str,
        play_id: int,
        absolute_yardline: int,
        play_direction: str = 'right',
        ball_land_x: float = 0.0,
        ball_land_y: float = 0.0,
        num_frames: int = 0,
        play_sequence_hint: Optional[int] = None
    ) -> Optional[EnrichedPlay]:
        """
        Match a Big Data Bowl play to ESPN play-by-play.
        
        Args:
            game_id: Big Data Bowl game_id
            play_id: Big Data Bowl play_id
            absolute_yardline: Position on 120-yard field
            play_direction: 'left' or 'right'
            ball_land_x: Ball landing x coordinate
            ball_land_y: Ball landing y coordinate
            num_frames: Number of tracking frames
            play_sequence_hint: Approximate position in game sequence
            
        Returns:
            EnrichedPlay with ESPN data, or None if no match
        """
        # Get game mapping
        game_mapping = self.game_mapper.get_mapping(game_id)
        if not game_mapping:
            print(f"Could not map game {game_id} to ESPN")
            return None
        
        # Get ESPN plays
        espn_plays = self._get_espn_plays(game_mapping.espn_game_id)
        if not espn_plays:
            print(f"No ESPN plays found for game {game_mapping.espn_game_id}")
            return None
        
        # Get game info
        game_info = self._get_game_info(game_mapping.espn_game_id)
        
        # Convert BDB yardline for comparison (to ESPN's format)
        bdb_converted = self.absolute_to_espn_yardline(absolute_yardline)
        
        # Find best matching play
        best_match: Optional[PlayInfo] = None
        best_score = 0.0
        best_sequence_idx = 0
        
        for idx, espn_play in enumerate(espn_plays):
            # Skip special teams plays without meaningful yardlines
            if espn_play.yard_line == 0 and espn_play.down == 0:
                continue
            
            # Calculate sequence hint distance
            sequence_dist = abs(idx - (play_sequence_hint or 0)) if play_sequence_hint else idx
            
            score = self.calculate_match_score(
                bdb_yardline=absolute_yardline,
                espn_yardline=espn_play.yard_line,
                bdb_direction=play_direction,
                espn_down=espn_play.down,
                sequence_distance=sequence_dist
            )
            
            if score > best_score:
                best_score = score
                best_match = espn_play
                best_sequence_idx = idx
        
        if not best_match or best_score < 0.3:
            print(f"No good match found for play {play_id} (best score: {best_score:.2f})")
            return None
        
        # Create enriched play
        return EnrichedPlay(
            # BDB fields
            game_id=game_id,
            play_id=play_id,
            absolute_yardline=absolute_yardline,
            play_direction=play_direction,
            ball_land_x=ball_land_x,
            ball_land_y=ball_land_y,
            num_frames=num_frames,
            
            # ESPN fields
            quarter=best_match.quarter,
            game_clock=best_match.clock,
            down=best_match.down,
            yards_to_go=best_match.distance,
            play_description=best_match.play_text,
            play_type=best_match.play_type,
            scoring_play=best_match.scoring_play,
            
            # Game context
            home_team=game_mapping.home_team,
            away_team=game_mapping.away_team,
            stadium=game_mapping.stadium,
            home_score=best_match.home_score,
            away_score=best_match.away_score,
            
            # Confidence
            match_confidence=best_score
        )
    
    def match_plays_batch(
        self,
        plays: list[dict]
    ) -> list[EnrichedPlay]:
        """
        Match multiple plays to ESPN data.
        
        Args:
            plays: List of dicts with keys: game_id, play_id, absolute_yardline, 
                   play_direction, ball_land_x, ball_land_y, num_frames
                   
        Returns:
            List of EnrichedPlay objects (only successful matches)
        """
        results = []
        
        # Group by game for efficiency
        plays_by_game: dict[str, list[tuple[int, dict]]] = {}
        for idx, play in enumerate(plays):
            game_id = str(play['game_id'])
            if game_id not in plays_by_game:
                plays_by_game[game_id] = []
            plays_by_game[game_id].append((idx, play))
        
        for game_id, game_plays in plays_by_game.items():
            print(f"Processing {len(game_plays)} plays for game {game_id}...")
            
            for seq_idx, (orig_idx, play) in enumerate(game_plays):
                enriched = self.match_play(
                    game_id=game_id,
                    play_id=play['play_id'],
                    absolute_yardline=play['absolute_yardline'],
                    play_direction=play.get('play_direction', 'right'),
                    ball_land_x=play.get('ball_land_x', 0.0),
                    ball_land_y=play.get('ball_land_y', 0.0),
                    num_frames=play.get('num_frames', 0),
                    play_sequence_hint=seq_idx
                )
                
                if enriched:
                    results.append(enriched)
        
        return results


# Example usage
if __name__ == "__main__":
    matcher = PlayMatcher()
    
    # Test with play 101 from Lions vs Chiefs (3rd & 3, deep pass incomplete to Reynolds)
    print("Testing play matching for game 2023090700, play 101...")
    print("  (Should match: Q1 14:25, 3rd & 3 at DET 32, Goff incomplete deep right to Reynolds)")
    print()
    
    enriched = matcher.match_play(
        game_id="2023090700",
        play_id=101,
        absolute_yardline=42,  # DET 32 = 42 on absolute scale
        play_direction='right',
        ball_land_x=63.26,
        ball_land_y=-0.22,
        num_frames=21,
        play_sequence_hint=3  # This is approximately the 3rd-4th play
    )
    
    if enriched:
        print(f"Match found (confidence: {enriched.match_confidence:.2f}):")
        print(f"  Q{enriched.quarter} {enriched.game_clock}")
        print(f"  {enriched.down}&{enriched.yards_to_go}")
        print(f"  {enriched.play_description}")
        print(f"  Type: {enriched.play_type}")
        print(f"  {enriched.away_team} @ {enriched.home_team}")
        print(f"  Stadium: {enriched.stadium}")
    else:
        print("No match found!")
