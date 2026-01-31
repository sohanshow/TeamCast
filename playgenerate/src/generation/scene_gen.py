"""
Scene Description Generator using Gemini.

Converts NFL tracking data and play metadata into natural language
scene descriptions suitable for video generation with Veo.
"""

import os
from typing import Optional
from dataclasses import dataclass
import pandas as pd

# Try to import google.generativeai
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("Warning: google-generativeai not installed. Scene generation will use templates only.")


@dataclass
class SceneDescription:
    """Generated scene description for a play."""
    play_id: int
    game_id: str
    description: str
    camera_angle: str
    duration_hint: float  # Suggested video duration in seconds
    style_hints: list[str]


# Default camera angles for different play types
CAMERA_ANGLES = {
    "Pass Reception": "broadcast angle, following the quarterback",
    "Pass Incompletion": "wide angle showing the full field",
    "Rush": "sideline camera tracking the ball carrier",
    "Sack": "end zone camera showing the pocket collapse",
    "Interception": "high angle showing the full play development",
    "Touchdown": "dramatic low angle with crowd reaction",
    "Field Goal": "behind the kicker, goalpost in frame",
    "Punt": "sideline wide shot",
    "Kickoff": "aerial shot of the full field",
}

# Style hints for different situations
STYLE_HINTS = {
    "scoring": ["dramatic lighting", "slow motion", "crowd noise"],
    "turnover": ["tense atmosphere", "close-up reactions"],
    "big_play": ["dynamic camera movement", "celebration"],
    "third_down": ["pressure situation", "crowd noise"],
    "goal_line": ["tight focus", "intensity"],
}


