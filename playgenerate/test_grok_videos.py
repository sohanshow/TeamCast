"""
Test Grok Imagine video generation with 2 plays.
"""

import os
import sys
import csv
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from enrichment.espn_client import ESPNClient
from enrichment.game_mapper import GameMapper
from enrichment.play_matcher import PlayMatcher
from generation.scene_gen import SceneGenerator
from generation.video_gen import VideoGenerator, VideoConfig

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


def main():
    # Paths
    base_dir = os.path.dirname(__file__)
    data_path = os.path.join(base_dir, 'data/nfl-big-data-bowl-2026-prediction/test_input.csv')
    output_dir = os.path.join(base_dir, 'output')
    
    # Ensure output directories exist
    os.makedirs(os.path.join(output_dir, 'videos_grok'), exist_ok=True)
    
    # Load plays
    print("=" * 60)
    print("STEP 1: Loading plays from test data")
    print("=" * 60)
    all_plays = load_unique_plays(data_path)
    print(f"Found {len(all_plays)} unique plays")
    
    # Select 2 plays for testing
    selected_plays = []
    for play in all_plays:
        if play['absolute_yardline'] > 70 and len(selected_plays) < 1:  # Red zone
            selected_plays.append(play)
        elif 40 <= play['absolute_yardline'] <= 60 and len(selected_plays) < 2:  # Midfield
            selected_plays.append(play)
    
    # If we don't have 2 yet, grab first available
    while len(selected_plays) < 2:
        for play in all_plays:
            if play not in selected_plays:
                selected_plays.append(play)
                break
    
    print(f"\nSelected 2 plays for Grok video generation:")
    for i, play in enumerate(selected_plays):
        print(f"  {i+1}. Game {play['game_id']}, Play {play['play_id']} - Yardline {play['absolute_yardline']}")
    
    # Initialize enrichment components
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
        print(f"\nEnriching play {i+1}/2: Game {play['game_id']}, Play {play['play_id']}...")
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
            print(f"    Quarter: {enriched.quarter}, Clock: {enriched.game_clock}")
            print(f"    {enriched.home_team} vs {enriched.away_team}")
        else:
            print(f"  ✗ Could not enrich play")
    
    if not enriched_plays:
        print("\nERROR: No plays were successfully enriched!")
        return
    
    print(f"\nSuccessfully enriched {len(enriched_plays)} plays")
    
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
        scenes.append(scene)
        print(f"  ✓ Generated scene for play {play.play_id}")
        print(f"    Camera: {scene.camera_angle}")
    
    # Generate videos with Grok Imagine
    print("\n" + "=" * 60)
    print("STEP 4: Generating videos with GROK IMAGINE")
    print("=" * 60)
    print("Model: grok-imagine-video")
    print("Resolution: 720p")
    print("Duration: 8 seconds")
    print("Aspect ratio: 16:9")
    
    video_generator = VideoGenerator(
        output_dir=os.path.join(output_dir, 'videos_grok')
    )
    
    # Check status
    status = video_generator.get_status()
    print(f"\nVideo generator status:")
    for key, value in status.items():
        print(f"  {key}: {value}")
    
    if not status['grok_client_initialized']:
        print("\nERROR: Grok client not initialized. Check XAI_API_KEY.")
        return
    
    # Grok config - best quality settings
    config = VideoConfig(
        provider="grok",
        aspect_ratio="16:9",
        resolution="720p",
        duration=8,
        output_format="mp4"
    )
    
    results = []
    for i, scene in enumerate(scenes):
        print(f"\n{'='*40}")
        print(f"Generating video {i+1}/{len(scenes)} with Grok")
        print(f"Play: {scene.game_id} - {scene.play_id}")
        print(f"{'='*40}")
        
        result = video_generator.generate_video(
            scene_description=scene.description,
            play_id=scene.play_id,
            game_id=scene.game_id,
            config=config,
            style_hints=['professional NFL broadcast', 'tactical coaching film', 'hyper realistic']
        )
        results.append(result)
        
        if result.success:
            print(f"\n✓ SUCCESS: Video saved to {result.video_path}")
            print(f"  Generation time: {result.generation_time_seconds:.1f}s")
        else:
            print(f"\n✗ FAILED: {result.error_message}")
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    successful = [r for r in results if r.success]
    print(f"Videos generated: {len(successful)}/{len(results)}")
    print(f"\nSuccessful videos saved to: {os.path.join(output_dir, 'videos_grok')}/")
    for r in successful:
        print(f"  - {os.path.basename(r.video_path)}")


if __name__ == "__main__":
    main()
