# claude-web-feedback

Click-to-comment visual feedback for any web project, no account or SaaS
required. A Chrome extension screenshots the current tab, lets you drag a
rectangle around the exact spot you mean, and sends the screenshot + your
comment to a tiny local server. Everything lands in `.claude/feedback/pending/`
for a [Claude Code](https://claude.com/claude-code) session to read.

Three skills drive it from inside Claude Code: `/open-feedback` starts the
capture server, `/close-feedback` stops it and summarizes what came in, and
`/consume-feedback` turns the queue into a structured file you can wire into
your own workflow (issues, TODOs, another skill, whatever you use).

## Install

```
npx github:gaspergrom/claude-web-feedback
```

This copies `extension/`, `server/`, and the `.claude/skills/{open-feedback,
close-feedback,consume-feedback}` skills into the current directory, and adds
`.claude/feedback/pending/` (plus a small local marker file) to `.gitignore`.
Run it again with `--force` to overwrite files that already exist.

Prefer to do it by hand? Copy `extension/`, `server/`, and
`.claude/skills/{open-feedback,close-feedback,consume-feedback}/` from this
repo into your project yourself.

## One-time setup

Load the extension in Chrome:

1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder in your project
5. Pin it to the toolbar if you want one-click access

## Using it

In Claude Code, run `/open-feedback` to start the local capture server.

1. Navigate to the page you want to comment on.
2. Click the extension icon, or press **Cmd+Shift+S** (Mac) /
   **Ctrl+Shift+S** (Windows/Linux). If the shortcut doesn't fire, check
   `chrome://extensions/shortcuts` — Chrome sometimes reserves a combo for
   itself or another extension; rebind it there directly. A screenshot of the
   current view is pinned full-size over the real page.
3. **To point at a specific spot:** drag a rectangle over it — everything
   outside the selection dims. Click **Clear selection** to start over, or
   skip the drag entirely to comment on the whole visible page.
4. A comment box appears near your selection. Type your comment, then
   **Send** (or Cmd/Ctrl+Enter). **Esc** cancels without sending.
5. The (optionally cropped) screenshot + comment + URL are saved to
   `.claude/feedback/pending/`.

Run `/close-feedback` when you're done — it stops the server and walks
through everything captured so you can decide what to act on. Nothing is
filed or deleted yet at this point; `pending/` is left exactly as it is.

## Wiring it into your workflow

Capture is deliberately workflow-agnostic — this repo doesn't know if you
file bugs in GitHub Issues, Linear, a plain TODO list, or something else, so
it doesn't try to guess. That's what `/consume-feedback` is for: run it
whenever you're ready to actually process the queue, and it turns every
pending capture into one entry in `.claude/feedback/FEEDBACK.md` (comment,
URL, viewport, and a path to the archived screenshot), then clears
`pending/`. It does **not** open issues, create tasks, or touch code itself.

`FEEDBACK.md` is the hook point: point your own tooling at it, or just tell
Claude Code directly — "turn FEEDBACK.md items into GitHub issues," "fix item
3," "add these to my TODO file" — and treat each entry as a plain-text
starting point for whatever you already use.

## How it works

- `extension/` — the Manifest V3 Chrome extension (screenshot, crop overlay,
  comment box).
- `server/server.js` — a zero-dependency Node HTTP server. Listens on
  `127.0.0.1:8787` and only writes inside the project it's run from
  (`.claude/feedback/pending/`). Nothing leaves your machine.
- `.claude/skills/open-feedback/`, `.claude/skills/close-feedback/`,
  `.claude/skills/consume-feedback/` — Claude Code skills that start/stop the
  server, summarize the queue, and file it into `FEEDBACK.md` respectively.

Each capture is a `<timestamp>.png` + `<timestamp>.json` pair. The JSON
sidecar looks like:

```json
{
  "url": "http://localhost:3000/pricing",
  "comment": "nav overlaps logo below 768px",
  "captured_at": "2026-08-11T19:23:01.715Z",
  "page": {
    "title": "Pricing — Acme",
    "viewport": { "width": 768, "height": 1024 },
    "devicePixelRatio": 2,
    "scroll": { "x": 0, "y": 640 },
    "userAgent": "Mozilla/5.0 ..."
  },
  "selection": { "x": 40, "y": 120, "w": 300, "h": 80 }
}
```

`selection` is the on-page crop rectangle (CSS px, viewport-relative) if you
dragged to mark an area — the PNG is already cropped to it, this is just for
reference. `page.viewport` matters most for responsive bugs.

The server only needs to run while you're actively capturing — stop it any
time, it doesn't need to stay up in the background.

If port 8787 is taken by something else on your machine, set
`FEEDBACK_SERVER_PORT` before starting the server, and update `SERVER_URL` in
`extension/overlay.js` to match (the extension is hardcoded to
`127.0.0.1:8787` by default).

## License

MIT
