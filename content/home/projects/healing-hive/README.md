# Healing Hive — mental-health support for young people in Kenya (MindConnect, v2)

Therapy, peer counselling, an AI companion, and bite-sized mental-health education for Kenyans aged 18 to 35. The tagline is "St;ll Here", after the semicolon movement: the story is not over yet.

## How it got here

  2025-06 to 2025-09   MindConnect, v1. A team of four built the skeleton: accounts and roles, sessions, events, nuggets, reminders, and the first screens. I was the team's psychologist and a backend engineer, and built the chatbot interface.
  2026-10-06           I decided to keep building it. Healing Hive is v2, in my own repository, on my own time.

v1 answered "can this exist?". v2 asks the harder question: what does a person in distress need this to get right every time?

## What v2 is

  accounts          sign up, sign in, profile; nobody can give themselves a role
  professionals     therapists and peer counsellors apply, an admin approves, then they appear in the directory
  booking           weekly hours become open slots; a slot can be held by one person only
  check-ins         a 1 to 5 mood score with an optional note, private to the person
  journal           private entries; no admin route reaches them
  nuggets           short mental-health education; professionals submit, an admin publishes
  events            wellness events with limited places, without showing who else is going
  AI companion      a listener with stated limits, and a crisis reply that never depends on the AI being up
  crisis contacts   Kenyan helplines, one tap away, kept in the web app so they work when the server does not

## Stack

  Node.js · Express · MongoDB (Mongoose) · Zod · JWT
  React · Vite · Tailwind CSS

## Read next

  what-changed.md   what v2 does differently from v1, and why
  safety.md         the decisions a mental-health product cannot get wrong
  CHANGELOG.md      the latest work, written from the repository itself
  ../mindconnect/   v1, and the product thinking both versions rest on
