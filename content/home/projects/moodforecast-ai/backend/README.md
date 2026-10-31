# Backend — FastAPI application, routers, and services

  app/main.py                      application factory, CORS, security headers, request limits, static mount, daily-alert loop
  app/routers/wellbeing.py         GET /api/wellbeing/{location}
  app/routers/forecast.py          GET /api/forecast/{location}
  app/routers/activity.py          activity verdicts, suggestions and random picks
  app/routers/locations.py         GET /api/locations (place names as you type)
  app/routers/subscribe.py         daily email alerts: subscribe, confirm by email, unsubscribe
  app/services/weather.py          async client for Open-Meteo
  app/services/mood_engine.py      rule-based scoring (see ../data)
  app/services/activity_advisor.py is the weather right for this activity?
  app/services/locality.py         what a place offers: the sea, snow, wildlife, the sports played there
  app/services/curiosity.py        questions that point to other places
  app/services/cache.py            in-memory TTL cache, capped at 5,000 entries
  app/services/geocoding.py        location name -> coordinates
  app/services/alerts.py           composes and sends the five emails, deletes what is no longer needed
  app/services/mailer.py           Brevo's API, or SMTP where it is allowed
  app/services/rate_limit.py       how often one visitor can use the API and the forms

The files next to this one are short excerpts. The full source is at https://github.com/KathFK1234/moodforecast_ai/tree/main/backend
