"""
Scene Description Generator using Gemini.

Converts NFL tracking data and play metadata into tactical scene descriptions
optimized for coaches and GMs analyzing plays. Uses All-22 and End Zone camera
perspectives standard in NFL film rooms.
"""

import os
from typing import Optional
from dataclasses import dataclass
import pandas as pd
import math

# Try to import google.generativeai
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("Warning: google-generativeai not installed. Scene generation will use templates only.")


@dataclass
class SceneDescription:
    """Generated tactical scene description for coaching analysis."""
    play_id: int
    game_id: str
    description: str
    camera_angle: str
    duration_hint: float  # Suggested video duration in seconds
    style_hints: list[str]
    formation_offense: str = ""  # Detected offensive formation/personnel
    formation_defense: str = ""  # Detected defensive alignment
    key_matchups: list[str] = None  # Notable matchups to watch
    
    def __post_init__(self):
        if self.key_matchups is None:
            self.key_matchups = []


# Coaching film camera angles - standard NFL film room perspectives
CAMERA_ANGLES = {
    # All-22 (Coaches Film) - elevated sideline view showing all players
    "Pass Reception": "All-22 elevated sideline view, 40 yards high, full field width visible, tracking routes and coverage",
    "Pass Incompletion": "All-22 elevated sideline view, showing route tree development and defensive coverage rotation",
    "Rush": "All-22 elevated sideline view, showing blocking scheme execution and running lanes",
    "Sack": "End Zone elevated view, showing pass protection breakdown and pass rush lanes",
    "Interception": "All-22 elevated sideline view, showing route concept vs coverage scheme and ball trajectory",
    "Touchdown": "All-22 elevated sideline view, showing the scoring play development with formation context",
    "Field Goal": "End Zone elevated view, behind the formation showing protection and kick trajectory",
    "Punt": "All-22 elevated sideline view, showing coverage unit spacing and return setup",
    "Kickoff": "All-22 elevated view from 50-yard line, showing full field coverage lanes",
    "default": "All-22 elevated sideline view, 40 yards high, full field visible",
}

# Tactical style hints for analysis - clean, professional look
STYLE_HINTS = {
    "pass_concept": ["clear route visualization", "coverage indicators", "pocket timing"],
    "run_scheme": ["blocking assignment clarity", "gap identification", "cutback lanes"],
    "pressure": ["blitz recognition", "protection adjustment", "hot route timing"],
    "coverage": ["zone landmarks", "man coverage brackets", "safety rotation"],
    "red_zone": ["compressed field spacing", "goal-line alignments", "fade windows"],
    "default": ["professional broadcast quality", "tactical clarity", "player identification"],
}

# Common offensive formations for recognition
OFFENSIVE_FORMATIONS = {
    "shotgun": "Shotgun",
    "pistol": "Pistol",
    "under center": "Under Center",
    "singleback": "Singleback",
    "i-form": "I-Formation",
    "empty": "Empty Backfield",
    "jumbo": "Jumbo Package",
    "wildcat": "Wildcat",
}

# Common defensive formations
DEFENSIVE_FORMATIONS = {
    "4-3": "4-3 Base",
    "3-4": "3-4 Base",
    "nickel": "Nickel",
    "dime": "Dime",
    "quarter": "Quarter",
    "goal line": "Goal Line",
    "46": "46 Defense",
}


