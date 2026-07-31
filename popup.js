const DEFAULTS = {
  removeBracketed: true,
  onePerLine: false,
  wrapAt: 0,
};

const CHECKBOXES = ['removeBracketed', 'onePerLine'];

const status = document.getElementById('status');

function setStatus(text, isError) {
  status.textContent = text;
  status.className = isError ? 'error' : '';
}

function syncDisabled() {
  // Wrapping is meaningless when each caption already gets its own line.
  document.getElementById('wrapAt').disabled =
    document.getElementById('onePerLine').checked;
}

function readForm() {
  const opts = {};
  for (const id of CHECKBOXES) opts[id] = document.getElementById(id).checked;
  opts.wrapAt = parseInt(document.getElementById('wrapAt').value, 10) || 0;
  return opts;
}

async function saveForm() {
  await chrome.storage.local.set({ ytgOptions: readForm() });
  syncDisabled();
}

async function load() {
  const stored = await chrome.storage.local.get('ytgOptions');
  const opts = { ...DEFAULTS, ...(stored.ytgOptions || {}) };

  for (const id of CHECKBOXES) document.getElementById(id).checked = opts[id];
  document.getElementById('wrapAt').value = opts.wrapAt;

  syncDisabled();

  for (const id of [...CHECKBOXES, 'wrapAt']) {
    document.getElementById(id).addEventListener('change', saveForm);
  }
}

async function ask(type) {
  await saveForm();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error('No active tab.');
  return chrome.tabs.sendMessage(tab.id, { type });
}

document.getElementById('download').addEventListener('click', async () => {
  setStatus('Reading transcript…');
  try {
    const res = await ask('YTG_DOWNLOAD');
    if (res?.ok) setStatus(`Saved ${res.count} caption lines.`);
    else setStatus(res?.error || 'No transcript found on this page.', true);
  } catch {
    setStatus('Open a YouTube video tab and reload it, then try again.', true);
  }
});

document.getElementById('copy').addEventListener('click', async () => {
  setStatus('Reading transcript…');
  try {
    // The page cannot write to the clipboard while this popup holds focus,
    // so we fetch the text and copy it from here instead.
    const res = await ask('YTG_GET_TEXT');
    if (!res?.ok) {
      return setStatus(res?.error || 'No transcript found on this page.', true);
    }
    await navigator.clipboard.writeText(res.text);
    setStatus(`Copied ${res.count} caption lines.`);
  } catch {
    setStatus('Open a YouTube video tab and reload it, then try again.', true);
  }
});

load();
