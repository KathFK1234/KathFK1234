# Backend — FastAPI application, routers, and services

  app/main.py                      application factory, CORS, static mount, daily-alert loop
  app/routers/wellbeing.py         GET /api/wellbeing/{location}
  app/routers/forecast.py          GET /api/forecast/{location}
  app/routers/activity.py          activity verdicts, suggestions and random picks
  app/routers/locations.py         GET /api/locations (place names as you type)
  app/routers/subscribe.py         daily email alerts: subscribe and unsubscribe
  app/services/weather.py          async client for Open-Meteo
  app/services/mood_engine.py      rule-based scoring (see ../data)
  app/services/activity_advisor.py is the weather right for this activity?
  app/services/curiosity.py        questions that point to other places
  app/services/cache.py            in-memory TTL cache, swappable with Redis
  app/services/geocoding.py        location name -> coordinates

The files next to this one are short excerpts. The full source is at https://github.com/KathFK1234/moodforecast_ai/tree/main/backend
