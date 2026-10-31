# What changed — from MindConnect v1 to Healing Hive v2

v1 was a skeleton built by a team learning the problem. v2 keeps its features and its purpose, and rebuilds the parts a real person would lean on.

## Trust

  roles            v1 carried the role inside the sign-in token. v2 reads it from the database on every request, so approving or removing a professional takes effect at once.
  becoming a pro   v2 has one way in: apply, and an admin approves. Therapists must give a licence number, and therapists and peer counsellors must upload a certificate (a PDF or photo, checked by its contents, at most 10 uploads an hour) before they can be approved. Only they and admins can download it.
  sign-in          a wrong password and an unknown email get the same answer in the same time, so the form cannot be used to find out who has an account. Repeated failed attempts are slowed down; successful ones are not counted, because a campus or a mobile network can put many people behind one address.
  passwords        never returned by the API, and not read from the database unless a query asks for them. Changing or resetting one signs out every other device, and asking for a reset answers without waiting for the email, so its speed does not show who has an account.
  sign-up          one connection can only create so many accounts.
  responses        internal fields stay out of what the API sends, and meeting and event links must be http or https.
  web app          served with a Content-Security-Policy.
  secrets          settings are checked when the server starts. A missing or weak one stops it there, not on some later request.

## Booking

  availability     a professional's weekly hours become a list of open slots, in East Africa Time, two weeks ahead.
  double booking   the database refuses a second booking for the same slot. Two people tapping at the same moment: exactly one succeeds.
  waiting          a request holds its time until it is answered, so one person can have 3 waiting with the same professional and 10 in all.
  who sees what    only the two people in a session can see or change it. A professional's private notes are never sent to the client.
  price            saved at the time of booking, so a later rate change does not rewrite history.
  meeting          a confirmed session gets a link: Google Meet when the professional has connected their calendar, otherwise their own link, otherwise a private Jitsi room. Both people are emailed when a session is requested, confirmed or cancelled.
  ratings          only the client of a completed session can rate it, and only once. Reviews are shown without names.
  cancelling       a client can cancel up to the moment a session starts. A professional removed from the directory has every upcoming session cancelled, and one under way ended, and each client is told.
  events           a new event cannot start in the past or be moved there, and stays under Upcoming until it has ended. Deleting one emails everyone registered, and its host when an admin removes it.

## Care

  AI companion     v1 had the code for an AI chat, not yet connected. v2 connects it to Claude, tells it what it is not (a therapist, a doctor, a human), and lets a person wipe the conversation.
  crisis           a message that sounds like crisis always gets help contacts back, in English or Swahili, whether or not the AI answers, declines or times out, and even past the chat limit. Every number was checked against its organisation's own details, and the lines that answer at any hour come first, with their hours shown.
  check-ins        new in v2: a mood score short enough to finish when tired.
  privacy          journals, check-ins and AI conversations belong to their owner. The admin dashboard gets counts, nothing else, and so does an institution about the professionals who accepted its invitation.

## Engineering

  structure        one folder per feature (auth, sessions, journal ...) with a versioned API, where v1 had one folder per file type.
  validation       every request is checked before it reaches a handler, and errors come back in one shape. A request the server cannot read is the sender's error (400 or 415), not the server's.
  editing          emptying a box removes what was there: a rating's public comment, a journal entry's title, a professional's years of experience.
  tests            66 API tests against an in-memory database, each named for the promise it keeps, and 9 web app tests for telling an outage from an ordinary error and checking a certificate file before it is sent.
  local setup      `npm run dev` starts a database, the API and the web app together, and fills them with sample accounts for every kind of person. Email, Google Calendar and the AI companion are optional, and the app works without them.

## The web app

  v1               a landing page, a dashboard, and a chatbot screen.
  v2               twenty-four pages covering every feature above, for four kinds of people: someone looking for support, a professional running their practice, an institution with professionals on its team, and an admin reviewing applications and content. Each has its own home and a short menu.
  get help now     a button on every page, signed in or not.
  themes           light and dark, from one set of colour tokens.

## Not built yet

  payments         sessions record a price and a payment status; nothing is charged yet (M-Pesa and card).
  reminders        saved and shown in the app; sending them by SMS or email comes later.
  calls            sessions happen on Google Meet, the professional's own link, or Jitsi; there is no built-in call room.
  email changes    changing an email address, and confirming one at sign-up.
  your data        deleting an account, downloading your data, and a privacy notice with consent at sign-up. Kenya's Data Protection Act 2019 covers this kind of health-related data.

Before real people use it: the data items above, the AI companion's instructions reviewed by a qualified clinician, Google's verification so every professional can connect a calendar, database backups with a restore tried once, and the crisis numbers checked again before each release.
