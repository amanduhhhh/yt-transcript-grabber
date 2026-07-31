# YT Transcript Grabber

Saves the transcript YouTube shows in its side panel as a `.txt` file — no
timestamps, no line breaks mid-sentence, no `[music]` tags. Punctuation and
capitalisation are left exactly as YouTube produced them.

## Install

1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked** → pick this folder
4. Reload any YouTube tab that was already open

## Use

Open a video → description → **Show transcript**. Then either:

- click **Copy** or **Download .txt** at the top of the transcript panel, or
- click the extension icon and use the same two buttons there.

The popup's settings are shared with the in-panel buttons.

### A note on copying

The clipboard is written from two different places depending on which button
you press. The in-panel button copies from the page directly. The popup
button cannot — while a popup is open it holds focus, and Chrome refuses
clipboard writes from an unfocused document — so the popup asks the content
script for the text (`YTG_GET_TEXT`) and copies it itself.

## Options

| Option | Default | Notes |
| --- | --- | --- |
| Remove `[bracketed]` tags | on | `[music]`, `[laughter]`, `[clears throat]` |
| One caption per line | off | Off = everything joins into one flowing block |
| Wrap at | 0 | Line width for the flowing block; `0` = no line breaks |

## How it works

YouTube renders every caption segment into the DOM at once, so `content.js`
just reads them:

- Segments: `transcript-segment-view-model` (current UI) or
  `ytd-transcript-segment-renderer` (older UI).
- Caption text: the `span[role="text"]` inside each segment. Timestamps live in
  sibling nodes, so they never enter the text — they are parsed only to sort
  and dedupe segments, because the panel sometimes nests a stray duplicate
  copy out of DOM order.
- One gotcha worth knowing: alongside the visible `0:03` there is a
  screen-reader label reading `"3 seconds"`. A naive `textContent` grab drops
  that phrase into your prose. `TIMESTAMP_JUNK` excludes both.
- Cleaning is just `\s+` → single space per caption, then the captions are
  joined with a space. Captions break mid-sentence, so this reflows them into
  continuous prose.

Downloading is a plain `Blob` + `<a download>` in the page, so the extension
needs no `downloads` permission.

## If it breaks

YouTube renames these class names periodically. The selectors to update all
live at the top of `content.js`: `SEGMENT_SELECTOR` and `TIMESTAMP_JUNK`.
