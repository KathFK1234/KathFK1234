# Scoring rules — how a weather reading becomes a mood score

Start at 65 (neutral), apply the deltas, clamp to 0-100.

  condition     clear / sunny        +15
                cloudy / overcast     -5
                rain                 -10
                storm / thunder      -20

  temperature   18-24 C              +10
                below 10 or above 35 -15
                10-18 C               -5
                24-35 C               -3

  humidity      above 80%             -8

## From score to labels

  score     energy      risk
  75-100    High        Minimal
  50-74     Medium      Low
  25-49     Low         Moderate
  0-24      Very Low    High

The rules are deliberately explicit. A model you can read line by line is a model a person can argue with, and that matters when the output is a statement about how someone might feel.
