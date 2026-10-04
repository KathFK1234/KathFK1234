# Backend — FastAPI application, routers, and services

  app/main.py                 application factory, CORS, static mount
  app/routers/forecast.py     GET /api/forecast/{location}
  app/routers/wellbeing.py    GET /api/wellbeing/{location}
  app/routers/subscribe.py    POST /api/subscribe (E.164 phone numbers)
  app/services/weatherai.py   async client for the weather provider
  app/services/mood_engine.py rule-based scoring (see ../data)
  app/services/cache.py       in-memory TTL cache, swappable with Redis
  app/services/geocoding.py   location name -> coordinates

The files next to this one are short excerpts. The full source is at https://github.com/KathFK1234/moodforecast_ai/tree/main/backend
