# Local pronunciation matching

The live studio uses two independent browser workers. Whisper supplies words; Wav2Vec2 supplies an unconstrained CTC phoneme sequence from the same 16 kHz PCM. Audio is never sent to either model host or an inference API. Model files are downloaded once and cached by Transformers.js; the sound vocabulary is separately cached in Cache Storage. Both models are free to run.

## Sound model and provenance

- Model: `onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX`
- Immutable revision: `c69750f5043e5e1f8a71ab95dd3b98338c280c92`
- Runtime: existing pinned Transformers.js 3.8.1; quantized `q8` weights, WASM, one thread, separate worker.
- Upstream: Meta `facebook/wav2vec2-lv-60-espeak-cv-ft`, Apache 2.0. Model card and license: https://huggingface.co/onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX
- Research: Xu, Baevski and Auli, *Simple and Effective Zero-shot Cross-lingual Phoneme Recognition* (2021), https://arxiv.org/abs/2109.11680
- Additional download: roughly 318 MB for the sound weights, beyond the transcription model. No weights are committed to LLMC.

The dictionary supplies approximate word boundaries for sequence alignment, not the observed vowel. Alignment preserves decoded substitutions and dropped consonants. Confident observed pronunciations replace the word's dictionary candidates. Unknown slang can receive observed sounds with sufficient confidence and neighboring anchors. Uncertain alignment falls back to the dictionary. Unsupported IPA labels are not invented from spelling.

## Limits

This remains an experimental English phoneme matcher. It is not a trained freestyle assessment model. ASR can mishear slang, CTC can misclassify phones, and word alignment becomes uncertain during very fast or continuous delivery. A bent vowel must be distinguishable to the sound model; arbitrary accents and all intentional slant rhymes are not guaranteed. Stress is approximated for matching; this does not assess performed stress, flow, beat accuracy or artistic quality. Background instrumentals can interfere with both models.

Sound jobs coalesce previews separately from text jobs. Overlapping three-second sound windows reuse earlier phonemes instead of recognizing the entire cumulative recording again. Text continues while phonemes are being recognized. A sound model failure is surfaced in settings and leaves dictionary matching available. Pause or a source change terminates both workers and releases captured audio. Ending a file drains pending sound jobs before closing; the visible transcript is available earlier.

The particle field reacts immediately to measured audio. It continues rippling during inference, then moves into tentative glyph targets and crossfades into confirmed ink over 720 ms, with at most 360 ms of bounded intra-batch ripple staggering. Tentative glyphs are excluded from accessibility text and export. Already published words never retract or change. This visually bridges recognition latency; it does not eliminate inference time.

## Validation

`npm run test:studio` covers acoustic vowel substitutions, dictionary-conflicting pronunciation, out-of-dictionary slang, low-confidence rejection, stable identity alignment after ASR insertions, independent worker scheduling/failure/cancellation, and the existing transcript, audio and rhyme regressions.

`tests/fixtures/studio-heard-phones.json` and `studio-heard-incremental.json` contain actual greedy CTC output from the bundled original `public/studio/voice-sample.wav`, produced by the pinned quantized model locally. The fixture is phonetic output, not a claimed benchmark of freestyle or accent accuracy. Integration checks use the same voice sample through real browser workers.
