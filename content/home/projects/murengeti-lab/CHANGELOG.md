# Changelog — the latest work on Murengeti Lab System, read from its repository

Written by a script from the repository's own history, so this list keeps up as the project does.

  213 commits · first 2026-09-20 · latest 2026-10-19

  2026-10-19  Bring back the notifications bell, with the items the server works out and a count of the unread ones
  2026-10-19  Work out notifications from the records: accounts waiting for the superadmin, open equipment issues for educators and the warehouse admin
  2026-10-19  Look the backend's address up again every 10 seconds in nginx, so a backend on Railway's private network stays reachable after it is redeployed
  2026-10-19  Serve the backend on IPv4 and IPv6 at once, so Railway can reach it on its private network as well as through its public proxy
  2026-10-19  Give the live frontend and backend URLs in the README, with what to check after a deploy
  2026-10-19  Refuse to downgrade below 0035 while a deleted school's folder is recorded or a school's folder is numbered, instead of forgetting them
  2026-10-19  Refuse in the database a second school given a folder another school holds, so two schools added at the same moment cannot share one
  2026-10-19  Check a turned-down school's name and choose its folder afresh when the superadmin adds it again, so it cannot share another school's folder
  2026-10-19  Hide empty states under the failed-load banner without :has, so older browsers hide them too
  2026-10-19  Show a project's repository folder only once the server has given it, instead of a guess from the school's name
  2026-10-19  Give each school a projects-repository folder that no later school gets, so a new school with a deleted school's name cannot see, replace, or delete its work
  2026-10-19  Describe the frontend smoke test in the architecture notes, next to the backend tests

From anywhere in this terminal, `updates` shows the same for every project.