class SceneGenerator:
    """Generates tactical scene descriptions from tracking data for coaching analysis."""
    
    PROMPT_TEMPLATE = '''You are an NFL film analyst creating a coaching film description for video generation.
The output will be used by coaches and GMs to analyze play development and make strategic decisions.

## Play Context
- **Game**: {away_team} at {home_team}
- **Field Position**: {yard_line} yard line
- **Situation**: Q{quarter}, {game_clock} | {down} & {yards_to_go}
- **Result**: {play_description}

## Pre-Snap Alignment (from tracking data)
{formation_analysis}

## Player Movement Data
{tracking_summary}

## Your Task
Generate a tactical scene description (80-120 words) for AI video generation that shows this play from an **All-22 coaching film perspective**.

The video must be useful for strategic analysis. Include:

1. **Pre-snap read**: Offensive formation, defensive alignment, key personnel groupings
2. **Post-snap keys**: Route concepts OR blocking scheme, defensive reaction/coverage shell
3. **Execution details**: Specific route depths, protection slides, gap assignments
4. **Result analysis**: Why the play succeeded/failed based on scheme vs execution

CRITICAL VISUAL REQUIREMENTS:
- Camera: {camera_angle}
- View must show ALL 22 players clearly from an elevated angle (like press box or blimp view)
- Players should be identifiable by position and jersey
- Field markings (yard lines, hash marks) must be visible for reference
- Clean broadcast-quality look, no dramatic effects or close-ups
- Style: Professional NFL Films coaching tape aesthetic

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
    
    def analyze_formation(self, tracking_df: pd.DataFrame) -> dict:
        """
        Analyze pre-snap formation from tracking data.
        
        Args:
            tracking_df: DataFrame with tracking data for a single play
            
        Returns:
            Dict with formation analysis
        """
        if tracking_df.empty:
            return {"offense": "Unknown", "defense": "Unknown", "personnel": "Unknown"}
        
        # Get pre-snap frame (frame_id closest to snap or first frame)
        pre_snap = tracking_df[tracking_df['frame_id'] == tracking_df['frame_id'].min()]
        
        # Separate offense and defense
        offense = pre_snap[pre_snap.get('club', '') == pre_snap.get('possession_team', '')]
        defense = pre_snap[pre_snap.get('club', '') != pre_snap.get('possession_team', '')]
        
        # Count positions for personnel grouping
        off_positions = offense['player_position'].value_counts() if 'player_position' in offense else {}
        def_positions = defense['player_position'].value_counts() if 'player_position' in defense else {}
        
        # Determine offensive personnel (e.g., 11, 12, 21, etc.)
        rb_count = off_positions.get('RB', 0) + off_positions.get('FB', 0)
        te_count = off_positions.get('TE', 0)
        wr_count = off_positions.get('WR', 0)
        personnel = f"{rb_count}{te_count} personnel ({wr_count} WR)"
        
        # Determine defensive front
        dl_count = sum(def_positions.get(pos, 0) for pos in ['DE', 'DT', 'NT', 'DL'])
        lb_count = sum(def_positions.get(pos, 0) for pos in ['ILB', 'OLB', 'MLB', 'LB'])
        db_count = sum(def_positions.get(pos, 0) for pos in ['CB', 'SS', 'FS', 'DB', 'S'])
        
        if db_count >= 6:
            def_formation = "Dime" if db_count >= 6 else "Nickel"
        elif dl_count == 4:
            def_formation = "4-3 Base" if lb_count == 3 else "4-2-5 Nickel"
        elif dl_count == 3:
            def_formation = "3-4 Base" if lb_count == 4 else "3-3-5 Nickel"
        else:
            def_formation = f"{dl_count}-{lb_count}-{db_count}"
        
        return {
            "offense": personnel,
            "defense": def_formation,
            "personnel": personnel,
            "off_positions": dict(off_positions) if hasattr(off_positions, 'items') else {},
            "def_positions": dict(def_positions) if hasattr(def_positions, 'items') else {},
        }
    
    def format_tracking_summary(
        self,
        tracking_df: pd.DataFrame,
        max_players: int = 11
    ) -> str:
        """
        Format tracking data into a tactical summary organized by unit.
        
        Args:
            tracking_df: DataFrame with tracking data for a single play
            max_players: Maximum number of players to include per unit
            
        Returns:
            Formatted string summarizing player movements tactically
        """
        if tracking_df.empty:
            return "Player tracking data not available."
        
        # Group by team/role
        offense_summary = []
        defense_summary = []
        
        players = tracking_df.groupby('player_name')
        
        for player_name, player_data in players:
            player_data = player_data.sort_values('frame_id')
            
            if player_data.empty:
                continue
            
            first = player_data.iloc[0]
            last = player_data.iloc[-1]
            
            position = first.get('player_position', 'Unknown')
            role = first.get('player_role', '')
            side = first.get('player_side', '')
            
            # Calculate tactical movement metrics
            dx = last['x'] - first['x']
            dy = last['y'] - first['y']
            total_distance = math.sqrt(dx**2 + dy**2)
            
            # Get max speed and acceleration
            max_speed = player_data['s'].max() if 's' in player_data else 0
            
            # Determine route/assignment description
            if position in ['WR', 'TE', 'RB', 'FB']:
                # Route description for skill players
                if abs(dy) < 3 and dx > 5:
                    route_type = f"vertical stem {dx:.0f} yards"
                elif abs(dy) > 5 and dx > 5:
                    route_type = f"{'out' if dy > 0 else 'in'} route, {dx:.0f}x{abs(dy):.0f}"
                elif dx < -2:
                    route_type = "backfield release/swing"
                else:
                    route_type = f"short route, {total_distance:.0f} yard depth"
                
                offense_summary.append(
                    f"- {position} #{player_name.split()[-1] if player_name else 'Unknown'}: {route_type} (max {max_speed:.1f} mph)"
                )
            elif position in ['QB']:
                if dx < -3:
                    action = f"dropback {abs(dx):.0f} yards"
                elif dx > 3:
                    action = f"rollout {'right' if dy > 0 else 'left'}"
                else:
                    action = "pocket presence"
                offense_summary.append(f"- QB: {action}")
            elif position in ['T', 'G', 'C', 'OL']:
                # O-line assignment
                if dx > 2:
                    block_type = "drive block / pull"
                elif abs(dy) > 2:
                    block_type = f"{'reach' if dy > 0 else 'cutoff'} block"
                else:
                    block_type = "pass protection set"
                offense_summary.append(f"- {side} {position}: {block_type}")
            elif position in ['CB', 'SS', 'FS', 'S', 'DB']:
                # DB coverage
                if max_speed > 7:
                    coverage = "trail coverage / recovery"
                elif total_distance > 10:
                    coverage = f"zone rotation {total_distance:.0f} yards"
                else:
                    coverage = "zone landmark / bail technique"
                defense_summary.append(f"- {position}: {coverage}")
            elif position in ['DE', 'DT', 'NT', 'DL', 'OLB', 'ILB', 'MLB', 'LB']:
                # Front 7 assignment
                if dx > 3:
                    assignment = f"pass rush, {dx:.0f} yard penetration"
                elif abs(dy) > 3:
                    assignment = f"{'contain' if position in ['DE', 'OLB'] else 'pursuit'}"
                else:
                    assignment = "gap control / read"
                defense_summary.append(f"- {position}: {assignment}")
        
        result_parts = []
        if offense_summary:
            result_parts.append("**Offense:**\n" + "\n".join(offense_summary[:6]))
        if defense_summary:
            result_parts.append("**Defense:**\n" + "\n".join(defense_summary[:5]))
        
        return "\n\n".join(result_parts) if result_parts else "Player tracking data not available."
    
    def get_camera_angle(self, play_type: str, enriched_play: dict = None) -> str:
        """
        Get coaching film camera angle for play type.
        
        Args:
            play_type: Type of play
            enriched_play: Optional enriched play data for context
            
        Returns:
            Camera angle description optimized for tactical analysis
        """
        base_angle = CAMERA_ANGLES.get(play_type, CAMERA_ANGLES["default"])
        
        # Add field position context if available
        if enriched_play:
            yard_line = enriched_play.get('absolute_yard_line', 50)
            if yard_line <= 20:
                base_angle += ", red zone framing with goal line visible"
            elif yard_line >= 80:
                base_angle += ", backed up framing showing field position"
        
        return base_angle
    
    def get_style_hints(self, enriched_play: dict) -> list[str]:
        """
        Get tactical style hints based on play context for coaching analysis.
        
        Returns hints that ensure the video is useful for strategic review.
        """
        hints = list(STYLE_HINTS["default"])  # Start with base coaching film quality
        
        play_desc = enriched_play.get('play_description', '').lower()
        play_type = enriched_play.get('play_type', '')
        
        # Add play-type specific hints
        if 'Pass' in play_type:
            hints.extend(STYLE_HINTS["pass_concept"])
        elif 'Rush' in play_type:
            hints.extend(STYLE_HINTS["run_scheme"])
        
        # Pressure situations
        if enriched_play.get('down') == 3 or enriched_play.get('down') == 4:
            hints.extend(STYLE_HINTS["pressure"])
        
        # Red zone
        yard_line = enriched_play.get('absolute_yard_line', 50)
        if yard_line <= 20:
            hints.extend(STYLE_HINTS["red_zone"])
        
        # Coverage indicators for pass plays
        if 'pass' in play_desc:
            hints.extend(STYLE_HINTS["coverage"])
        
        # Remove duplicates and limit
        seen = set()
        unique_hints = []
        for hint in hints:
            if hint not in seen:
                seen.add(hint)
                unique_hints.append(hint)
        
        return unique_hints[:6]
    
    def generate_template_description(
        self, 
        enriched_play: dict, 
        tracking_summary: str,
        formation_analysis: dict = None
    ) -> str:
        """
        Generate a tactical scene description using templates (no Gemini).
        Optimized for coaching film analysis.
        
        Args:
            enriched_play: Enriched play data dict
            tracking_summary: Formatted tracking data
            formation_analysis: Pre-snap formation analysis
            
        Returns:
            Tactical template-based scene description
        """
        play_type = enriched_play.get('play_type', 'Unknown')
        down = enriched_play.get('down', 0)
        yards = enriched_play.get('yards_to_go', 0)
        quarter = enriched_play.get('quarter', 1)
        clock = enriched_play.get('game_clock', '15:00')
        yard_line = enriched_play.get('absolute_yard_line', 50)
        desc = enriched_play.get('play_description', '')
        
        # Get formation info
        off_formation = formation_analysis.get('offense', '11 personnel') if formation_analysis else '11 personnel'
        def_formation = formation_analysis.get('defense', 'Base defense') if formation_analysis else 'Base defense'
        
        # Build tactical description
        situation = f"All-22 coaching film view. Q{quarter} {clock}, {down}&{yards} at the {yard_line}-yard line."
        
        # Pre-snap read
        pre_snap = f"Pre-snap: Offense in {off_formation}, defense shows {def_formation}."
        
        # Play development based on type
        if 'Pass' in play_type:
            if 'Incompletion' in play_type:
                development = (
                    "Post-snap: QB in shotgun, 5-step drop. Route concept develops with receivers "
                    "working against coverage. Pass protection holds initially. Ball released to "
                    "intended target but pass falls incomplete - either coverage disruption or "
                    "ball placement issue visible on film."
                )
            elif 'Reception' in play_type or 'Complete' in play_type.lower():
                development = (
                    "Post-snap: QB drop, eyes scanning field. Route combination creates separation. "
                    "Ball delivered on time to receiver in window. Catch made, YAC opportunity develops. "
                    "Key teaching point: route timing vs coverage leverage."
                )
            else:
                development = (
                    "Post-snap: Passing play develops. Protection scheme vs rush, route concept vs coverage. "
                    "Ball trajectory and catch point visible for analysis."
                )
        elif 'Rush' in play_type:
            development = (
                "Post-snap: Run blocking scheme initiates. O-line creates movement at point of attack. "
                "Running back reads blocks, makes cut decision. Gap assignment execution visible. "
                "Defensive pursuit angles and tackle point for film study."
            )
        elif 'Sack' in play_type:
            development = (
                "Post-snap: Pass protection breakdown. Rush lane opens, QB under pressure. "
                "Pocket collapses - key coaching point on protection assignment or technique failure."
            )
        else:
            development = f"Post-snap: Play develops. {desc}"
        
        camera_note = (
            "Camera: Elevated All-22 sideline view, 40 yards high, showing all players, "
            "field markings visible, clean broadcast quality for tactical analysis."
        )
        
        return f"{situation} {pre_snap} {development} {camera_note}"
    
    def generate_description(
        self,
        enriched_play: dict,
        tracking_df: Optional[pd.DataFrame] = None
    ) -> SceneDescription:
        """
        Generate a tactical scene description for coaching analysis.
        
        Args:
            enriched_play: Enriched play data dict
            tracking_df: Optional tracking data DataFrame
            
        Returns:
            SceneDescription with tactical content for coaches/GMs
        """
        # Analyze formation from tracking data
        formation_analysis = {"offense": "Unknown", "defense": "Unknown"}
        if tracking_df is not None and not tracking_df.empty:
            formation_analysis = self.analyze_formation(tracking_df)
        
        # Format tracking summary tactically
        tracking_summary = "Player tracking data not available."
        if tracking_df is not None and not tracking_df.empty:
            tracking_summary = self.format_tracking_summary(tracking_df)
        
        # Format formation analysis for prompt
        formation_text = (
            f"- Offensive Personnel: {formation_analysis.get('offense', 'Unknown')}\n"
            f"- Defensive Front: {formation_analysis.get('defense', 'Unknown')}"
        )
        
        # Get camera angle and style hints for tactical view
        play_type = enriched_play.get('play_type', 'Unknown')
        camera_angle = self.get_camera_angle(play_type, enriched_play)
        style_hints = self.get_style_hints(enriched_play)
        
        # Calculate yard line for field position context
        yard_line = enriched_play.get('absolute_yard_line', enriched_play.get('yard_line', 50))
        
        # Generate description
        if self.model:
            # Use Gemini for detailed tactical description
            prompt = self.PROMPT_TEMPLATE.format(
                away_team=enriched_play.get('away_team', 'Away'),
                home_team=enriched_play.get('home_team', 'Home'),
                yard_line=yard_line,
                quarter=enriched_play.get('quarter', 1),
                game_clock=enriched_play.get('game_clock', '15:00'),
                down=enriched_play.get('down', 1),
                yards_to_go=enriched_play.get('yards_to_go', 10),
                play_description=enriched_play.get('play_description', ''),
                formation_analysis=formation_text,
                tracking_summary=tracking_summary,
                camera_angle=camera_angle,
            )
            
            try:
                response = self.model.generate_content(prompt)
                description = response.text.strip()
            except Exception as e:
                print(f"Gemini error: {e}")
                description = self.generate_template_description(
                    enriched_play, tracking_summary, formation_analysis
                )
        else:
            # Use template for tactical description
            description = self.generate_template_description(
                enriched_play, tracking_summary, formation_analysis
            )
        
        # Calculate duration - longer for complex plays
        num_frames = enriched_play.get('num_frames', 21)
        # 5-8 seconds gives time for pre-snap read + play development
        duration_hint = min(8.0, max(5.0, num_frames / 10 * 2.5))
        
        return SceneDescription(
            play_id=enriched_play.get('play_id', 0),
            game_id=str(enriched_play.get('game_id', '')),
            description=description,
            camera_angle=camera_angle,
            duration_hint=duration_hint,
            style_hints=style_hints,
            formation_offense=formation_analysis.get('offense', ''),
            formation_defense=formation_analysis.get('defense', ''),
            key_matchups=[],
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
    # Test with sample play data - tactical coaching analysis
    sample_play = {
        'game_id': '2023090700',
        'play_id': 101,
        'quarter': 1,
        'game_clock': '14:25',
        'down': 3,
        'yards_to_go': 3,
        'absolute_yard_line': 32,
        'play_description': '(Shotgun) J.Goff pass incomplete deep right to J.Reynolds.',
        'play_type': 'Pass Incompletion',
        'scoring_play': False,
        'home_team': 'Kansas City Chiefs',
        'away_team': 'Detroit Lions',
        'stadium': 'GEHA Field at Arrowhead Stadium',
        'num_frames': 21,
    }
    
    generator = SceneGenerator()
    
    print("=" * 70)
    print("TACTICAL SCENE GENERATION - Coaching Film Analysis")
    print("=" * 70)
    print(f"\nGenerating All-22 coaching film description...")
    
    scene = generator.generate_description(sample_play)
    
    print(f"\n{'=' * 70}")
    print(f"Play {scene.play_id} - Coaching Film Description")
    print(f"{'=' * 70}")
    print(f"\nCamera Setup: {scene.camera_angle}")
    print(f"Duration: {scene.duration_hint}s")
    print(f"Formation (Off): {scene.formation_offense}")
    print(f"Formation (Def): {scene.formation_defense}")
    print(f"\nStyle parameters: {', '.join(scene.style_hints)}")
    print(f"\n{'=' * 70}")
    print("SCENE DESCRIPTION (for video generation):")
    print(f"{'=' * 70}")
    print(f"\n{scene.description}")
    print(f"\n{'=' * 70}")
    print("Note: This description is optimized for All-22 coaching film view")
    print("suitable for GM/coach strategic analysis during games.")
    print(f"{'=' * 70}")
