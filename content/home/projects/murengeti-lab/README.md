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

Each school gets its own private workspace, run by its educator. It was first built for one lab and can now host more than one school. A superadmin approves accounts and sets targets but never sees a student's name in the app (the projects repository, where each student's work sits in a folder under their name, is the one exception); a warehouse admin sees only the equipment. Each school's work goes in a repository folder no later school is given, so a new school with a removed school's name cannot see it. When the repository cannot be updated, the page says so and why, instead of a plain success; if the server's settings have changed so that it can no longer read the repository's key, it says the superadmin needs to connect the repository again. When a student is deleted, their name comes out of what was typed about them and out of any note about someone else, and every answer tells the browser not to store it, so records do not stay on a shared lab computer.

A school that does not run to a timetable can switch it off. The dashboard then shows the week's lessons against the target instead of the day's classes.

## A detail I care about

Importing a class list is two steps: preview, then confirm. The preview shows exactly which students, classes, and timetable slots would be created, and any warnings, before anything is written. Running the same import twice does not create duplicates. An equipment list goes in whole or not at all, and an import that overwrites a roster removes those students' project files only once it is saved. A file can be up to 10 MB, and nobody else waits while one is read. A workbook that would unpack to more than 200 MB is refused before it is opened, and a CSV saved by Excel on Windows reads as it is, so a name like Zoë does not stop an import. A PDF's preview is the start of its text: the first 5,000 characters, from the first 50 pages at most. The Students page and its CSV export read a whole school in a few database queries, however many students it has.

A roster or equipment file previewed for importing is kept, but because it holds people's names it is kept only while it can still be imported: importing it deletes the kept copy (what was imported stays), and one that was only looked at is deleted 30 days after it was last uploaded, a date the Uploads page shows. Deleting a student says how many such files may still hold their name and offers to delete them too. A kept file is served or deleted only from inside the upload folder, whatever path its record holds.

A list says it is loading until its records arrive, never "nothing here yet" before it knows. A page that cannot load its records says so above the page, with a Try again button, and shows nothing it could not load. An empty list there would look like lost data. The sign-up page does the same when it cannot read which roles are open, rather than offering every role, and CI checks every page this way in Chrome for each role.

When the server cannot be reached, the site says "Back shortly" instead of loading forever, signed in or out: a problem with the hosting provider, nothing the person did, their records safe, with a link to the host's status page. It keeps checking and carries on as soon as the server answers, and a page that gets this answer while loading says the same in its banner, with Try again. CI checks this against the built site.

Times are kept as they are typed, so a lesson can be recorded before 08:00. A "4:30" in an imported file still becomes 16:30. A second lesson for the same group at the same time is refused, so a double click cannot count one lesson twice against a target. So is moving a lesson onto another of that group, and a project that ends before it starts. A cancelled lesson leaves its time free for another, and a lesson with marks on it stays with its group.

Small text reaches WCAG AA contrast in both themes, and a dialog keeps the keyboard's focus and gives it back on closing. Every control shows when the keyboard is on it, there is a way past the sidebar, a new page takes the focus and names itself in its title, and form errors are announced to screen readers. The fonts come from the site, so a visit does not reach Google. A shared link shows a generic card that never names a school or a person.

## Signing in

Back4App confirms who each person is: their password, their email address, and a forgotten-password link. This system keeps the roles and the schools. If Back4App cannot be reached, the password it last accepted still works, so a lesson is never held up by a sign-in. Nothing is sent to Back4App except over HTTPS, since every request carries a key and a sign-in carries a password. If the browser blocks the site's storage, the app still works: a sign-in lasts until the tab is closed or reloaded, and choices such as the theme are not remembered.

Repeated wrong passwords make an account wait, links are sent at most once a minute, and every request checks the account again, so someone removed is signed out at once. Changing a password signs the account out everywhere else, and it changes only once Back4App has taken the new one; if Back4App cannot, the password stays as it was. Guesses at the current password, the setup key and emailed codes are limited too, counted by the address the site's own server saw, which a client cannot fake, because the backend can be reached only through that server. A refused request never repeats a typed password, and the server never writes out a password or key. Passwords kept here are hashed at OWASP's 600,000 rounds, and older hashes are remade the next time the password is used. A deployed server with no mail service refuses to send a sign-in code, so the code never lands in the log. Mail goes out only to a mail server whose certificate checks out, and never with its password over an unencrypted line; browsers are told to reach the site over HTTPS only.

Every account is copied to Back4App. If Back4App already has a user with the same email under another name, the account takes that user over only once its address is confirmed here, so typing someone else's email at sign-up never resets their Back4App password. Each sign-in sends the account's details again, so a change Back4App missed, such as an approval made while it was out of reach, reaches it then. The superadmin's People page says why an account is not in Back4App yet (no email address, for one), and how many of this server's sign-ins hold a Back4App session.

## Stack

  FastAPI · SQLAlchemy · Alembic · PostgreSQL · Back4App
  React 19 · TypeScript 7 · Vite 8
  deployed on Railway, where only the site has a public address; the backend is reached on Railway's private network, through the site's own server

A deploy takes traffic only once its health check passes (the backend's after its database migrations have run). A site deploy that fails leaves the working version serving. The backend keeps its uploads on a volume, and Railway never runs two deployments of such a service at once, so every backend deploy has a short gap and a failed one leaves the API down until a deploy succeeds. Migrations are kept compatible with the code before them. A crashing service gets ten restarts, and `/api/ready` tells a monitor whether the server can reach its database.

The site is built for browsers as old as Chrome 87, Edge 88, Firefox 78 and Safari 14, because lab computers are often old: Chrome on Windows 7 and 8.1 stopped at 109.

238 backend tests run on every push to main, among them a sweep of every route, present and future, that keeps out anyone without a session and each role out of the others' pages. They all run on real PostgreSQL, and all but the two PostgreSQL-only ones on SQLite. A smoke test opens every page in Chrome for each role, and the images are built and started as Railway does. The backend installs the exact versions it was tested with, from a lock, everywhere it runs, and every push checks the pinned backend and frontend versions for known vulnerabilities.

The source is private, so this folder holds notes, not code.
