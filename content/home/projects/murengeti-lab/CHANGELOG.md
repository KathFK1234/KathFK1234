# Changelog — the latest work on Murengeti Lab System, read from its repository

Written by a script from the repository's own history, so this list keeps up as the project does.

  262 commits · first 2026-09-20 · latest 2026-10-29

  2026-10-29  Upgrade TypeScript 5.9 to 7, the native compiler, for the frontend's type check
  2026-10-29  Say in the README that each sign-in sends the account's details to Back4App again
  2026-10-29  Send an account's details to Back4App at each sign-in, so an approval it missed reaches it
  2026-10-29  Upgrade React and React DOM 18 to 19, with their types
  2026-10-29  Give the 10 MB import limit in the README, and say a PDF import's preview is the start of its text
  2026-10-29  Serve and delete kept files only inside the upload folder, whatever path their record holds
  2026-10-29  Stop reading a PDF import once its preview has its 5,000 characters, and after 50 pages at most
  2026-10-29  Read import files beside the server's event loop, so parsing one no longer holds up everyone else's requests
  2026-10-29  Update the frontend lockfile to react-router-dom and react-router 7.18.5, within package.json's range
  2026-10-29  Refresh the backend lock to pypdf 6.21.4 and pytest 9.2.0
  2026-10-27  Refresh the backend lock to fastapi 0.162.0, starlette 1.10.0 and certifi 2026.10.23
  2026-10-23  Put getData's comment back above getData, where adding unavailableMessage had left it behind

From anywhere in this terminal, `updates` shows the same for every project.
