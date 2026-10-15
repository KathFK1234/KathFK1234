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

Each school gets its own private workspace, run by its educator. It was first built for one lab and can now host more than one school. A superadmin approves accounts and sets targets but never sees a student's name in the app (the projects repository, where each student's work sits in a folder under their name, is the one exception); a warehouse admin sees only the equipment.

A school that does not run to a timetable can switch it off. The dashboard then shows the week's lessons against the target instead of the day's classes.

## A detail I care about

Importing a class list is two steps: preview, then confirm. The preview shows exactly which students, classes, and timetable slots would be created, and any warnings, before anything is written. Running the same import twice does not create duplicates.

A page that cannot load its records says so above the page, with a Try again button. An empty list there would look like lost data.

## Signing in

Back4App confirms who each person is: their password, their email address, and a forgotten-password link. This system keeps the roles and the schools. If Back4App cannot be reached, the password it last accepted still works, so a lesson is never held up by a sign-in.

Repeated wrong passwords make an account wait, links are sent at most once a minute, and every request checks the account again, so someone removed is signed out at once. Changing a password signs the account out everywhere else. Guesses at the current password, the setup key and emailed codes are limited too, a refused request never repeats a typed password, and the server never writes out a password or key.

## Stack

  FastAPI · SQLAlchemy · Alembic · PostgreSQL · Back4App
  React · TypeScript · Vite
  deployed on Railway

The source is private, so this folder holds notes, not code.
