# Murengeti Lab System — computer lab management for schools

I lead a school computer lab, and running it meant juggling spreadsheets: one for students, one for the timetable, one for equipment, none of them agreeing with each other. This system replaces them with one connected place.

## What it covers

  students and classes     grouped by grade, stream, and group
  timetable and sessions   what was planned, and what was actually taught
  attendance and notes     recorded per lesson
  equipment                inventory, and which class used what
  progress and reports     curriculum, typing, and projects
  weekly targets           set group by group; each educator sees their week against them
  uploads                  every file a school has uploaded, in one list, previewed without downloading
  projects repository      students' work, filed by year, school and term in one private repository; educators can read it, not change it
  notifications            a bell for what is waiting: accounts to approve for the superadmin, open equipment issues for educators and the warehouse admin

Each school gets its own private workspace, run by its educator. It was first built for one lab and can now host more than one school. A superadmin approves accounts and sets targets but never sees a student's name in the app (the projects repository, where each student's work sits in a folder under their name, is the one exception); a warehouse admin sees only the equipment. Each school's work goes in a repository folder no later school is given, so a new school with a removed school's name cannot see it.

A school that does not run to a timetable can switch it off. The dashboard then shows the week's lessons against the target instead of the day's classes.

## A detail I care about

Importing a class list is two steps: preview, then confirm. The preview shows exactly which students, classes, and timetable slots would be created, and any warnings, before anything is written. Running the same import twice does not create duplicates.

A list says it is loading until its records arrive, never "nothing here yet" before it knows. A page that cannot load its records says so above the page, with a Try again button, and shows nothing it could not load. An empty list there would look like lost data. The sign-up page does the same when it cannot read which roles are open, rather than offering every role, and CI checks every page this way in Chrome for each role.

Times are kept as they are typed, so a lesson can be recorded before 08:00. A "4:30" in an imported file still becomes 16:30.

## Signing in

Back4App confirms who each person is: their password, their email address, and a forgotten-password link. This system keeps the roles and the schools. If Back4App cannot be reached, the password it last accepted still works, so a lesson is never held up by a sign-in.

Repeated wrong passwords make an account wait, links are sent at most once a minute, and every request checks the account again, so someone removed is signed out at once. Changing a password signs the account out everywhere else. Guesses at the current password, the setup key and emailed codes are limited too, counted by the address the site's own server saw, which a client cannot fake. A refused request never repeats a typed password, and the server never writes out a password or key. Mail goes out only to a mail server whose certificate checks out, and never with its password over an unencrypted line; browsers are told to reach the site over HTTPS only.

Every account is copied to Back4App. If Back4App already has a user with the same email under another name, the account takes that user over only once its address is confirmed here, so typing someone else's email at sign-up never resets their Back4App password. The superadmin's People page says why an account is not in Back4App yet (no email address, for one), and how many of this server's sign-ins hold a Back4App session.

## Stack

  FastAPI · SQLAlchemy · Alembic · PostgreSQL · Back4App
  React · TypeScript · Vite
  deployed on Railway

158 backend tests run on every push to main, and a smoke test opens every page in Chrome for each role.

The source is private, so this folder holds notes, not code.
