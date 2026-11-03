# MoodForecast AI — where environmental intelligence meets psychological wellbeing

Weather apps report conditions. They rarely say what those conditions mean for a person's day. MoodForecast AI takes live weather for a location and turns it into a mood score with the reasons behind it, an energy level, an outlook on how much the weather may dampen mood (the service calls it a risk level), and a few concrete things to do. The score is a rule of thumb from the weather alone: it comes from fixed, hand-set rules that were never fitted to or checked against how people feel, and it is not a measure of how anyone feels. The page and the daily email say so, and talk about the weather, not the reader. The seven-day outlook scores each day by the same rules and says the later days are less certain. It can also say whether the weather suits a plan, any of about 65 activities from a run or kayaking to a bonfire, a safari or an escape room, with safety rules built in: nothing outdoors in a thunderstorm or freezing rain, no skateboarding or climbing on wet ground, wind limits for climbing, paddling and fires, and daylight for riding, climbing and paddling. And it says what else is practical where you are: no beach days inland or safaris outside wildlife country, sports such as cricket or kabaddi only where they are commonly played, and local favourites first.

It can also email a daily activity for a place. Nothing starts until the address is confirmed from a link sent to it, and the service never hands back a subscriber's unsubscribe link, so typing in someone else's address cannot sign them up, change their alerts or cancel them. Alerts go only to confirmed addresses: people who subscribed before that step existed are asked once to confirm, their alerts wait until they do, and their details are deleted if they have not after 48 hours. When email is not set up, the form says so instead of taking a request nobody could confirm.

Details are kept only while they have a use. Unsubscribing deletes them straight away, a request whose email cannot be sent goes at once, one nobody confirms goes after 48 hours, and the service keeps addresses and tokens out of its logs, database errors included. The forms cannot be used to flood anyone: at most 100 form emails a day, 5 to one address, and one mailbox to a field.

The page has a privacy page of its own, says its ideas are not medical advice, as the daily email does, and serves its font from the site, so a visit does not reach Google. That page is dated, and says what the hosts keep and where: Railway logs requests, with network addresses and the places searched, for a limited time, the limits hold network and email addresses in memory for up to a day, and since Railway, Brevo, Open-Meteo and OpenStreetMap operate in other countries, a visitor's details may be handled outside their own.

The page and its emails are built to be read by everyone: keyboard focus shows on every sky the background can take, the email links meet WCAG AA contrast, and the emails declare their language for screen readers.

## Stack

  FastAPI · Pydantic · SQLModel · httpx · pytest
  Weather and geocoding from Open-Meteo (no API key)
  SQLite in development, PostgreSQL in production
  Deployed on Railway; vanilla HTML/CSS/JS frontend
  Email through Brevo's API, since Railway's plan blocks plain SMTP (SMTP still works where it is allowed)
  Other sites can read the API but not change anything; the image runs as an unprivileged user that cannot change the app's code, with no local files in it

## API

The endpoint list is in `API.md`, next to this file. It is rewritten from the service's own description several times a day, so it does not go stale:

  `cat ~/projects/moodforecast-ai/API.md`

Weather is cached for 10 minutes. If Open-Meteo cannot be reached, or sends a reply of the wrong shape, a forecast up to an hour old is served instead; a place with nothing saved gets a plain error, not the weather service's own text. One visitor can make 300 API requests a minute and use the email forms 20 times an hour, and a request body over 4 KB is refused, however it is sent. Input the service cannot read gets a 422 that does not repeat it.

The scoring engine, the activity advisor, the daily alerts and the endpoints are covered by 491 tests, 20 more drive the page in a real browser, and all of them run on every push, with the database code on real PostgreSQL and the Docker image built and started on a port given the way Railway gives one. CI does not leave its token on disk, and on Railway the app warns at startup if subscribers would sit in a database that a redeploy wipes. Every install uses the exact versions the tests ran with, those versions are checked for known vulnerabilities on every push and each week, and the production image carries no test tools.

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
