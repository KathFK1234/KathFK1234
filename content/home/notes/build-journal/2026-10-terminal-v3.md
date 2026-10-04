# 2026-10 — rebuilding this terminal as v3

v2 was a single HTML file: styles, content, and shell logic together. It worked, and every change meant editing one very long file.

What changed in v3:

- Vite + React + TypeScript instead of one page.
- The simulated file system became a real folder, `content/home`. Writing a note is now "add a markdown file".
- `cd`, `ls`, `cat`, `grep`, `find`, and `tree` all read the same tree, so they can no longer disagree with each other.
- A block cursor that blinks like a terminal's, themes, and fonts.

Lesson: when content and code live in the same file, neither gets edited as often as it should.
