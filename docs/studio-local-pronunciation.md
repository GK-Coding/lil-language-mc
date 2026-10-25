# Local pronunciation matching

The live studio uses two independent browser workers. Moonshine supplies streaming words by default; Whisper remains selectable for comparison. Wav2Vec2 supplies an unconstrained CTC phoneme sequence from the same 16 kHz PCM. Audio is never sent to either model host or an inference API. Model files are downloaded on first use and cached locally. All inference is free to run.

## Streaming voice choices

- `Moonshine · Live accuracy`: English Medium Streaming through the official, MIT-licensed `@moonshine-ai/moonshine-wasm` package, pinned to `0.1.5`.
- `Moonshine · Live speed` (default): English Small Streaming through the same runtime. This gave earlier stable captions than Medium in the checked local sample; it is not a universal speed or accuracy benchmark.
- `Whisper · Accuracy` and `Whisper · Speed`: retain the existing local Small English and Base English models, with WebGPU where available and WASM fallback.
- Sources: https://moonshine-voice.readthedocs.io/en/latest/using/transcription/ and https://www.npmjs.com/package/@moonshine-ai/moonshine-wasm

Moonshine uses the studio's existing selected-input capture, rather than opening another microphone. Non-overlapping 16 kHz PCM enters one streaming recognizer, with a 250 ms update interval. A bounded 40-second audio history extracts each caption's actual sound by its model timestamps for the independent phoneme worker. Pending input coalesces while inference runs; a four-second backlog surfaces a device-speed error and releases capture instead of silently accumulating delay. File completion flushes the stream and drains sound jobs. Pause/source change cancels both workers.

The threaded WASM runtime needs cross-origin isolation. Only `/studio` and its assets receive COOP `same-origin` and COEP `credentialless`; other game routes are unaffected. The official performance embed is credentialless-compatible and retains its external-link fallback. Browsers that cannot initialize this runtime show an error with a Whisper alternative. Medium/Small need their own first-use model download; the roughly 318 MB sound model is additional. Model weights are not committed.

Confirmed captions are append-only. Repeated hypotheses must agree before publishing a prefix, and a later substitution retains the already displayed spelling without appending a duplicate correction. This deliberately trades late spelling corrections for a stable performance view. The 250 ms decode interval is not a promise of 250 ms caption latency: model computation, evidence for confirmation, device/browser load and visual formation also contribute.

## Sound model and provenance

- Model: `onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX`
- Immutable revision: `c69750f5043e5e1f8a71ab95dd3b98338c280c92`
- Runtime: existing pinned Transformers.js 3.8.1; quantized `q8` weights, WASM, one thread, separate worker.
- Upstream: Meta `facebook/wav2vec2-lv-60-espeak-cv-ft`, Apache 2.0. Model card and license: https://huggingface.co/onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX
- Research: Xu, Baevski and Auli, *Simple and Effective Zero-shot Cross-lingual Phoneme Recognition* (2021), https://arxiv.org/abs/2109.11680
- Additional download: roughly 318 MB for the sound weights, beyond the transcription model. No weights are committed to LLMC.

The dictionary supplies approximate word boundaries and a lexical stress prior for sequence alignment, not the observed vowel. Alignment preserves decoded substitutions and dropped consonants. An aligned vowel keeps its lexical primary, secondary, or unstressed position instead of assigning primary stress to every vowel. This is a lexical prior, not a measurement of performed prominence. Confident observed pronunciations replace the word's dictionary candidates, so bent vowels remain available for comparison. Unknown slang can receive observed sounds with sufficient confidence and neighboring anchors. A single unknown syllable can supply a rhyme nucleus; unknown multisyllable prominence stays uncertain and can produce only possible matches, which disappear when possible rhymes are disabled. Uncertain alignment falls back to the dictionary. Unsupported IPA labels are not invented from spelling.

Rhyme sessions rebuild live membership from current evidence using canonical sound IDs. A possible-rhyme bridge cannot alias two later exact groups into one. Matched word spans supply both markers and panel examples, so invalidated members disappear from both. Confirmed historical spans survive the 320-word comparison boundary without duplicating occurrences; later sound changes invalidate their affected spans. Mixed groups explicitly say they include possible matches.

## Limits

This remains an experimental English phoneme matcher. It is not a trained freestyle assessment model. ASR can mishear slang, CTC can misclassify phones, and word alignment becomes uncertain during very fast or continuous delivery. A bent vowel must be distinguishable to the sound model; arbitrary accents and all intentional slant rhymes are not guaranteed. Stress is approximated for matching; this does not assess performed stress, flow, beat accuracy or artistic quality. Background instrumentals can interfere with both models.

Sound jobs coalesce previews separately from text jobs. Overlapping three-second sound windows reuse earlier phonemes instead of recognizing the entire cumulative recording again. Text continues while phonemes are being recognized. A sound model failure is surfaced in settings and leaves dictionary matching available. Pause or a source change terminates both workers and releases captured audio. Ending a file drains pending sound jobs before closing; the visible transcript is available earlier.

The particle field reacts immediately to measured audio. It continues rippling during inference, then moves into tentative glyph targets and crossfades into confirmed ink over 720 ms, with at most 360 ms of bounded intra-batch ripple staggering. Tentative glyphs are excluded from accessibility text and export. Already published words never retract or change. This visually bridges recognition latency; it does not eliminate inference time.

## Validation

`npm run test:studio` covers acoustic vowel substitutions, dictionary-conflicting pronunciation, out-of-dictionary slang, low-confidence rejection, stable identity alignment after ASR insertions, independent worker scheduling/failure/cancellation, and the existing transcript, audio and rhyme regressions.

`tests/fixtures/studio-heard-phones.json` and `studio-heard-incremental.json` contain actual greedy CTC output from the bundled original `public/studio/voice-sample.wav`, produced by the pinned quantized model locally. The fixture is phonetic output, not a claimed benchmark of freestyle or accent accuracy. Integration checks use the same voice sample through real browser workers.
