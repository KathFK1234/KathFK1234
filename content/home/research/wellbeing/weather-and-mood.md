# Weather and mood — the same signal means different things in context

The starting observation behind MoodForecast AI: a weather reading can feel reassuring, draining, or chaotic depending on a person's context, routine, and perception.

Heuristics the scoring engine uses, with the rationale written beside each rule in the code:

  light         clear skies raise the score; overcast lowers it
  temperature   18-24 C is treated as the thermal comfort zone
  extremes      below 10 C or above 35 C counts as thermal stress
  humidity      above 80% is treated as suppressing energy
  storms        scored lowest: high arousal, low pressure

These are design heuristics for a product, not clinical claims. The full table is in `~/projects/moodforecast-ai/data/scoring-rules.md`.
