# Changelog — the latest work on Murengeti Lab System, read from its repository

Written by a script from the repository's own history, so this list keeps up as the project does.

  244 commits · first 2026-09-20 · latest 2026-10-21

  2026-10-21  Record in the architecture notes which browsers the frontend is built for, and why
  2026-10-21  Ask for Node 22.12 or newer, the oldest 22 that Vite 8 runs on
  2026-10-21  Upgrade Vite 6 to 8 and @vitejs/plugin-react 4 to 6, keeping the browsers Vite 6 built for
  2026-10-21  Give BACKEND_URL's real default in the README, and say it is the backend's private address on Railway
  2026-10-21  Sign the tests' tokens with a 32-byte-plus key, and fail the tests if a shorter one comes back
  2026-10-21  Give alembic.ini a path_separator, so Alembic stops warning about its deprecated fallback
  2026-10-20  Log the address and port the backend listens on, which uvicorn leaves out when it is handed a socket
  2026-10-20  Describe the private backend in the architecture notes and give .env.example a private BACKEND_URL
  2026-10-20  Name the frontend's /api/health as the after-deploy check, and check the old backend address still answers 404
  2026-10-20  Say in the README that the backend has no public address and is checked through the frontend's /api/health
  2026-10-20  Bring the README's layout, commands and CI description up to date with the dependency lock and audit
  2026-10-20  Test that constraints.txt pins every package pyproject.toml asks for, within its range

From anywhere in this terminal, `updates` shows the same for every project.
