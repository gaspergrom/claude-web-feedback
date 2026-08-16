#!/usr/bin/env node
// Zero-dependency local capture server for the feedback Chrome extension.
// Receives {url, comment, screenshot} over POST /capture and drops each
// capture into .claude/feedback/pending/ as a PNG + sidecar JSON, ready for
// a Claude Code session to read and act on (see the open-feedback and
// close-feedback skills).

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.FEEDBACK_SERVER_PORT || 8787;
const ROOT = process.cwd();
const PENDING_DIR = path.join(ROOT, '.claude', 'feedback', 'pending');
const CONNECTED_MARKER = path.join(ROOT, '.claude', 'feedback', '.extension-connected');

fs.mkdirSync(PENDING_DIR, { recursive: true });

function timestampSlug(date) {
  return date.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(json);
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/capture') {
    send(res, 404, { error: 'not found' });
    return;
  }

  const chunks = [];
  let size = 0;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > 20 * 1024 * 1024) {
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    let payload;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (err) {
      send(res, 400, { error: 'invalid JSON body' });
      return;
    }

    const { url, comment, screenshot, page, selection } = payload;
    if (!screenshot || typeof screenshot !== 'string') {
      send(res, 400, { error: 'missing screenshot' });
      return;
    }

    const match = screenshot.match(/^data:image\/png;base64,(.+)$/);
    if (!match) {
      send(res, 400, { error: 'screenshot must be a data:image/png;base64 URI' });
      return;
    }

    const now = new Date();
    const slug = timestampSlug(now);
    const pngPath = path.join(PENDING_DIR, `${slug}.png`);
    const jsonPath = path.join(PENDING_DIR, `${slug}.json`);

    if (!fs.existsSync(CONNECTED_MARKER)) fs.writeFileSync(CONNECTED_MARKER, now.toISOString());

    fs.writeFileSync(pngPath, Buffer.from(match[1], 'base64'));
    fs.writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          url: url || null,
          comment: comment || '',
          captured_at: now.toISOString(),
          page: page || null,
          selection: selection || null,
        },
        null,
        2
      )
    );

    const viewportLabel = page && page.viewport ? `${page.viewport.width}×${page.viewport.height}` : 'unknown viewport';
    const cropLabel = selection ? `crop ${selection.w}×${selection.h}` : 'full page';
    console.log(`[feedback] captured ${slug} — ${url || '(no url)'} (${viewportLabel}, ${cropLabel})`);
    console.log(`           "${(comment || '').slice(0, 80)}"`);

    send(res, 200, { ok: true, id: slug });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Feedback capture server listening on http://127.0.0.1:${PORT}`);
  console.log(`Writing captures to ${PENDING_DIR}`);
});
