# Changelog — the latest work on Murengeti Lab System, read from its repository

Written by a script from the repository's own history, so this list keeps up as the project does.

  191 commits · first 2026-09-20 · latest 2026-10-16

  2026-10-16  Count on the People page only the sign-ins that hold a Back4App session, and say they are this server's
  2026-10-16  Show on the People page why an account could not be added to Back4App, instead of promising it at the next sign-in
  2026-10-16  Take over the Back4App user that already has an account's email under another username, so that account's sign-ins reach Back4App
  2026-10-15  Count per-address limits by the address nginx saw, which a client cannot set
  2026-10-15  Check the frontend's nginx config in CI, in the image the Dockerfile uses
  2026-10-15  Show lesson and timetable times as stored, so a lesson can be recorded before 08:00
  2026-10-15  Describe the loading and failed-load states in the README
  2026-10-15  Remove the notifications bell, which only ever opened an empty dialog
  2026-10-15  Let the superadmin and warehouse pages try a failed load again, and show nothing they could not load
  2026-10-15  Stop pages from claiming what a failed load could not tell, and let Uploads and Reports try again
  2026-10-15  Say a list is loading instead of showing its empty state, and show only the chosen day's lessons
  2026-10-15  Drop a page load's answer once the page, date, or session it was asked for has changed

From anywhere in this terminal, `updates` shows the same for every project.
