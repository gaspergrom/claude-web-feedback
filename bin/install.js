#!/usr/bin/env node
// Copies the extension, server, and Claude Code skills into the project
// that ran `npx claude-web-feedback`. Skips any file that already exists
// unless --force is passed.

const fs = require('fs');
const path = require('path');

const PKG_ROOT = path.join(__dirname, '..');
const DEST_ROOT = process.cwd();
const FORCE = process.argv.includes('--force');

const TARGETS = [
  ['extension', 'extension'],
  ['server', 'server'],
  [path.join('.claude', 'skills', 'open-feedback'), path.join('.claude', 'skills', 'open-feedback')],
  [path.join('.claude', 'skills', 'close-feedback'), path.join('.claude', 'skills', 'close-feedback')],
  [path.join('.claude', 'skills', 'consume-feedback'), path.join('.claude', 'skills', 'consume-feedback')],
];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  if (fs.existsSync(dest) && !FORCE) {
    console.log(`  skip (exists)  ${path.relative(DEST_ROOT, dest)}`);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`  wrote          ${path.relative(DEST_ROOT, dest)}`);
}

console.log('Installing claude-web-feedback into', DEST_ROOT, '\n');

for (const [srcRel, destRel] of TARGETS) {
  copyRecursive(path.join(PKG_ROOT, srcRel), path.join(DEST_ROOT, destRel));
}

const gitignorePath = path.join(DEST_ROOT, '.gitignore');
const ignoreLines = ['.claude/feedback/pending/', '.claude/feedback/.extension-connected'];
if (fs.existsSync(gitignorePath)) {
  let contents = fs.readFileSync(gitignorePath, 'utf8');
  const missing = ignoreLines.filter((line) => !contents.includes(line));
  if (missing.length) {
    contents += `${contents.endsWith('\n') || contents === '' ? '' : '\n'}${missing.join('\n')}\n`;
    fs.writeFileSync(gitignorePath, contents);
    console.log(`  updated        .gitignore (added ${missing.join(', ')})`);
  }
} else {
  fs.writeFileSync(gitignorePath, `${ignoreLines.join('\n')}\n`);
  console.log(`  wrote          .gitignore`);
}

console.log(`
Done. Next steps:
  1. Load the extension: chrome://extensions -> Developer mode -> Load unpacked -> select "extension/"
  2. In Claude Code, run /open-feedback to start the capture server
  3. Click the extension icon (or Cmd/Ctrl+Shift+S) on any page to capture feedback
  4. Run /close-feedback when you're done to stop the server and review what came in
`);
