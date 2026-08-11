---
name: consume-feedback
description: Turn everything captured in .claude/feedback/pending/ into a durable, structured queue at .claude/feedback/FEEDBACK.md, then clear pending/. Use when the user runs /consume-feedback, or asks to process/file/turn pending feedback into tasks/issues/todos.
---

# Consume feedback

Converts raw captures (`<timestamp>.png` + `<timestamp>.json` pairs in
`.claude/feedback/pending/`) into one structured, append-only file:
`.claude/feedback/FEEDBACK.md`. This is the hook point for wiring capture
into whatever downstream workflow the user actually uses — GitHub issues,
Linear, a TODO list, another skill — without this skill assuming which one.
It only produces the durable file; turning entries into issues/tasks is a
separate step the user drives explicitly.

This is different from `/close-feedback`, which stops the server and gives a
one-off summary without touching the files. `/consume-feedback` works
regardless of whether the server is running, and it mutates state (clears
`pending/`), so only run it when the user actually wants the queue filed.

## Steps

1. List everything in `.claude/feedback/pending/`. If empty, tell the user
   there's nothing to consume and stop here.
2. Ensure `.claude/feedback/archive/` exists (create it if not) — captured
   screenshots move here so `FEEDBACK.md` has a stable path to reference
   even after `pending/` is cleared.
3. For each `<timestamp>.json` / `<timestamp>.png` pair, in capture order
   (oldest first):
   a. Read the JSON sidecar (`url`, `comment`, `captured_at`, `page`,
      `selection`).
   b. Move (don't copy) the PNG to `.claude/feedback/archive/<timestamp>.png`.
   c. Append an entry to `.claude/feedback/FEEDBACK.md` (create the file with
      a `# Feedback` heading if it doesn't exist yet) in this format:

      ```
      ## Item <N> — <short title you infer from the comment>

      **Comment:** <comment, verbatim>
      **URL:** <url, or "(none)">
      **Viewport:** <page.viewport.width>×<page.viewport.height> (omit this line if there's no comment signal that it's layout/responsive-related)
      **Screenshot:** .claude/feedback/archive/<timestamp>.png
      **Captured:** <captured_at>

      ---
      ```

      Number `<N>` sequentially from whatever's already in `FEEDBACK.md` —
      don't renumber existing entries, even across sessions.
   d. Delete the now-filed `.json` sidecar from `pending/` (the PNG has
      already moved out in step b, so `pending/` ends up empty).
4. Report a short summary: how many items were filed, and remind the user
   `FEEDBACK.md` is theirs to wire into whatever they use next — point them
   at it by path rather than guessing what to do with it (open a GitHub
   issue per entry, paste into Linear, treat it as a TODO list, hand
   specific entries to another Claude Code session to fix directly, etc.).
5. Do not act on the feedback yourself (no code edits, no fixing bugs) unless
   the user explicitly asks you to, separately, after the queue is filed.
