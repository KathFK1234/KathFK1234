# Frontend — the interface layer for interpreting a forecast

Vanilla HTML, CSS, and JavaScript. No framework and no build step: the FastAPI app mounts the folder and serves it from the same origin, so the page talks to the API with plain `fetch`.

  index.html    search box, current conditions, mood summary
  app.js        calls /api/forecast and /api/wellbeing, renders results
  styles.css    mobile-first layout

Design goal: a person should understand the score before they understand the system. Number first, reason second, recommendation third.

Live: https://moodforecastai-production.up.railway.app
