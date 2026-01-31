"""
NFL Play Video Generator Pipeline

Main orchestration module that:
1. Reads Big Data Bowl CSV tracking data
2. Enriches with ESPN play-by-play metadata
3. Generates scene descriptions using Gemini
4. Creates video clips using Veo
"""

import os
import sys
import pandas as pd
from typing import Optional
from dataclasses import asdict
from tqdm import tqdm
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'))

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from enrichment.espn_client import ESPNClient
from enrichment.game_mapper import GameMapper
from enrichment.play_matcher import PlayMatcher, EnrichedPlay
from generation.scene_gen import SceneGenerator, SceneDescription
from generation.video_gen import VideoGenerator, GeneratedVideo


class NFLPipeline:
    """Main pipeline for enriching and generating NFL play videos."""
    
    def __init__(
        self,
        data_dir: str,
        output_dir: str,
        cache_dir: Optional[str] = None
    ):
        """
        Initialize the pipeline.
        
        Args:
            data_dir: Directory containing Big Data Bowl CSV files
            output_dir: Directory for output files
            cache_dir: Optional directory for caching (defaults to output_dir)
        """
        self.data_dir = data_dir
        self.output_dir = output_dir
        self.cache_dir = cache_dir or output_dir
        
        # Ensure output directories exist
        os.makedirs(os.path.join(output_dir, 'enriched'), exist_ok=True)
        os.makedirs(os.path.join(output_dir, 'videos'), exist_ok=True)
        
        # Initialize components
        self.espn_client = ESPNClient(cache_enabled=True)
        self.game_mapper = GameMapper(
            espn_client=self.espn_client,
            cache_file=os.path.join(self.cache_dir, 'game_mappings.json')
        )
        self.play_matcher = PlayMatcher(
            espn_client=self.espn_client,
            game_mapper=self.game_mapper
        )
        
        # Initialize generation components
        self.scene_generator = SceneGenerator()
        self.video_generator = VideoGenerator(
            output_dir=os.path.join(output_dir, 'videos')
        )
    
    def load_tracking_data(self, filename: str) -> pd.DataFrame:
        """
        Load tracking data from CSV file.
        
        Args:
            filename: CSV filename (e.g., 'input_2023_w01.csv')
            
        Returns:
            DataFrame with tracking data
        """
        filepath = os.path.join(self.data_dir, 'train', filename)
        
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Tracking data file not found: {filepath}")
        
        df = pd.read_csv(filepath)
        print(f"Loaded {len(df)} rows from {filename}")
        return df
    
    def extract_unique_plays(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Extract unique plays from tracking data.
        
        Args:
            df: DataFrame with tracking data
            
        Returns:
            DataFrame with one row per unique play
        """
        # Group by game_id and play_id, take first row of each
        plays = df.groupby(['game_id', 'play_id']).agg({
            'absolute_yardline_number': 'first',
            'play_direction': 'first',
            'ball_land_x': 'first',
            'ball_land_y': 'first',
            'num_frames_output': 'first',
        }).reset_index()
        
        plays.columns = ['game_id', 'play_id', 'absolute_yardline', 'play_direction', 
                        'ball_land_x', 'ball_land_y', 'num_frames']
        
        print(f"Extracted {len(plays)} unique plays")
        return plays
    
    def enrich_plays(
        self,
        plays_df: pd.DataFrame,
        progress: bool = True
    ) -> pd.DataFrame:
        """
        Enrich plays with ESPN metadata.
        
        Args:
            plays_df: DataFrame with unique plays
            progress: Whether to show progress bar
            
        Returns:
            DataFrame with enriched play data
        """
        enriched_plays = []
        
        iterator = plays_df.iterrows()
        if progress:
            iterator = tqdm(iterator, total=len(plays_df), desc="Enriching plays")
        
        for idx, row in iterator:
            enriched = self.play_matcher.match_play(
                game_id=str(row['game_id']),
                play_id=int(row['play_id']),
                absolute_yardline=int(row['absolute_yardline']),
                play_direction=row['play_direction'],
                ball_land_x=float(row['ball_land_x']),
                ball_land_y=float(row['ball_land_y']),
                num_frames=int(row['num_frames']),
                play_sequence_hint=idx
            )
            
            if enriched:
                enriched_plays.append(asdict(enriched))
        
        result_df = pd.DataFrame(enriched_plays)
        print(f"Successfully enriched {len(result_df)} of {len(plays_df)} plays")
        return result_df
    
    def save_enriched_data(
        self,
        enriched_df: pd.DataFrame,
        output_filename: str
    ) -> str:
        """
        Save enriched data to CSV.
        
        Args:
            enriched_df: DataFrame with enriched plays
            output_filename: Output filename
            
        Returns:
            Path to saved file
        """
        output_path = os.path.join(self.output_dir, 'enriched', output_filename)
        enriched_df.to_csv(output_path, index=False)
        print(f"Saved enriched data to {output_path}")
        return output_path
    
    def process_week(
        self,
        week_num: int,
        year: int = 2023,
        max_plays: Optional[int] = None
    ) -> pd.DataFrame:
        """
        Process a full week of tracking data.
        
        Args:
            week_num: Week number (1-18)
            year: Season year
            max_plays: Optional limit on number of plays to process
            
        Returns:
            DataFrame with enriched plays
        """
        # Load tracking data
        filename = f"input_{year}_w{week_num:02d}.csv"
        df = self.load_tracking_data(filename)
        
        # Extract unique plays
        plays = self.extract_unique_plays(df)
        
        # Limit if requested
        if max_plays:
            plays = plays.head(max_plays)
            print(f"Limited to {max_plays} plays")
        
        # Enrich plays
        enriched = self.enrich_plays(plays)
        
        # Save results
        output_filename = f"enriched_{year}_w{week_num:02d}.csv"
        self.save_enriched_data(enriched, output_filename)
        
        return enriched
    
    def get_play_tracking_data(
        self,
        df: pd.DataFrame,
        game_id: str,
        play_id: int
    ) -> pd.DataFrame:
        """
        Get all tracking data for a specific play.
        
        Args:
            df: Full tracking DataFrame
            game_id: Game ID
            play_id: Play ID
            
        Returns:
            DataFrame with tracking data for the play
        """
        mask = (df['game_id'] == int(game_id)) & (df['play_id'] == play_id)
        return df[mask].copy()
    
    def format_tracking_for_prompt(
        self,
        tracking_df: pd.DataFrame
    ) -> str:
        """
        Format tracking data for use in Gemini prompts.
        
        Args:
            tracking_df: DataFrame with tracking data for a single play
            
        Returns:
            Formatted string describing player movements
        """
        # Group by player
        players = tracking_df.groupby('player_name')
        
        lines = []
        for player_name, player_data in players:
            player_data = player_data.sort_values('frame_id')
            
            # Get first and last positions
            first = player_data.iloc[0]
            last = player_data.iloc[-1]
            
            position = first['player_position']
            role = first['player_role']
            side = first['player_side']
            
            # Calculate movement
            dx = last['x'] - first['x']
            dy = last['y'] - first['y']
            
            # Describe movement
            if abs(dx) < 1 and abs(dy) < 1:
                movement = "stationary"
            else:
                direction = []
                if dx > 3:
                    direction.append("forward")
                elif dx < -3:
                    direction.append("backward")
                if dy > 3:
                    direction.append("left")
                elif dy < -3:
                    direction.append("right")
                movement = " and ".join(direction) if direction else "slight movement"
            
            lines.append(f"- {player_name} ({position}, {side} {role}): {movement}")
        
        return "\n".join(lines)
    
    def generate_scenes(
        self,
        enriched_df: pd.DataFrame,
        tracking_df: Optional[pd.DataFrame] = None,
        progress: bool = True
    ) -> list[SceneDescription]:
        """
        Generate scene descriptions for enriched plays.
        
        Args:
            enriched_df: DataFrame with enriched plays
            tracking_df: Optional tracking data for enhanced descriptions
            progress: Whether to show progress bar
            
        Returns:
            List of SceneDescription objects
        """
        scenes = []
        
        iterator = enriched_df.iterrows()
        if progress:
            iterator = tqdm(iterator, total=len(enriched_df), desc="Generating scenes")
        
        for _, play in iterator:
            play_dict = play.to_dict()
            
            # Get tracking data for this play if available
            play_tracking = None
            if tracking_df is not None:
                mask = (
                    (tracking_df['game_id'] == int(play['game_id'])) &
                    (tracking_df['play_id'] == play['play_id'])
                )
                play_tracking = tracking_df[mask]
            
            scene = self.scene_generator.generate_description(play_dict, play_tracking)
            scenes.append(scene)
        
        return scenes
    
    def generate_videos(
        self,
        scenes: list[SceneDescription],
        progress: bool = True
    ) -> list[GeneratedVideo]:
        """
        Generate videos from scene descriptions.
        
        Args:
            scenes: List of SceneDescription objects
            progress: Whether to show progress bar
            
        Returns:
            List of GeneratedVideo results
        """
        results = []
        
        iterator = scenes
        if progress:
            iterator = tqdm(scenes, desc="Generating videos")
        
        for scene in iterator:
            result = self.video_generator.generate_video(
                scene_description=scene.description,
                play_id=scene.play_id,
                game_id=scene.game_id,
                style_hints=scene.style_hints
            )
            results.append(result)
        
        return results
    
    def run_full_pipeline(
        self,
        week_num: int,
        year: int = 2023,
        max_plays: int = 5,
        generate_video: bool = True
    ) -> dict:
        """
        Run the full pipeline: load -> enrich -> scene gen -> video gen.
        
        Args:
            week_num: Week number (1-18)
            year: Season year
            max_plays: Maximum number of plays to process
            generate_video: Whether to attempt video generation
            
        Returns:
            Dict with results from each stage
        """
        results = {}
        
        # Step 1: Load data
        print("\n" + "="*60)
        print("STEP 1: Loading tracking data")
        print("="*60)
        filename = f"input_{year}_w{week_num:02d}.csv"
        tracking_df = self.load_tracking_data(filename)
        plays_df = self.extract_unique_plays(tracking_df)
        plays_df = plays_df.head(max_plays)
        results['plays_loaded'] = len(plays_df)
        
        # Step 2: Enrich with ESPN
        print("\n" + "="*60)
        print("STEP 2: Enriching with ESPN play-by-play")
        print("="*60)
        enriched_df = self.enrich_plays(plays_df)
        results['plays_enriched'] = len(enriched_df)
        
        # Save enriched data
        output_filename = f"enriched_{year}_w{week_num:02d}.csv"
        self.save_enriched_data(enriched_df, output_filename)
        
        # Step 3: Generate scene descriptions
        print("\n" + "="*60)
        print("STEP 3: Generating scene descriptions with Gemini")
        print("="*60)
        scenes = self.generate_scenes(enriched_df, tracking_df)
        results['scenes_generated'] = len(scenes)
        results['scenes'] = scenes
        
        # Step 4: Generate videos (if requested)
        if generate_video:
            print("\n" + "="*60)
            print("STEP 4: Generating videos with Veo")
            print("="*60)
            videos = self.generate_videos(scenes)
            results['videos_attempted'] = len(videos)
            results['videos_successful'] = sum(1 for v in videos if v.success)
            results['videos'] = videos
        
        return results


def main():
    """Main entry point for the pipeline."""
    import argparse
    
    parser = argparse.ArgumentParser(description='NFL Play Video Generator Pipeline')
    parser.add_argument('--data-dir', default='data/nfl-big-data-bowl-2026-prediction',
                       help='Directory containing Big Data Bowl data')
    parser.add_argument('--output-dir', default='output',
                       help='Directory for output files')
    parser.add_argument('--week', type=int, default=1,
                       help='Week number to process')
    parser.add_argument('--max-plays', type=int, default=5,
                       help='Maximum number of plays to process')
    parser.add_argument('--full', action='store_true',
                       help='Run full pipeline including video generation')
    parser.add_argument('--no-video', action='store_true',
                       help='Skip video generation')
    
    args = parser.parse_args()
    
    # Get absolute paths
    script_dir = os.path.dirname(os.path.dirname(__file__))
    data_dir = os.path.join(script_dir, args.data_dir)
    output_dir = os.path.join(script_dir, args.output_dir)
    
    # Initialize pipeline
    pipeline = NFLPipeline(
        data_dir=data_dir,
        output_dir=output_dir
    )
    
    if args.full:
        # Run full pipeline
        results = pipeline.run_full_pipeline(
            week_num=args.week,
            max_plays=args.max_plays,
            generate_video=not args.no_video
        )
        
        # Print summary
        print("\n" + "="*60)
        print("PIPELINE SUMMARY")
        print("="*60)
        print(f"Plays loaded: {results['plays_loaded']}")
        print(f"Plays enriched: {results['plays_enriched']}")
        print(f"Scenes generated: {results['scenes_generated']}")
        
        if 'videos_attempted' in results:
            print(f"Videos attempted: {results['videos_attempted']}")
            print(f"Videos successful: {results['videos_successful']}")
        
        # Print scene samples
        print("\n" + "="*60)
        print("SAMPLE SCENE DESCRIPTIONS")
        print("="*60)
        for scene in results['scenes'][:3]:
            print(f"\n--- Play {scene.play_id} ---")
            print(f"Camera: {scene.camera_angle}")
            print(f"Duration hint: {scene.duration_hint}s")
            print(f"Style: {', '.join(scene.style_hints)}")
            print(f"\n{scene.description}")
    else:
        # Just enrich (original behavior)
        enriched = pipeline.process_week(
            week_num=args.week,
            max_plays=args.max_plays
        )
        
        # Print sample results
        print("\n" + "="*60)
        print("Sample enriched plays:")
        print("="*60)
        
        for _, play in enriched.head(5).iterrows():
            print(f"\nPlay {play['play_id']} - Q{play['quarter']} {play['game_clock']}")
            print(f"  {play['down']}&{play['yards_to_go']} at yardline {play['absolute_yardline']}")
            print(f"  {play['play_description']}")
            print(f"  Confidence: {play['match_confidence']:.2f}")


if __name__ == "__main__":
    main()
