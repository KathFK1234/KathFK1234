# Scoring rules — how a weather reading becomes a mood score

Start at 65 (neutral), apply at most one delta from each group, clamp to 0-100. Every reading names the deltas it applied: `mood nairobi` shows them on the `why` line.

  condition     clear / sunny, by day   +15
                clear, at night          +5
                cloudy / overcast        -5
                drizzle, snow or fog     -5
                rain                    -10
                storm / thunder         -20

  temperature   18-24 C                 +10
                below 10 or above 35    -15
                10-18 C                  -5
                24-35 C                  -3

  humidity      above 80%                -8

## From score to labels

  score     energy      outlook
  75-100    High        weather unlikely to dampen mood
  50-74     Medium      weather has little effect on mood
  25-49     Low         weather may dampen mood
  0-24      Very Low    weather likely to dampen mood

  (The service calls the outlook a risk level, Minimal to High. The terminal words it about the weather,
  never about the person.)

  mood      85+ Radiant · 75+ Upbeat · 60+ Steady · 50+ Mellow · 35+ Subdued · 25+ Drained · below, Heavy

The rules are hand-set: they were never fitted to, or checked against, how people feel, so the score is a rule of thumb, not a measurement. They are also deliberately explicit. A model you can read line by line is a model a person can argue with, and that matters when the output is a statement about how someone might feel.
