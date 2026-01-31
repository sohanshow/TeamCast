"""
Generate video prompts for 2 plays - outputs to text file for manual Grok use.
"""

import os
import sys
import csv
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from enrichment.espn_client import ESPNClient
from enrichment.game_mapper import GameMapper
from enrichment.play_matcher import PlayMatcher
from generation.scene_gen import SceneGenerator

# Prompt prefix for All-22 coaching film style
PROMPT_PREFIX = """Hyper-realistic NFL football simulation, professional broadcast quality, bird's eye aerial camera view looking straight down at the football field from 50 yards above, 
showing complete view of all 22 players on the field at all times, green football field with white yard lines and hash marks clearly visible, 
players shown as distinct figures in team uniforms (one dark team, one light team), 
fixed overhead camera position with no movement or shake, clean tactical coaching film visualization, 
realistic stadium lighting, realistic player spacing and formation alignment, 
smooth player movements showing routes, blocking assignments, and defensive coverage, cinematic quality, """


def load_unique_plays(csv_path: str) -> list[dict]:
    """Load unique plays from CSV."""
    plays = {}
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = (row['game_id'], row['play_id'])
            if key not in plays:
                plays[key] = {
                    'game_id': row['game_id'],
                    'play_id': int(row['play_id']),
                    'absolute_yardline': int(float(row['absolute_yardline_number'])),
                    'play_direction': row['play_direction'],
                    'ball_land_x': float(row['ball_land_x']),
                    'ball_land_y': float(row['ball_land_y']),
                    'num_frames': int(row['num_frames_output']),
                }
    return list(plays.values())


def enhance_prompt(scene_description: str, style_hints: list[str] = None) -> str:
    """Enhance scene description with prompt prefix."""
    prompt_parts = [PROMPT_PREFIX]
    
    if style_hints:
        prompt_parts.append(", ".join(style_hints) + ", ")
    
    prompt_parts.append(scene_description)
    
    return "".join(prompt_parts)


