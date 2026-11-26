# Kazi Hakika — a job-application tracker with verified roles

"Kazi hakika" means "verified work" in Kiswahili. It is a free job-application tracker with a community board of verified roles, built first for tech job seekers in Kenya. It never promises anyone a job: it helps you keep track of your applications and spot fake ads.

It is in early development. The first phase is the private tracker.

## What it does

  tracker      roles, stages, deadlines and notes, seen only by you
  reminders    one email a morning with the deadlines in the next three days, if you ask for it
  your data    export everything as JSON, or delete your account for good
  coming later a shared board of checked roles, a public "Is this job real?" checker, and a connector so your own AI assistant can help with your applications

## The rules it keeps

The AI coaches; it never applies: nothing here submits an application or emails an employer. It holds tracker data only, with no CVs, no phone numbers and no AI model running on its side. Everything is private by default, checking a role is rule-based so everyone gets the same answer, and everything works without AI. It is free to use, cheap to run, and has a hard cap on every cost.

## Privacy

Each person's applications are protected twice. Every query is filtered by the signed-in user, and PostgreSQL's row-level security, forced so that it binds the tables' owner too, shows a request only that user's rows. The app connects as a role that is not a superuser, cannot get around those rules and owns no tables, and a role's stage history can be added to but not rewritten. Logs never hold request bodies, email addresses or database values. An account whose email was never confirmed and which never tracked a role is deleted 30 days after sign-up.

## Signing in

Passwords are hashed with argon2id. A session is a random token in a cookie the page's scripts cannot read, and the database keeps only its hash. Every change needs the session's CSRF token and is refused if the browser says it came from another site. Sign-up and password reset answer the same way whether or not an email has an account. Failed sign-ins are limited per address and per account, while successful ones never count, so nobody can lock you out from somewhere else. Confirmation and reset links work once, are stored hashed and keep their token out of the server's logs, and a reset signs you out everywhere.

## Cost

It aims at about $5 a month on Railway, with caps so a bug cannot run up a bill: one web service that sleeps when nobody is using it, one PostgreSQL database, and a daily job that runs and exits. Requests, notes and lists have size limits, and it sends at most 90 emails a day, under the email service's free 100, keeping 30 of them for the morning reminders.

## Stack

  Python 3.14 · FastAPI · Pydantic · SQLAlchemy · Alembic · PostgreSQL
  React · TypeScript · Vite, served by the same FastAPI service
  Resend for email · Docker · Railway

Every push runs the linters and type checks, the API tests on real PostgreSQL (failing below 90% coverage), the web app's tests and build, a scan for secrets, a check of the pinned packages for known vulnerabilities, and a build of the image. Dependabot raises every update, majors included, and each one is applied together with fixes for anything it breaks.
