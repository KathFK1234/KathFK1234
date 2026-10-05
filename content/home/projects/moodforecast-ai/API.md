# API — everything the live MoodForecast AI service offers

Written by a script from the service's own description of itself, so this list keeps up when an endpoint is added or changed.

  GET   /api/activities                  Names of the activities the advisor knows, e.g. for a subscription form.
  GET   /api/activities/{location}       The activities that are practical at a location, local favourites first.
  GET   /api/activity/{location}         Check whether an activity suits a location and its current weather.
  GET   /api/forecast/{location}         Get weather forecast for a location.
  GET   /api/locations                   Suggest locations matching the start of a place name.
  GET   /api/random-activity/{location}  Pick a random activity that suits a location and its current weather.
  POST  /api/subscribe                   Register an email address for daily alerts about a location.
  POST  /api/unsubscribe-link            Email a subscriber their unsubscribe link.
  POST  /api/unsubscribe/{token}         Stop daily alerts for the subscription the token belongs to.
  GET   /api/wellbeing/{location}        Get mood and wellbeing score for a location.
  GET   /health                          Health check endpoint for Railway deploy probe.

From this terminal, `mood api` asks the service the same question live, and every GET endpoint above can be tried with `mood`.