def main():
    # Paths
    base_dir = os.path.dirname(__file__)
    data_path = os.path.join(base_dir, 'data/nfl-big-data-bowl-2026-prediction/test_input.csv')
    output_dir = os.path.join(base_dir, 'output')
    
    os.makedirs(output_dir, exist_ok=True)
    
    # Load plays
    print("=" * 60)
    print("STEP 1: Loading plays from test data")
    print("=" * 60)
    all_plays = load_unique_plays(data_path)
    print(f"Found {len(all_plays)} unique plays")
    
    # Select 4 plays with variety (different field positions)
    selected_plays = []
    for play in all_plays:
        if play['absolute_yardline'] > 80 and len(selected_plays) < 1:  # Red zone
            selected_plays.append(play)
        elif 50 <= play['absolute_yardline'] <= 60 and len(selected_plays) < 2:  # Midfield
            selected_plays.append(play)
        elif 30 <= play['absolute_yardline'] <= 40 and len(selected_plays) < 3:  # Own territory
            selected_plays.append(play)
        elif play['absolute_yardline'] < 25 and len(selected_plays) < 4:  # Deep own territory
            selected_plays.append(play)
    
    while len(selected_plays) < 4:
        for play in all_plays:
            if play not in selected_plays:
                selected_plays.append(play)
                break
    
    print(f"\nSelected 4 plays:")
    for i, play in enumerate(selected_plays):
        print(f"  {i+1}. Game {play['game_id']}, Play {play['play_id']} - Yardline {play['absolute_yardline']}")
    
    # Enrich plays
    print("\n" + "=" * 60)
    print("STEP 2: Enriching plays with ESPN data")
    print("=" * 60)
    
    espn_client = ESPNClient(cache_enabled=True)
    game_mapper = GameMapper(
        espn_client=espn_client,
        cache_file=os.path.join(output_dir, 'game_mappings.json')
    )
    play_matcher = PlayMatcher(
        espn_client=espn_client,
        game_mapper=game_mapper
    )
    
    enriched_plays = []
    for i, play in enumerate(selected_plays):
        print(f"\nEnriching play {i+1}/4: Game {play['game_id']}, Play {play['play_id']}...")
        enriched = play_matcher.match_play(
            game_id=play['game_id'],
            play_id=play['play_id'],
            absolute_yardline=play['absolute_yardline'],
            play_direction=play['play_direction'],
            ball_land_x=play['ball_land_x'],
            ball_land_y=play['ball_land_y'],
            num_frames=play['num_frames'],
            play_sequence_hint=i
        )
        if enriched:
            enriched_plays.append(enriched)
            print(f"  ✓ Enriched: {enriched.play_description[:80]}...")
        else:
            print(f"  ✗ Could not enrich play")
    
    if not enriched_plays:
        print("\nERROR: No plays were successfully enriched!")
        return
    
    # Generate scene descriptions
    print("\n" + "=" * 60)
    print("STEP 3: Generating tactical scene descriptions")
    print("=" * 60)
    
    scene_generator = SceneGenerator()
    scenes = []
    
    for i, play in enumerate(enriched_plays):
        print(f"\nGenerating scene {i+1}/{len(enriched_plays)}...")
        play_dict = {
            'game_id': play.game_id,
            'play_id': play.play_id,
            'quarter': play.quarter,
            'game_clock': play.game_clock,
            'down': play.down,
            'yards_to_go': play.yards_to_go,
            'play_description': play.play_description,
            'play_type': play.play_type,
            'home_team': play.home_team,
            'away_team': play.away_team,
            'stadium': play.stadium,
            'absolute_yardline': play.absolute_yardline,
            'play_direction': play.play_direction,
        }
        scene = scene_generator.generate_description(play_dict, tracking_df=None)
        scenes.append((play, scene))
        print(f"  ✓ Generated scene for play {play.play_id}")
    
    # Output prompts to file
    print("\n" + "=" * 60)
    print("STEP 4: Writing prompts to file")
    print("=" * 60)
    
    output_file = os.path.join(output_dir, 'grok_video_prompts.txt')
    
    with open(output_file, 'w') as f:
        f.write("=" * 80 + "\n")
        f.write("GROK VIDEO GENERATION PROMPTS\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("=" * 80 + "\n\n")
        f.write("Instructions:\n")
        f.write("1. Go to https://grok.x.ai or use the Grok app\n")
        f.write("2. Select 'Create Video' or use video generation\n")
        f.write("3. Copy and paste each prompt below\n")
        f.write("4. Recommended settings: 720p, 16:9 aspect ratio, 8 seconds\n")
        f.write("\n" + "=" * 80 + "\n\n")
        
        for i, (play, scene) in enumerate(scenes):
            style_hints = ['professional NFL broadcast', 'tactical coaching film', 'hyper realistic']
            full_prompt = enhance_prompt(scene.description, style_hints)
            
            f.write(f"{'='*80}\n")
            f.write(f"PROMPT {i+1}: Play {play.play_id} (Game {play.game_id})\n")
            f.write(f"{'='*80}\n\n")
            f.write(f"Play Info:\n")
            f.write(f"  - {play.home_team} vs {play.away_team}\n")
            f.write(f"  - Q{play.quarter} {play.game_clock}\n")
            f.write(f"  - {play.down} & {play.yards_to_go} at yardline {play.absolute_yardline}\n")
            f.write(f"  - Description: {play.play_description}\n\n")
            f.write(f"COPY THIS PROMPT:\n")
            f.write(f"{'-'*40}\n\n")
            f.write(f"{full_prompt}\n\n")
            f.write(f"{'-'*40}\n\n\n")
    
    print(f"\n✓ Prompts saved to: {output_file}")
    print(f"\nYou can now copy these prompts and paste them into Grok online.")
    
    # Also print to console
    print("\n" + "=" * 80)
    print("PROMPTS PREVIEW")
    print("=" * 80)
    
    for i, (play, scene) in enumerate(scenes):
        style_hints = ['professional NFL broadcast', 'tactical coaching film', 'hyper realistic']
        full_prompt = enhance_prompt(scene.description, style_hints)
        
        print(f"\n--- PROMPT {i+1} (Play {play.play_id}) ---")
        print(f"[{play.home_team} vs {play.away_team}, Q{play.quarter}]\n")
        print(full_prompt[:500] + "..." if len(full_prompt) > 500 else full_prompt)
        print()


if __name__ == "__main__":
    main()
