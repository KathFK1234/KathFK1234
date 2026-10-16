# Changelog — the latest work on Murengeti Lab System, read from its repository

Written by a script from the repository's own history, so this list keeps up as the project does.

  197 commits · first 2026-09-20 · latest 2026-10-16

  2026-10-16  Build the frontend in CI on Node 24, as the image does, and ask for Node 22 or newer instead of the end-of-life 18
  2026-10-16  Take over a Back4App user by its email only for an account whose address is confirmed here, so signing up with someone else's email cannot reset their Back4App password
  2026-10-16  Build the frontend on Node 24 and serve it from nginx 1.30, both still supported, and check the config in the same nginx
  2026-10-16  Move CI to actions/checkout v7 and actions/setup-python v7, off the deprecated Node 20 runtime
  2026-10-16  Update Vite to 6.4.4 and source-map-js to 1.2.2, so npm audit reports no vulnerabilities
  2026-10-16  Allow cryptography 50, so installs no longer get a 46.x release with seven known advisories
  2026-10-16  Count on the People page only the sign-ins that hold a Back4App session, and say they are this server's
  2026-10-16  Show on the People page why an account could not be added to Back4App, instead of promising it at the next sign-in
  2026-10-16  Take over the Back4App user that already has an account's email under another username, so that account's sign-ins reach Back4App
  2026-10-15  Count per-address limits by the address nginx saw, which a client cannot set
  2026-10-15  Check the frontend's nginx config in CI, in the image the Dockerfile uses
  2026-10-15  Show lesson and timetable times as stored, so a lesson can be recorded before 08:00

From anywhere in this terminal, `updates` shows the same for every project.
