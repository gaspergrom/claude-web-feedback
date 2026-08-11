(() => {
  // Re-injected fresh each capture (background.js injects this file on
  // every click) — guard so a stray double-trigger doesn't stack overlays.
  if (window.__feedbackOverlayActive) return;
  window.__feedbackOverlayActive = true;

  const SERVER_URL = 'http://127.0.0.1:8787/capture';

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'FEEDBACK_START_OVERLAY') {
      openOverlay(msg.screenshotDataUrl);
    }
  });

  function openOverlay(screenshotDataUrl) {
    const dpr = window.devicePixelRatio || 1;
    const pageMeta = {
      title: document.title,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      devicePixelRatio: dpr,
      scroll: { x: window.scrollX, y: window.scrollY },
      userAgent: navigator.userAgent,
    };

    const root = document.createElement('div');
    root.id = 'feedback-capture-overlay';

    const img = document.createElement('img');
    img.id = 'feedback-capture-img';
    img.src = screenshotDataUrl;
    img.draggable = false;
    root.appendChild(img);

    const dim = document.createElement('div');
    dim.id = 'feedback-capture-dim';
    root.appendChild(dim);

    const selectionBox = document.createElement('div');
    selectionBox.id = 'feedback-capture-selection';
    selectionBox.style.display = 'none';
    root.appendChild(selectionBox);

    const hint = document.createElement('div');
    hint.id = 'feedback-capture-hint';
    hint.textContent = 'Drag to mark the area (optional) — Esc to cancel';
    root.appendChild(hint);

    const panel = document.createElement('div');
    panel.id = 'feedback-capture-panel';
    panel.style.display = 'none';
    panel.innerHTML = `
      <textarea id="feedback-capture-comment" placeholder="What's wrong here? (Cmd+Enter to send)"></textarea>
      <div id="feedback-capture-actions">
        <button id="feedback-capture-clear" type="button">Clear selection</button>
        <button id="feedback-capture-send" type="button">Send</button>
      </div>
      <div id="feedback-capture-status"></div>
    `;
    root.appendChild(panel);

    document.documentElement.appendChild(root);
    root.addEventListener('dragstart', (evt) => evt.preventDefault());
    root.addEventListener('selectstart', (evt) => evt.preventDefault());

    let dragStart = null;
    let selection = null; // {x, y, w, h} in CSS px, viewport-relative

    showPanelFor(null); // panel visible immediately so full-page send needs no drag

    function clientToViewport(evt) {
      return { x: evt.clientX, y: evt.clientY };
    }

    function showPanelFor(sel) {
      panel.style.display = 'block';
      const top = sel ? Math.min(window.innerHeight - 160, sel.y + sel.h + 12) : window.innerHeight - 160;
      const left = sel ? Math.max(12, Math.min(window.innerWidth - 320, sel.x)) : window.innerWidth / 2 - 150;
      panel.style.top = `${Math.max(12, top)}px`;
      panel.style.left = `${left}px`;
      document.getElementById('feedback-capture-comment').focus();
    }

    function updateSelectionBox() {
      if (!selection) {
        selectionBox.style.display = 'none';
        dim.style.clipPath = '';
        return;
      }
      selectionBox.style.display = 'block';
      selectionBox.style.left = `${selection.x}px`;
      selectionBox.style.top = `${selection.y}px`;
      selectionBox.style.width = `${selection.w}px`;
      selectionBox.style.height = `${selection.h}px`;

      const x0 = selection.x, y0 = selection.y, x1 = selection.x + selection.w, y1 = selection.y + selection.h;
      dim.style.clipPath = `polygon(
        0 0, 100% 0, 100% 100%, 0 100%, 0 0,
        ${x0}px ${y0}px, ${x0}px ${y1}px, ${x1}px ${y1}px, ${x1}px ${y0}px, ${x0}px ${y0}px
      )`;
    }

    root.addEventListener('mousedown', (evt) => {
      if (panel.contains(evt.target)) return;
      dragStart = clientToViewport(evt);
      selection = { x: dragStart.x, y: dragStart.y, w: 0, h: 0 };
      panel.style.display = 'none';
      updateSelectionBox();
    });

    root.addEventListener('mousemove', (evt) => {
      if (!dragStart) return;
      const p = clientToViewport(evt);
      selection = {
        x: Math.min(dragStart.x, p.x),
        y: Math.min(dragStart.y, p.y),
        w: Math.abs(p.x - dragStart.x),
        h: Math.abs(p.y - dragStart.y),
      };
      updateSelectionBox();
    });

    root.addEventListener('mouseup', () => {
      if (!dragStart) return;
      dragStart = null;
      if (selection && (selection.w < 6 || selection.h < 6)) {
        selection = null;
        updateSelectionBox();
      }
      showPanelFor(selection);
    });

    function cleanup() {
      window.__feedbackOverlayActive = false;
      root.remove();
      document.removeEventListener('keydown', onKeydown);
    }

    function onKeydown(evt) {
      if (evt.key === 'Escape') {
        cleanup();
        return;
      }
      if ((evt.metaKey || evt.ctrlKey) && evt.key === 'Enter') {
        send();
      }
    }
    document.addEventListener('keydown', onKeydown);

    async function send() {
      const sendBtn = panel.querySelector('#feedback-capture-send');
      const statusEl = panel.querySelector('#feedback-capture-status');
      const comment = panel.querySelector('#feedback-capture-comment').value.trim();

      sendBtn.disabled = true;
      statusEl.textContent = 'Sending…';
      statusEl.className = '';

      try {
        const dataUrl = await cropIfNeeded(img, selection, dpr);
        const res = await fetch(SERVER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: location.href,
            comment,
            screenshot: dataUrl,
            page: pageMeta,
            selection: selection
              ? { x: Math.round(selection.x), y: Math.round(selection.y), w: Math.round(selection.w), h: Math.round(selection.h) }
              : null,
          }),
        });
        if (!res.ok) throw new Error(`server responded ${res.status}`);
        statusEl.textContent = 'Captured ✓';
        statusEl.className = 'ok';
        setTimeout(cleanup, 500);
      } catch (err) {
        statusEl.textContent = `Failed — is the server running? (${err.message})`;
        statusEl.className = 'err';
        sendBtn.disabled = false;
      }
    }

    panel.querySelector('#feedback-capture-send').addEventListener('click', send);
    panel.querySelector('#feedback-capture-clear').addEventListener('click', (evt) => {
      evt.stopPropagation();
      selection = null;
      updateSelectionBox();
      showPanelFor(null);
    });
  }

  function cropIfNeeded(imgEl, selection, dpr) {
    return new Promise((resolve) => {
      const full = new Image();
      full.onload = () => {
        if (!selection) {
          resolve(imgEl.src);
          return;
        }
        // captureVisibleTab returns a physical-pixel PNG; the overlay's
        // selection is in CSS px, so scale by devicePixelRatio to map
        // between them.
        const sx = selection.x * dpr;
        const sy = selection.y * dpr;
        const sw = selection.w * dpr;
        const sh = selection.h * dpr;

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(sw));
        canvas.height = Math.max(1, Math.round(sh));
        canvas.getContext('2d').drawImage(full, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      full.src = imgEl.src;
    });
  }
})();
