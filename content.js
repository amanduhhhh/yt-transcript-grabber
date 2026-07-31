/* YT Transcript Grabber — reads the open transcript panel, saves or copies it */

const DEFAULTS = {
  removeBracketed: true, // [music], [laughter], [clears throat]
  onePerLine: false, // otherwise everything joins into one flowing block
  wrapAt: 0, // 0 = no wrapping
};

/* ---------- scraping ---------- */

// New (view-model) UI first, legacy renderer second.
const SEGMENT_SELECTOR =
  'transcript-segment-view-model, ytd-transcript-segment-renderer';

// Anything inside a segment that is a timestamp, including the screen-reader
// label ("3 seconds") that would otherwise leak into the text.
const TIMESTAMP_JUNK =
  '[class*="Timestamp"], .segment-timestamp, .segment-start-offset';

function segmentText(el) {
  // The caption body is the only [role="text"] span in the new UI.
  const span = el.querySelector('span[role="text"], .segment-text');
  if (span) return span.textContent;

  const clone = el.cloneNode(true);
  clone.querySelectorAll(TIMESTAMP_JUNK).forEach((n) => n.remove());
  return clone.textContent;
}

// Timestamps never reach the output — they are read only to order and dedupe
// the segments, since the panel sometimes nests a stray copy out of order.
function segmentStamp(el) {
  const stamp = el.querySelector(
    '.ytwTranscriptSegmentViewModelTimestamp, .segment-timestamp'
  );
  return stamp ? stamp.textContent.trim() : '';
}

function stampToSeconds(stamp) {
  const parts = stamp.split(':').map((p) => parseInt(p, 10));
  if (parts.some(Number.isNaN)) return Number.MAX_SAFE_INTEGER;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

function collectSegments() {
  const nodes = [...document.querySelectorAll(SEGMENT_SELECTOR)];
  const seen = new Set();
  const out = [];

  for (const el of nodes) {
    const text = segmentText(el).replace(/\s+/g, ' ').trim();
    if (!text) continue;

    const stamp = segmentStamp(el);
    const key = `${stamp}|${text}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ seconds: stampToSeconds(stamp), text });
  }

  out.sort((a, b) => a.seconds - b.seconds);
  return out;
}

/* ---------- cleaning ---------- */

function clean(text, opts) {
  let s = text;
  if (opts.removeBracketed) s = s.replace(/\[[^\]]*\]/g, ' ');
  // Collapses every newline, tab and run of spaces into single spaces.
  return s.replace(/\s+/g, ' ').trim();
}

function wrap(text, width) {
  if (!width || width < 20) return text;
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

function formatTranscript(segments, opts) {
  const cleaned = segments.map((s) => clean(s.text, opts)).filter(Boolean);
  if (opts.onePerLine) return cleaned.join('\n');
  // Captions split mid-sentence, so a plain space rejoins them into prose.
  return wrap(cleaned.join(' '), opts.wrapAt);
}

const NO_TRANSCRIPT =
  'No transcript found. Open the video description, click "Show transcript", then try again.';

async function build() {
  const segments = collectSegments();
  if (!segments.length) return { ok: false, count: 0, error: NO_TRANSCRIPT };

  const stored = await chrome.storage.local.get('ytgOptions');
  const opts = { ...DEFAULTS, ...(stored.ytgOptions || {}) };

  return {
    ok: true,
    count: segments.length,
    text: formatTranscript(segments, opts),
  };
}

/* ---------- output ---------- */

function filename() {
  const title = document.title.replace(/\s*-\s*YouTube\s*$/, '').trim();
  const id = new URLSearchParams(location.search).get('v');
  const safe = (title || 'transcript')
    .replace(/[<>:"/\\|?*]/g, '') // illegal in Windows filenames
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return `${safe}${id ? ` [${id}]` : ''}.txt`;
}

function save(text) {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'text/plain;charset=utf-8' })
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = filename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older fallback, for when the async clipboard API is blocked.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

function toast(message, isError) {
  document.querySelector('.ytg-toast')?.remove();
  const el = document.createElement('div');
  el.className = `ytg-toast${isError ? ' ytg-toast-error' : ''}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

async function runDownload() {
  const res = await build();
  if (!res.ok) return toast(res.error, true), res;
  save(res.text);
  toast(`Saved ${res.count} caption lines.`);
  return res;
}

async function runCopy() {
  const res = await build();
  if (!res.ok) return toast(res.error, true), res;

  const copied = await copyText(res.text);
  if (!copied) {
    toast('Could not reach the clipboard — try Download instead.', true);
    return { ok: false, count: 0, error: 'Clipboard blocked.' };
  }
  toast(`Copied ${res.count} caption lines.`);
  return res;
}

/* ---------- in-page buttons ---------- */

function mountButtons() {
  const header = document.querySelector('.ytSectionListRendererHeader');
  if (!header || header.querySelector('.ytg-row')) return;

  const row = document.createElement('div');
  row.className = 'ytg-row';

  for (const [label, title, action] of [
    ['Copy', 'Copy this transcript to the clipboard', runCopy],
    ['Download .txt', 'Download this transcript as a text file', runDownload],
  ]) {
    const btn = document.createElement('button');
    btn.className = 'ytg-btn';
    btn.type = 'button';
    btn.textContent = label;
    btn.title = title;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      action();
    });
    row.appendChild(btn);
  }

  header.appendChild(row);
}

const observer = new MutationObserver(() => mountButtons());
observer.observe(document.documentElement, { childList: true, subtree: true });
mountButtons();

/* ---------- popup bridge ---------- */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // The popup holds focus while it is open, which blocks clipboard writes from
  // this page — so it asks for the text and does the copying on its own side.
  if (msg?.type === 'YTG_GET_TEXT') {
    build().then(sendResponse);
    return true;
  }
  if (msg?.type === 'YTG_DOWNLOAD') {
    runDownload().then(sendResponse);
    return true;
  }
});
