# babka.mp4

An interactive datamosh kitchen. You bake a chocolate babka in eight gestures while the picture
behaves like a video file with its keyframes ripped out: real motion vectors drag old pixels,
moving bowls leave echo stacks, the meme soundtrack gets scratched by your hands.

## Run

```
python3 Niepotrzebne/devserver.py 8996
```

Open http://localhost:8996. No build step, three.js r180 from jsDelivr.

## Controls

- Each chapter has one gesture (drag, tap, circle, hold, saw, tear). The hint at the bottom says which.
- Hold Space (or touch with two fingers) to drop all keyframes: the image freezes and smears, the audio stutters.
- Win98 error popups can be dragged (they leave a frozen-window trail) or closed (sometimes they multiply).

## How the mosh works

`src/mosh.js` renders the scene, then a velocity pass (per-object previous matrices), then keeps a
display buffer D that is predicted from the previous D along 16 px block motion vectors plus the
residual of the clean frames: `D' = cur + k * (warp(D, m) + r * (cur - warp(prev, m0)) - cur)`.
With `m = m0`, `r = 1` the picture is clean; amplified vectors, a pointer brush, junk vectors, a
noise flow field and `r -> 0` produce the datamosh. Errors can be hue-rotated and saturated.

## Files

- `src/main.js` boot, loop, input, HUD, effect mixer, meme scheduler
- `src/mosh.js` datamosh pipeline and echo stacks
- `src/audio.js` scratchable deck worklet, master glitch worklet, sampler with psychedelic FX
- `src/kitchen.js`, `src/cake.js` procedural props, babka with morph-target rise, oven
- `src/ch-a.js`, `src/ch-b.js` the chapters, `src/errors.js` popups
- `Niepotrzebne/tools/play.mjs` headless Chrome scenario runner (`scenario.json` plays the whole thing)

## Sound

- `audio/*.mp3`, `audio/crackle.flac`: made with earshot from public-domain recordings, free to use.
- `audio/source.mp3`: the soundtrack of the reference meme video, cut into clips at runtime.
  Third-party content (music and streamer clips): fine for local use, not cleared for a public release.
