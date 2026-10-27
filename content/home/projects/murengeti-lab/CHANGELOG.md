# Changelog — the latest work on Murengeti Lab System, read from its repository

Written by a script from the repository's own history, so this list keeps up as the project does.

  252 commits · first 2026-09-20 · latest 2026-10-27

  2026-10-27  Refresh the backend lock to fastapi 0.162.0, starlette 1.10.0 and certifi 2026.10.23
  2026-10-23  Put getData's comment back above getData, where adding unavailableMessage had left it behind
  2026-10-23  Update the frontend lockfile to vite 8.3.5 and puppeteer-core 25.16.0, both within package.json's ranges
  2026-10-23  Colour the Back shortly links like the site's own links, readable on their backgrounds in both themes
  2026-10-23  Say "Back shortly" when the server cannot be reached, instead of loading forever, and carry on once it answers
  2026-10-23  Answer /api/ with a calm 503 from the image when nginx cannot reach the backend, instead of nginx's bare 502
  2026-10-23  Write down that a failed Railway deploy leaves the working one serving, and what each health check guards
  2026-10-23  Refresh the backend lock to the newest releases its ranges allow, among them fastapi 0.161.1
  2026-10-21  Record in the architecture notes which browsers the frontend is built for, and why
  2026-10-21  Ask for Node 22.12 or newer, the oldest 22 that Vite 8 runs on
  2026-10-21  Upgrade Vite 6 to 8 and @vitejs/plugin-react 4 to 6, keeping the browsers Vite 6 built for
  2026-10-21  Give BACKEND_URL's real default in the README, and say it is the backend's private address on Railway

From anywhere in this terminal, `updates` shows the same for every project.
