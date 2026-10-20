# Healing Hive — mental-health support for young people in Kenya (MindConnect, v2)

Therapy, peer counselling, an AI companion, and bite-sized mental-health education for Kenyans aged 18 to 35. The tagline is "St;ll Here", after the semicolon movement: the story is not over yet.

## How it got here

  2025-06 to 2025-09   MindConnect, v1. A team of four built the skeleton: accounts and roles, sessions, events, nuggets, reminders, and the first screens. I was the team's psychologist and a backend engineer, and built the chatbot interface.
  2026-10-06           I decided to keep building it. Healing Hive is v2, in my own repository, on my own time.

v1 answered "can this exist?". v2 asks the harder question: what does a person in distress need this to get right every time?

## What v2 is

  accounts          sign up, sign in, profile, password reset by email; nobody can give themselves a role
  professionals     therapists and peer counsellors sign up on their own form, an admin approves, then they appear in the directory
  booking           weekly hours become open slots, minus anything already in a connected Google Calendar; a slot can be held by one person only, and a request can be confirmed only while its time is still ahead
  sessions          each confirmed session gets a meeting link (Google Meet, the professional's own link, or a private Jitsi room), and both sides are emailed
  ratings           only the client of a completed session can rate it, once; reviews are public without names
  institutions      a clinic or organisation with counsellors on staff invites verified professionals, who must accept, and sees sessions, ratings and value per professional, never client names
  check-ins         a 1 to 5 mood score with an optional note, private to the person
  journal           private entries, all of them readable back a page at a time; no admin route reaches them
  nuggets           short mental-health education; professionals submit, an admin publishes
  events            wellness events with limited places, without showing who else is going
  AI companion      a listener on Claude with stated limits, and a crisis reply that never depends on the AI being up
  crisis contacts   Kenyan helplines checked against each organisation's own details, the ones that answer at any hour first, kept in the web app so they work when the server does not

## The web app

Twenty-four pages on top of that API, in four groups:

  anyone             landing, help, the support directory and each professional's profile, nuggets, events, sign-up for professionals, password reset
  signed in          home, check-ins, journal, AI companion, my sessions, reminders, settings, apply as a professional
  by role            My practice for professionals, with Google Calendar and every completed session's notes, a page at a time; the institution dashboard; the admin page for applications, institutions and nuggets, with a search of everyone who has signed up
  each account       its own home and a short menu grouped for what that kind of person came to do

A "Get help now" button is on every page, signed in or not, with the hours each line answers. Light and dark themes share one set of colour tokens, and each page loads on first visit, so a slow connection only pays for the screen it opens. Pages fit a phone's width, Register and Publish show when they are working and cannot be sent twice, and forms say what to fix instead of showing raw validation messages. When something fails, the app says what: the server not responding, the server not found, the device offline, or a page that could not download, which keeps the crisis numbers on screen. Connecting Google Calendar says why it did not connect: cancelled, not set up, a link that expired, not approved, refused by Google, or not saved.

Locally, `npm install` and `npm run dev` start a database, the API and the web app together, with sample accounts so every page has something in it. Email, Google Calendar and the AI companion switch on when their settings are filled in, and the app still works without them. Every push runs the API tests and the lint, and the repository is set up to publish the web app on GitHub Pages and the API on Railway.

## Stack

  Node.js · Express · MongoDB (Mongoose) · Zod · JWT · Nodemailer
  React · Vite · Tailwind CSS 4
  Claude API · Google Calendar and Meet

## Read next

  what-changed.md   what v2 does differently from v1, why, and what is not built yet
  safety.md         the decisions a mental-health product cannot get wrong
  CHANGELOG.md      the latest work, written from the repository itself
  ../mindconnect/   v1, and the product thinking both versions rest on
