# Murengeti Lab System — computer lab management for schools

I lead a school computer lab, and running it meant juggling spreadsheets: one for students, one for the timetable, one for equipment, none of them agreeing with each other. This system replaces them with one connected place.

## What it covers

  students and classes     grouped by grade, stream, and group
  timetable and sessions   what was planned, and what was actually taught
  attendance and notes     recorded per lesson
  equipment                inventory, and which class used what
  progress and reports     curriculum, typing, and projects

Each school gets its own private workspace, run by its educator. It was first built for one lab and can now host more than one school.

## A detail I care about

Importing a class list is two steps: preview, then confirm. The preview shows exactly which students, classes, and timetable slots would be created, and any warnings, before anything is written. Running the same import twice does not create duplicates.

## Stack

  FastAPI · SQLAlchemy · Alembic · PostgreSQL
  React · TypeScript · Vite

The source is private, so this folder holds notes, not code.
