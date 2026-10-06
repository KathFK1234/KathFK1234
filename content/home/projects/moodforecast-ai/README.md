# MoodForecast AI — where environmental intelligence meets psychological wellbeing

Weather apps report conditions. They rarely say what those conditions mean for a person's day. MoodForecast AI takes live weather for a location and turns it into a mood score with the reasons behind it, an energy level, a risk rating, and a few concrete things to do. It can also say whether the weather suits a plan (a run, a picnic, stargazing) and what else is practical where you are.

## Stack

  FastAPI · Pydantic · SQLModel · httpx · pytest
  Weather and geocoding from Open-Meteo (no API key)
  SQLite in development, PostgreSQL in production
  Deployed on Railway; vanilla HTML/CSS/JS frontend

## API

The endpoint list is in `API.md`, next to this file. It is rewritten from the service's own description every three hours, so it does not go stale:

  `cat ~/projects/moodforecast-ai/API.md`

Weather is cached for 10 minutes. The scoring engine, the activity advisor, the daily alerts and the endpoints are all covered by tests.

## Links

  repo: https://github.com/KathFK1234/moodforecast_ai
  live: https://moodforecastai-production.up.railway.app

## Try it from here

This terminal calls the live service. It asks the service what it can do each visit, so anything new over there works here too.

  `mood nairobi`                 today's mood score and what is behind it
  `mood week tokyo`              the next seven days, scored day by day
  `mood nairobi vs reykjavik`    which of two places is having the better day
  `mood picnic in cape town`     whether the weather suits a plan
  `mood activities mombasa`      what is practical there right now
  `mood surprise`                a place picked for you
  `mood api`                     everything the service offers right now

Any town or city works. Try one you have never been to.
