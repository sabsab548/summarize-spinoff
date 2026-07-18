# Summarize & Spinoff Character

SillyTavern extension. Adds a button (book icon) to every message's button row.

Clicking it:
1. Generates a summary of the chat so far.
2. Takes the currently active character's description and asks the LLM to adapt
   only the parts affected by plot developments (rest stays ~verbatim).
3. Asks the LLM for 3 new opening messages, in the style of the original first
   message, that fit after the summarized events (separated by `######`, no
   extra commentary — `<think>`/`<thinking>` tags are stripped automatically).
4. Creates a brand-new character ("<Name> (Continued)") with the adapted
   description, the 3 openings as first message + alternate greetings, and the
   original character's avatar image.

## Install (GitHub, ST's "Install from URL")
1. Push this folder's contents to a GitHub repo (files at repo root, not nested).
2. In SillyTavern: Extensions panel → "Install extension" → paste the repo URL.

Or manually: unzip into
`SillyTavern/public/scripts/extensions/third-party/summarize-spinoff/`.

## Notes / things to double check against your ST version
- `generateRaw` is used if available (no chat history injected into the two
  custom prompts); falls back to `generateQuietPrompt` otherwise.
- Avatar is fetched from `/characters/<filename>` — adjust if your ST build
  serves character images from a different route.
- Character creation posts to `/api/characters/create` as multipart form data —
  field names match ST's current character-create endpoint; tweak if it
  changes in a future ST release.
