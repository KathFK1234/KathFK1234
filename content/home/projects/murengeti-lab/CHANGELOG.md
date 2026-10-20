# Changelog — the latest work on Murengeti Lab System, read from its repository

Written by a script from the repository's own history, so this list keeps up as the project does.

  234 commits · first 2026-09-20 · latest 2026-10-20

  2026-10-20  Bring the README's layout, commands and CI description up to date with the dependency lock and audit
  2026-10-20  Test that constraints.txt pins every package pyproject.toml asks for, within its range
  2026-10-20  Audit the pinned backend and frontend versions for known vulnerabilities in CI on every push
  2026-10-20  Install the backend's exact tested versions everywhere from constraints.txt, so a new release reaches production only when it is let in
  2026-10-20  Install httpx2 for the tests, the client Starlette's test client now asks for instead of httpx
  2026-10-20  Say in the README and architecture notes that opening the bell reads only what it has shown
  2026-10-20  Mark as read only the notifications the bell has shown when it is opened, so one that came after its last load stays unread
  2026-10-20  Read a school's student names for the warehouse bell only when one of its issues is listed, not every school's on each refresh
  2026-10-20  Close the mail server connection when its greeting or STARTTLS fails, such as a certificate that does not verify
  2026-10-19  Tell browsers to reach the site over HTTPS only, for a year
  2026-10-19  Test that the migrations build the database the models describe, and align the three columns that had drifted
  2026-10-19  Test the GitHub and GitLab clients' requests and how they read the answers, with the network faked

From anywhere in this terminal, `updates` shows the same for every project.
