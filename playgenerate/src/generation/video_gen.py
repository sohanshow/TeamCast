"""
Video Generator using Google Veo 3.1.

Generates AI video clips from scene descriptions using the Veo API
through Google AI Studio.
"""

import os
import time
from typing import Optional
from dataclasses import dataclass
from pathlib import Path

# Try to import google.genai for Veo 3.1
try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    print("Warning: google-genai not installed. Video generation unavailable.")
    print("Install with: pip install google-genai")


@dataclass
class GeneratedVideo:
    """Result of video generation."""
    play_id: int
    game_id: str
    video_path: Optional[str]
    duration_seconds: float
    prompt_used: str
    generation_time_seconds: float
    success: bool
    error_message: Optional[str] = None


@dataclass
class VideoConfig:
    """Configuration for video generation."""
    aspect_ratio: str = "16:9"  # or "9:16" for vertical
    resolution: str = "1080p"  # 720p or 1080p (1080p for highest quality)
    output_format: str = "mp4"


class VideoGenerator:
    """Generates tactical coaching film videos from scene descriptions using Veo 3.1."""
    
    # Veo prompt prefix for All-22 coaching film style - optimized for GM/coach analysis
    PROMPT_PREFIX = """High quality football simulation, hyper-realistic physics and player movement, bird's eye aerial camera view looking straight down at the football field from 50 yards above, 
showing complete view of all 22 players on the field at all times, green football field with white yard lines and hash marks clearly visible, 
players shown as distinct figures in generic team uniforms (one dark team, one light team) without logos, 
fixed overhead camera position with no movement or shake, clean tactical X's and O's style visualization, 
realistic lighting, realistic player spacing and formation alignment, 
smooth player movements showing routes, blocking assignments, and defensive coverage, """
    
    # Negative prompt to avoid issues that hurt tactical analysis
    NEGATIVE_PROMPT = """text, logos, watermarks, distorted bodies, low quality, glitchy, 
ground level camera, sideline angle, close-up shots, player faces, crowd shots, 
dramatic angles, shaky camera, handheld footage, cinematic effects, slow motion, 
celebration shots, highlight reel style, lens flare, motion blur, 
obstructed view, missing players, first person view, helmet cam, end zone camera"""
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        output_dir: str = "output/videos",
    ):
        """
        Initialize the video generator.
        
        Args:
            api_key: Google AI API key (uses GOOGLE_API_KEY env var if not provided)
            output_dir: Directory to save generated videos
        """
        self.api_key = api_key or os.environ.get("GOOGLE_API_KEY")
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize the Veo client."""
        if not GENAI_AVAILABLE:
            print("Warning: google-genai not installed. Video generation unavailable.")
            return
            
        if not self.api_key:
            print("Warning: No GOOGLE_API_KEY set. Video generation unavailable.")
            return
            
        try:
            # Initialize the client with API key
            self.client = genai.Client(api_key=self.api_key)
            print("Veo 3.1 client initialized successfully")
        except Exception as e:
            print(f"Warning: Could not initialize Veo client: {e}")
            self.client = None
    
    def _enhance_prompt(self, scene_description: str, style_hints: list[str] = None) -> str:
        """
        Enhance a scene description with Veo-optimized prompts.
        
        Args:
            scene_description: Base scene description
            style_hints: Optional style hints to incorporate
            
        Returns:
            Enhanced prompt for Veo
        """
        prompt_parts = [self.PROMPT_PREFIX]
        
        # Add style hints
        if style_hints:
            prompt_parts.append(", ".join(style_hints) + ", ")
        
        # Add the scene description
        prompt_parts.append(scene_description)
        
        # Combine and truncate to Veo's limit (1000 chars recommended)
        full_prompt = "".join(prompt_parts)
        if len(full_prompt) > 950:
            full_prompt = full_prompt[:950] + "..."
        
        return full_prompt
    
    def generate_video(
        self,
        scene_description: str,
        play_id: int,
        game_id: str,
        config: Optional[VideoConfig] = None,
        style_hints: list[str] = None
    ) -> GeneratedVideo:
        """
        Generate a video from a scene description using Veo 3.1.
        
        Args:
            scene_description: Text description of the scene
            play_id: Play ID for naming the output
            game_id: Game ID for naming the output
            config: Video configuration options
            style_hints: Optional style hints
            
        Returns:
            GeneratedVideo result
        """
        config = config or VideoConfig()
        start_time = time.time()
        
        # Enhance the prompt
        enhanced_prompt = self._enhance_prompt(scene_description, style_hints)
        
        # Output path
        output_filename = f"play_{game_id}_{play_id}.{config.output_format}"
        output_path = self.output_dir / output_filename
        
        # Check if client is available
        if not GENAI_AVAILABLE or not self.client:
            return GeneratedVideo(
                play_id=play_id,
                game_id=game_id,
                video_path=None,
                duration_seconds=0,
                prompt_used=enhanced_prompt,
                generation_time_seconds=time.time() - start_time,
                success=False,
                error_message="Veo client not initialized. Check GOOGLE_API_KEY and google-genai installation."
            )
        
        try:
            print(f"[Veo 3.1] Starting video generation for play {play_id}...")
            print(f"  Prompt: {enhanced_prompt[:100]}...")
            
            # Start video generation with Veo 3.1 (fast preview model)
            operation = self.client.models.generate_videos(
                model="veo-3.1-fast-generate-preview",
                prompt=enhanced_prompt,
                config=types.GenerateVideosConfig(
                    negative_prompt=self.NEGATIVE_PROMPT,
                    aspect_ratio=config.aspect_ratio,
                    resolution=config.resolution,
                ),
            )
            
            # Poll for completion
            poll_count = 0
            max_polls = 30  # Max 10 minutes (30 * 20s)
            
            while not operation.done:
                poll_count += 1
                elapsed = time.time() - start_time
                print(f"  Waiting for video... ({elapsed:.0f}s elapsed, poll {poll_count})")
                
                if poll_count >= max_polls:
                    raise TimeoutError("Video generation timed out after 10 minutes")
                
                time.sleep(20)
                operation = self.client.operations.get(operation)
            
            # Check for errors in response
            if not operation.response or not operation.response.generated_videos:
                raise RuntimeError("No video generated in response")
            
            # Download and save the video
            generated_video = operation.response.generated_videos[0]
            self.client.files.download(file=generated_video.video)
            generated_video.video.save(str(output_path))
            
            generation_time = time.time() - start_time
            print(f"  Video saved to {output_path} ({generation_time:.1f}s)")
            
            return GeneratedVideo(
                play_id=play_id,
                game_id=game_id,
                video_path=str(output_path),
                duration_seconds=8.0,  # Veo generates ~8s videos
                prompt_used=enhanced_prompt,
                generation_time_seconds=generation_time,
                success=True,
                error_message=None
            )
            
        except Exception as e:
            error_msg = str(e)
            print(f"  Error: {error_msg}")
            
            return GeneratedVideo(
                play_id=play_id,
                game_id=game_id,
                video_path=None,
                duration_seconds=0,
                prompt_used=enhanced_prompt,
                generation_time_seconds=time.time() - start_time,
                success=False,
                error_message=error_msg
            )
    
    def generate_batch(
        self,
        scenes: list[dict],
        config: Optional[VideoConfig] = None
    ) -> list[GeneratedVideo]:
        """
        Generate videos for multiple scenes.
        
        Args:
            scenes: List of dicts with keys: description, play_id, game_id, style_hints
            config: Video configuration
            
        Returns:
            List of GeneratedVideo results
        """
        results = []
        
        for i, scene in enumerate(scenes):
            print(f"\n[Batch] Generating video {i+1}/{len(scenes)}")
            
            result = self.generate_video(
                scene_description=scene['description'],
                play_id=scene['play_id'],
                game_id=scene['game_id'],
                config=config,
                style_hints=scene.get('style_hints', [])
            )
            results.append(result)
            
            # Rate limiting between generations
            if result.success and i < len(scenes) - 1:
                print("  Waiting 5s before next generation...")
                time.sleep(5)
        
        return results
    
    def get_status(self) -> dict:
        """Get the status of the video generator."""
        return {
            "genai_available": GENAI_AVAILABLE,
            "client_initialized": self.client is not None,
            "api_key_set": self.api_key is not None,
            "output_dir": str(self.output_dir),
            "model": "veo-3.1-fast-generate-preview",
        }


# Example usage
if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    
    # Create generator
    generator = VideoGenerator(output_dir="../../output/videos")
    
    # Print status
    print("Video Generator Status:")
    status = generator.get_status()
    for key, value in status.items():
        print(f"  {key}: {value}")
    
    # Test with sample scene - tactical coaching film style
    sample_scene = {
        'description': '''All-22 coaching film view. Q1 14:25, 3rd and 3 at the 32-yard line. 
        Pre-snap: Offense in 11 personnel (3 WR), defense shows Nickel with single-high safety.
        Post-snap: QB in shotgun, 5-step drop. Route concept: deep out/comeback combination 
        to the boundary side. X receiver runs 15-yard comeback, Z on deep over. Protection 
        slides left, RB checks backside rusher. Coverage rotates to Cover-3 post-snap.
        Ball released to X receiver on comeback - pass incomplete, CB in trail coverage 
        with good leverage.''',
        'play_id': 101,
        'game_id': '2023090700',
        'style_hints': ['professional broadcast quality', 'tactical clarity']
    }
    
    print("\n\nTest video generation:")
    result = generator.generate_video(
        scene_description=sample_scene['description'],
        play_id=sample_scene['play_id'],
        game_id=sample_scene['game_id'],
        style_hints=sample_scene['style_hints']
    )
    
    print(f"\nResult:")
    print(f"  Success: {result.success}")
    print(f"  Video path: {result.video_path}")
    print(f"  Generation time: {result.generation_time_seconds:.2f}s")
    if result.error_message:
        print(f"  Error: {result.error_message}")
