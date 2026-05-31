"""
Gesture Mapper Utility

Provides gesture equivalence mappings and default fallbacks for character gestures.
This ensures backward compatibility when lesson data uses old/different gesture codes.
"""
from __future__ import annotations

# Gesture equivalence mappings per character
# Maps old/alternative gesture names to actual component prop values
GESTURE_EQUIVALENCES: dict[str, dict[str, any]] = {
    'liruf': {
        'default': 'happy',
        'mappings': {
            # Actual gestures (DinoCharacter moods)
            'happy': 'happy',
            'sad': 'sad',
            'excited': 'excited',
            'thinking': 'thinking',
            'shocked': 'shocked',
            # Spanish equivalents
            'feliz': 'happy',
            'triste': 'sad',
            'emocionado': 'excited',
            'pensando': 'thinking',
            'sorprendido': 'shocked',
            # Common alternatives/fallbacks
            'neutral': 'happy',
            'surprised': 'shocked',
            'alegre': 'happy',
            'contento': 'happy',
        }
    },
    'dina': {
        'default': 'happy',
        'mappings': {
            # Actual gestures (DinaCharacter expressions)
            'neutral': 'neutral',
            'happy': 'happy',
            'surprised': 'surprised',
            'wink': 'wink',
            # Spanish equivalents
            'feliz': 'happy',
            'sorprendida': 'surprised',
            'guiño': 'wink',
            # Common alternatives/fallbacks
            'excited': 'happy',
            'alegre': 'happy',
            'shocked': 'surprised',
            'sorprendido': 'surprised',
        }
    },
    'dr_rho': {
        'default': 'wise',
        'mappings': {
            # Actual gestures (DrRhoCharacter moods)
            'neutral': 'neutral',
            'wise': 'wise',
            'mysterious': 'mysterious',
            'explaining': 'explaining',
            'surprised': 'surprised',
            # Spanish equivalents
            'sabio': 'wise',
            'misterioso': 'mysterious',
            'explicando': 'explaining',
            'sorprendido': 'surprised',
            # Common alternatives/fallbacks
            'happy': 'wise',
            'thinking': 'explaining',
            'shocked': 'surprised',
        }
    },
    'zara_vex': {
        'default': 'happy',
        'mappings': {
            # Actual gestures (ZaraVexCharacter moods)
            'neutral': 'neutral',
            'happy': 'happy',
            'flirty': 'flirty',
            'curious': 'curious',
            'excited': 'excited',
            # Spanish equivalents
            'feliz': 'happy',
            'coqueta': 'flirty',
            'curiosa': 'curious',
            'emocionada': 'excited',
            # Common alternatives/fallbacks
            'alegre': 'happy',
            'thinking': 'curious',
            'surprised': 'curious',
        }
    }
}


def normalize_gesture(character_code: str, raw_gesture: str | None) -> str:
    """
    Normalize a gesture code to match the character component's expected prop value.
    
    Args:
        character_code: The character code (e.g., 'liruf', 'dina', 'dr_rho', 'zara_vex')
        raw_gesture: The raw gesture code from the database or lesson data
        
    Returns:
        The normalized gesture code that matches the component's prop definition,
        or the default gesture for the character if no mapping is found.
        
    Examples:
        >>> normalize_gesture('liruf', 'feliz')
        'happy'
        >>> normalize_gesture('dina', 'sorprendida')
        'surprised'
        >>> normalize_gesture('dr_rho', 'unknown_gesture')
        'wise'
    """
    # Normalize character code
    char_code = character_code.lower().strip()

    # Handle None or empty gesture
    if not raw_gesture:
        return GESTURE_EQUIVALENCES.get(char_code, {}).get('default', 'happy')

    # Normalize gesture code
    gesture = raw_gesture.lower().strip()

    # Get character's mapping
    char_mapping = GESTURE_EQUIVALENCES.get(char_code)
    if not char_mapping:
        return 'happy'  # Ultimate fallback

    # Try to find mapping
    normalized = char_mapping.get('mappings', {}).get(gesture)

    # Return mapped gesture or default
    return normalized if normalized else char_mapping.get('default', 'happy')


def get_available_gestures(character_code: str) -> list[str]:
    """
    Get the list of valid gestures for a character.
    
    Args:
        character_code: The character code
        
    Returns:
        List of valid gesture codes for the character
    """
    char_code = character_code.lower().strip()
    char_mapping = GESTURE_EQUIVALENCES.get(char_code, {})
    mappings = char_mapping.get('mappings', {})

    # Get unique actual gesture values (not the keys)
    actual_gestures = set(mappings.values())
    return sorted(list(actual_gestures))
