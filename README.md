# YT Transcript Grabber
lets you download any youtube video transcript (the auto-generated captions). 
- i noticed a lot of online sites say they can "generate transcripts" with youtube links but they just run some subpar bot that mishears a bunch of things. i think youtube's autogen captions are pretty good, and they already have a feature for you to view the transcript.
- i just simply scrape the html and normalize the content in the transcript modal

## To use
1. click this button in the video description
<img width="600" height="400" alt="image" src="https://github.com/user-attachments/assets/0f0e21aa-d885-4340-8403-ac17756e9afc" />

2. simply click download or copy. YAY!!!
<img width="300" height="400" alt="image" src="https://github.com/user-attachments/assets/f61973d8-988d-4111-9fd5-f95467733866" />


## Install

1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked** → pick this folder
4. Reload any YouTube tab that was already open


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
live at the top of `content.js`: `SEGMENT_SELECTOR` and `TIMESTAMP_JUNK`. I'll try to update periodically but 
