---
name: close-feedback
description: Stop the local feedback capture server and summarize what was captured. Use when the user runs /close-feedback, or asks to stop/turn off visual feedback capture, or wants to review what's pending.
---

# Close feedback capture

Stops the capture server started by `/open-feedback` and reports on what's
sitting in `.claude/feedback/pending/`.

## Steps

1. Stop the background server process started by `/open-feedback` (`TaskStop`
   if it was launched via `Monitor`/background task; otherwise tell the user
   how to Ctrl+C it if they started it themselves in a terminal). If nothing
   is running, skip straight to step 2.
2. List everything in `.claude/feedback/pending/`. If it's empty, tell the
   user there's nothing captured and stop here.
3. For each `<timestamp>.json` / `<timestamp>.png` pair, read the JSON
   sidecar (`url`, `comment`, `page.viewport`, `selection`) and view the
   screenshot. Summarize each item in one or two lines: what page it's on,
   what the comment says, and the viewport if the comment reads like a
   responsive/layout issue.
4. Present the summary as a numbered list so the user can point at specific
   items in follow-up. Do not delete, rename, or move any files — leave
   `.claude/feedback/pending/` exactly as it is; filing/acting on items is a
   separate step the user drives explicitly (e.g. "fix item 3", or run
   `/consume-feedback` to turn the whole queue into a structured file they
   can wire into their own workflow).
