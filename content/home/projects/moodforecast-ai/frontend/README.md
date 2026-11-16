# Frontend — the interface layer for interpreting a forecast

Vanilla HTML, CSS, and JavaScript. No framework and no build step: the FastAPI app mounts the folder and serves it from the same origin, so the page talks to the API with plain `fetch`.

  index.html    search box, Use my location, Choose on map, current conditions, mood summary, activity question, daily-email sign-up
  app.js        calls the API (wellbeing, forecast, activities, place suggestions, the town at a point) and renders results; Use my location and the map
  learn.js      learns from 👍/👎 which activities a visitor likes, in their browser only (Thompson sampling)
  leaflet.*     the map, served from the site; only its pictures come from OpenStreetMap
  styles.css    mobile-first layout
  privacy.html  what the site does with people's details
  dm-sans-*     the font, served from the site so a visit does not reach Google
  og-image.png  the card a shared link shows

Design goal: a person should understand the score before they understand the system. Number first, reason second, recommendation third.

Live: https://moodforecastai-production.up.railway.app
