# MoodForecast AI — where environmental intelligence meets psychological wellbeing

Weather apps report conditions. They rarely say what those conditions mean for a person's day. MoodForecast AI takes live weather for a location and turns it into a mood score, an energy level, a risk rating, and a few concrete recommendations.

## Stack

  FastAPI · Pydantic · SQLModel · httpx · pytest
  SQLite in development, PostgreSQL in production
  Deployed on Railway; vanilla HTML/CSS/JS frontend

## API

  GET  /api/forecast/{location}    current conditions + 7-day forecast
  GET  /api/wellbeing/{location}   mood score, energy, risk, recommendations
  POST /api/subscribe              register for SMS/USSD alerts
  GET  /health                     deploy probe

Responses are cached for 10 minutes. 31 tests: 23 on the scoring engine, 8 on the endpoints.

## Links

  repo: https://github.com/KathFK1234/moodforecast_ai
  live: https://moodforecastai-production.up.railway.app

## Try it from here

This terminal calls the live service. It asks the service what it can do each visit, so anything new over there works here too.

  `mood nairobi`                 today's mood score and what is behind it
  `mood week tokyo`              the next seven days, scored day by day
  `mood nairobi vs reykjavik`    which of two places is having the better day
  `mood surprise`                a place picked for you
  `mood api`                     everything the service offers right now

Any town or city works. Try one you have never been to.
