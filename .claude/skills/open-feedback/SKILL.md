---
name: open-feedback
description: Start the local feedback capture server so screenshots + comments from the Chrome extension can be collected. Use when the user runs /open-feedback, or asks to start/turn on visual feedback capture.
---

# Open feedback capture

Starts the local capture server that the Chrome extension (`extension/`) sends
screenshots and comments to. Captures land in `.claude/feedback/pending/` as
`<timestamp>.png` + `<timestamp>.json` pairs.

## Steps

1. Check whether a server is already listening on port 8787 (or
   `$FEEDBACK_SERVER_PORT` if the user has set one). If so, tell the user
   capture is already running and stop here.
2. Start `node server/server.js` from the project root as a persistent
   background process (use the `Monitor` tool with `persistent: true` if
   available, filtering/describing on the `[feedback] captured` log line so
   new captures surface as notifications; otherwise run it with
   `run_in_background: true`).
3. **Check whether the extension has ever connected.** The server touches
   `.claude/feedback/.extension-connected` the first time it receives a
   capture — that's the only reliable signal available (Chrome doesn't
   expose extension state to a local script). If that file does not exist,
   assume the extension isn't loaded yet and walk the user through it:
   - Open `chrome://extensions` for them (`open -a "Google Chrome" chrome://extensions` on
     macOS, `start chrome chrome://extensions` on Windows, `xdg-open chrome://extensions`
     on Linux — best-effort, fine if it fails silently on a headless/remote setup).
   - Print the absolute path to `extension/` in this project (resolve it, don't
     make the user do the math) and these steps:
     1. Turn on **Developer mode** (top right toggle).
     2. Click **Load unpacked**.
     3. Select the `extension/` folder at the path above.
     4. Pin it to the toolbar if you want one-click access.
   - Tell them once it's loaded, capture with the extension icon or
     **Cmd+Shift+S** (Mac) / **Ctrl+Shift+S** (Windows/Linux) on any page.
4. If `.extension-connected` already exists, skip the walkthrough — just
   remind them how to capture (icon click or the shortcut above) since
   they've clearly done this before.
5. If a capture notification arrives while this session is still open, you
   may briefly acknowledge it ("captured — nav overlaps logo on mobile") but
   don't process or file it yet; that happens in `/close-feedback` or whenever
   the user asks you to look at pending feedback.

## Notes

- The server only writes inside `.claude/feedback/pending/` in the current
  project — nothing leaves the machine.
- If port 8787 is already taken by something unrelated, tell the user to set
  `FEEDBACK_SERVER_PORT` before starting the server, and to also update the
  extension's `SERVER_URL` (`extension/overlay.js`) to match, since the
  extension is hardcoded to `127.0.0.1:8787` by default.
