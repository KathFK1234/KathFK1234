"""Rule-based mood scoring engine with psychological rationale."""
# excerpt from backend/app/services/mood_engine.py

BASELINE_SCORE = 65  # neutral baseline


def mood_factors(condition: str, temperature_c: float, humidity: float, is_day: bool = True) -> list[MoodFactor]:
    """
    List what moves the mood score away from the baseline, and by how much.

    At most one factor each for condition, temperature and humidity.
    """
    factors: list[MoodFactor] = []

    # Condition deltas (psychological rationale)
    condition_lower = condition.lower()
    if "storm" in condition_lower or "thunder" in condition_lower:
        factors.append({"label": "Stormy weather", "delta": -20})  # High arousal / anxiety; low pressure
    elif "sunny" in condition_lower or "clear" in condition_lower:
        if is_day:
            factors.append({"label": "Clear skies", "delta": 15})  # Sunlight boosts serotonin
        else:
            factors.append({"label": "Clear night", "delta": 5})   # Calm, but no sunlight to benefit from
    elif "cloudy" in condition_lower or "overcast" in condition_lower:
        factors.append({"label": "Cloud cover", "delta": -5})      # Reduced UV and light exposure
    elif "rain" in condition_lower:
        factors.append({"label": "Rain", "delta": -10})            # Barometric drop + reduced activity
    elif "drizzle" in condition_lower:
        factors.append({"label": "Drizzle", "delta": -5})          # Dull light, mild disruption
    elif "snow" in condition_lower:
        factors.append({"label": "Snow", "delta": -5})             # Cold and reduced mobility
    elif "fog" in condition_lower:
        factors.append({"label": "Fog", "delta": -5})              # Low light and visibility

    # Temperature deltas (thermal comfort zone)
    if 18 <= temperature_c <= 24:
        factors.append({"label": "Comfortable temperature", "delta": 10})  # Optimal thermal comfort
    elif temperature_c < 10:
        factors.append({"label": "Cold stress", "delta": -15})             # Thermal stress
    elif temperature_c > 35:
        factors.append({"label": "Heat stress", "delta": -15})             # Thermal stress
    elif temperature_c < 18:
        factors.append({"label": "Cool air", "delta": -5})                 # Cool but tolerable
    elif temperature_c > 24:
        factors.append({"label": "Warm air", "delta": -3})                 # Warm but tolerable

    # Humidity deltas
    if humidity > 80:
        factors.append({"label": "High humidity", "delta": -8})  # High humidity suppresses energy

    return factors


def calculate_mood_score(condition: str, temperature_c: float, humidity: float, is_day: bool = True) -> int:
    """Baseline plus every factor, clamped to 0-100."""
    factors = mood_factors(condition, temperature_c, humidity, is_day)
    score = BASELINE_SCORE + sum(factor["delta"] for factor in factors)
    return max(0, min(100, score))
