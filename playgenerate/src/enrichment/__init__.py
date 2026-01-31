# Imports are done lazily to avoid circular imports during development
__all__ = ['ESPNClient', 'GameMapper', 'PlayMatcher']

def __getattr__(name):
    if name == 'ESPNClient':
        from .espn_client import ESPNClient
        return ESPNClient
    elif name == 'GameMapper':
        from .game_mapper import GameMapper
        return GameMapper
    elif name == 'PlayMatcher':
        from .play_matcher import PlayMatcher
        return PlayMatcher
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
