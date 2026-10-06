# What changed — from MindConnect v1 to Healing Hive v2

v1 was a skeleton built by a team learning the problem. v2 keeps its features and its purpose, and rebuilds the parts a real person would lean on.

## Trust

  roles            v1 carried the role inside the sign-in token. v2 reads it from the database on every request, so approving or removing a professional takes effect at once.
  becoming a pro   v2 has one way in: apply, and an admin approves. Therapists must give a licence number.
  sign-in          a wrong password and an unknown email get the same answer, so the form cannot be used to find out who has an account. Repeated failed attempts are slowed down; successful ones are not counted, because a campus or a mobile network can put many people behind one address.
  passwords        never returned by the API, and not read from the database unless a query asks for them.
  secrets          settings are checked when the server starts. A missing or weak one stops it there, not on some later request.

## Booking

  availability     a professional's weekly hours become a list of open slots, in East Africa Time, two weeks ahead.
  double booking   the database refuses a second booking for the same slot. Two people tapping at the same moment: exactly one succeeds.
  who sees what    only the two people in a session can see or change it. A professional's private notes are never sent to the client.
  price            saved at the time of booking, so a later rate change does not rewrite history.

## Care

  AI companion     v1 had the code for an AI chat, not yet connected. v2 connects it, tells it what it is not (a therapist, a doctor, a human), and lets a person wipe the conversation.
  crisis           a message that sounds like crisis always gets help contacts back, in English or Swahili, whether or not the AI answers.
  check-ins        new in v2: a mood score short enough to finish when tired.
  privacy          journals, check-ins and AI conversations belong to their owner. The admin dashboard gets counts, nothing else.

## Engineering

  structure        one folder per feature (auth, sessions, journal ...) with a versioned API, where v1 had one folder per file type.
  validation       every request is checked before it reaches a handler, and errors come back in one shape.
  tests            20 API tests against an in-memory database, each named for the promise it keeps.
  seed data        one command fills a local database with sample people and content.

## The web app

  v1               a landing page, a dashboard, and a chatbot screen.
  v2               twenty pages covering every feature above, for three kinds of people: someone looking for support, a professional running their practice, and an admin reviewing applications and content.
  get help now     a button on every page, signed in or not.
  themes           light and dark, from one set of colour tokens.

## Not built yet

  payments         sessions record a price and a payment status; nothing is charged yet (M-Pesa and card).
  reminders        saved and shown in the app; sending them by SMS or email comes later.
  calls            a session records how the two people want to meet; there is no built-in call room.
  also             institution dashboards, password reset by email, ratings and reviews.

Before real people use it: every crisis number re-verified, and the AI companion's instructions reviewed by a qualified clinician.