class SceneGenerator:
    """Generates scene descriptions from tracking data using Gemini."""
    
    PROMPT_TEMPLATE = '''You are a professional sports cinematographer describing an NFL play for AI video generation.

## Play Context
- **Game**: {away_team} at {home_team}
- **Stadium**: {stadium}
- **Situation**: Quarter {quarter}, {game_clock} remaining
- **Down & Distance**: {down} & {yards_to_go}
- **Result**: {play_description}

## Player Tracking Summary
{tracking_summary}

## Your Task
Generate a cinematic scene description (60-100 words) for this play that a video generation AI can use.

Include:
1. Pre-snap formation and atmosphere
2. Key player movements during the play
3. Ball trajectory (if a pass play)
4. Defensive reaction
5. Final result and player reactions

Use specific, visual language. Describe it as if directing a sports broadcast replay.

Camera suggestion: {camera_angle}

Scene description:'''

    def __init__(self, api_key: Optional[str] = None, model_name: str = "gemini-2.0-flash"):
        """
        Initialize the scene generator.
        
        Args:
            api_key: Google AI API key (uses GOOGLE_API_KEY env var if not provided)
            model_name: Gemini model to use
        """
        self.api_key = api_key or os.environ.get("GOOGLE_API_KEY")
        self.model_name = model_name
        self.model = None
        
        if GEMINI_AVAILABLE and self.api_key:
            try:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel(model_name)
                print(f"Gemini model {model_name} initialized")
            except Exception as e:
                print(f"Warning: Could not initialize Gemini: {e}")
                self.model = None
    
    def format_tracking_summary(
        self,
        tracking_df: pd.DataFrame,
        max_players: int = 6
    ) -> str:
        """
        Format tracking data into a readable summary.
        
        Args:
            tracking_df: DataFrame with tracking data for a single play
            max_players: Maximum number of players to include
            
        Returns:
            Formatted string summarizing player movements
        """
        if tracking_df.empty:
            return "Player tracking data not available."
        
        # Group by player
        players = tracking_df.groupby('player_name')
        
        summaries = []
        for player_name, player_data in list(players)[:max_players]:
            player_data = player_data.sort_values('frame_id')
            
            if player_data.empty:
                continue
            
            first = player_data.iloc[0]
            last = player_data.iloc[-1]
            
            position = first.get('player_position', 'Unknown')
            role = first.get('player_role', 'Unknown')
            side = first.get('player_side', '')
            
            # Calculate movement
            dx = last['x'] - first['x']
            dy = last['y'] - first['y']
            
            # Get max speed during play
            max_speed = player_data['s'].max() if 's' in player_data else 0
            
            # Describe movement
            movement_parts = []
            if abs(dx) > 5:
                movement_parts.append(f"moved {'forward' if dx > 0 else 'backward'} {abs(dx):.0f} yards")
            if abs(dy) > 5:
                movement_parts.append(f"{'left' if dy > 0 else 'right'} {abs(dy):.0f} yards")
            
            if movement_parts:
                movement = ", ".join(movement_parts)
            elif max_speed > 5:
                movement = f"active in zone (max speed {max_speed:.1f} yd/s)"
            else:
                movement = "held position"
            
            summaries.append(f"- **{player_name}** ({position}, {side} {role}): {movement}")
        
        return "\n".join(summaries) if summaries else "Player tracking data not available."
    
    def get_camera_angle(self, play_type: str) -> str:
        """Get suggested camera angle for play type."""
        return CAMERA_ANGLES.get(play_type, "broadcast angle")
    
    def get_style_hints(self, enriched_play: dict) -> list[str]:
        """Get style hints based on play context."""
        hints = []
        
        if enriched_play.get('scoring_play'):
            hints.extend(STYLE_HINTS["scoring"])
        
        if enriched_play.get('down') == 3:
            hints.extend(STYLE_HINTS["third_down"])
        
        if enriched_play.get('yards_to_go', 0) > 10:
            hints.append("long developing play")
        
        # Check for turnovers
        play_desc = enriched_play.get('play_description', '').lower()
        if 'intercept' in play_desc or 'fumble' in play_desc:
            hints.extend(STYLE_HINTS["turnover"])
        
        return hints[:4]  # Limit to 4 hints
    
    def generate_template_description(self, enriched_play: dict, tracking_summary: str) -> str:
        """
        Generate a scene description using templates (no Gemini).
        
        Args:
            enriched_play: Enriched play data dict
            tracking_summary: Formatted tracking data
            
        Returns:
            Template-based scene description
        """
        play_type = enriched_play.get('play_type', 'Unknown')
        down = enriched_play.get('down', 0)
        yards = enriched_play.get('yards_to_go', 0)
        quarter = enriched_play.get('quarter', 1)
        clock = enriched_play.get('game_clock', '15:00')
        home = enriched_play.get('home_team', 'Home Team')
        away = enriched_play.get('away_team', 'Away Team')
        desc = enriched_play.get('play_description', '')
        
        # Build template description
        situation = f"Quarter {quarter}, {clock} remaining."
        down_str = f"{down}{'st' if down == 1 else 'nd' if down == 2 else 'rd' if down == 3 else 'th'} and {yards}."
        
        if 'Pass' in play_type:
            action = "The quarterback drops back in the pocket, scanning the field."
            if 'Incompletion' in play_type:
                result = "The pass sails incomplete as defenders converge."
            else:
                result = "The receiver makes the catch and turns upfield."
        elif 'Rush' in play_type:
            action = "The running back takes the handoff and hits the hole."
            result = "He fights for extra yards before being brought down."
        else:
            action = "The play develops as players engage."
            result = desc
        
        return f"{situation} {down_str} {action} {result}"
    
    def generate_description(
        self,
        enriched_play: dict,
        tracking_df: Optional[pd.DataFrame] = None
    ) -> SceneDescription:
        """
        Generate a scene description for a play.
        
        Args:
            enriched_play: Enriched play data dict
            tracking_df: Optional tracking data DataFrame
            
        Returns:
            SceneDescription with generated content
        """
        # Format tracking summary
        tracking_summary = "Player tracking data not available."
        if tracking_df is not None and not tracking_df.empty:
            tracking_summary = self.format_tracking_summary(tracking_df)
        
        # Get camera angle and style hints
        play_type = enriched_play.get('play_type', 'Unknown')
        camera_angle = self.get_camera_angle(play_type)
        style_hints = self.get_style_hints(enriched_play)
        
        # Generate description
        if self.model:
            # Use Gemini
            prompt = self.PROMPT_TEMPLATE.format(
                away_team=enriched_play.get('away_team', 'Away'),
                home_team=enriched_play.get('home_team', 'Home'),
                stadium=enriched_play.get('stadium', 'Stadium'),
                quarter=enriched_play.get('quarter', 1),
                game_clock=enriched_play.get('game_clock', '15:00'),
                down=enriched_play.get('down', 1),
                yards_to_go=enriched_play.get('yards_to_go', 10),
                play_description=enriched_play.get('play_description', ''),
                tracking_summary=tracking_summary,
                camera_angle=camera_angle,
            )
            
            try:
                response = self.model.generate_content(prompt)
                description = response.text.strip()
            except Exception as e:
                print(f"Gemini error: {e}")
                description = self.generate_template_description(enriched_play, tracking_summary)
        else:
            # Use template
            description = self.generate_template_description(enriched_play, tracking_summary)
        
        # Calculate duration hint based on play length
        num_frames = enriched_play.get('num_frames', 21)
        duration_hint = min(8.0, max(4.0, num_frames / 10 * 2))  # 4-8 seconds
        
        return SceneDescription(
            play_id=enriched_play.get('play_id', 0),
            game_id=str(enriched_play.get('game_id', '')),
            description=description,
            camera_angle=camera_angle,
            duration_hint=duration_hint,
            style_hints=style_hints,
        )
    
    def generate_batch(
        self,
        enriched_plays: list[dict],
        tracking_data: Optional[pd.DataFrame] = None
    ) -> list[SceneDescription]:
        """
        Generate scene descriptions for multiple plays.
        
        Args:
            enriched_plays: List of enriched play dicts
            tracking_data: Optional full tracking DataFrame
            
        Returns:
            List of SceneDescriptions
        """
        results = []
        
        for play in enriched_plays:
            # Get tracking data for this play if available
            play_tracking = None
            if tracking_data is not None:
                mask = (
                    (tracking_data['game_id'] == int(play['game_id'])) &
                    (tracking_data['play_id'] == play['play_id'])
                )
                play_tracking = tracking_data[mask]
            
            scene = self.generate_description(play, play_tracking)
            results.append(scene)
        
        return results


# Example usage
if __name__ == "__main__":
    # Test with sample play data
    sample_play = {
        'game_id': '2023090700',
        'play_id': 101,
        'quarter': 1,
        'game_clock': '14:25',
        'down': 3,
        'yards_to_go': 3,
        'play_description': '(Shotgun) J.Goff pass incomplete deep right to J.Reynolds.',
        'play_type': 'Pass Incompletion',
        'scoring_play': False,
        'home_team': 'Kansas City Chiefs',
        'away_team': 'Detroit Lions',
        'stadium': 'GEHA Field at Arrowhead Stadium',
        'num_frames': 21,
    }
    
    generator = SceneGenerator()
    
    print("Generating scene description...")
    scene = generator.generate_description(sample_play)
    
    print(f"\nPlay {scene.play_id} Scene Description:")
    print(f"Camera: {scene.camera_angle}")
    print(f"Duration: {scene.duration_hint}s")
    print(f"Style hints: {', '.join(scene.style_hints)}")
    print(f"\nDescription:\n{scene.description}")
