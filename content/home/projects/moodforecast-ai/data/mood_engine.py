"""Rule-based mood scoring engine with psychological rationale."""
# excerpt from backend/app/services/mood_engine.py

def calculate_mood_score(condition: str, temperature_c: float, humidity: float) -> int:
    """Calculate mood score (0-100) from weather parameters."""
    score = 65  # neutral baseline

    # Condition deltas (psychological rationale)
    condition_lower = condition.lower()
    if "sunny" in condition_lower or "clear" in condition_lower:
        score += 15  # Sunlight boosts serotonin
    elif "cloudy" in condition_lower or "overcast" in condition_lower:
        score -= 5   # Reduced UV and light exposure
    elif "rain" in condition_lower:
        score -= 10  # Barometric drop + reduced activity
    elif "storm" in condition_lower or "thunder" in condition_lower:
        score -= 20  # High arousal / anxiety; low pressure

    # Temperature deltas (thermal comfort zone)
    if 18 <= temperature_c <= 24:
        score += 10  # Optimal thermal comfort
    elif temperature_c < 10 or temperature_c > 35:
        score -= 15  # Thermal stress
    elif temperature_c < 18:
        score -= 5   # Cool but tolerable
    elif temperature_c > 24:
        score -= 3   # Warm but tolerable

    # Humidity deltas
    if humidity > 80:
        score -= 8  # High humidity suppresses energy

    return max(0, min(100, score))
