# Current LLMC · local voice studio verification

final result: passed

## Findings

No actionable P0/P1/P2 visual findings remain in the checked states. Recognition is a tested local prototype, with the real-audio limitations below; this is not a claim of perfect freestyle transcription.

## Source and implementation

- Current application: `https://github.com/linezerogio/lil-language-mc`, base `34f91cf03667489728b730589b5809398f559adf`, branch `feat/live-rhyme-studio`.
- Local checkout: `/Users/pierreramzy/Documents/GitHub/llmc`.
- Preview: `http://127.0.0.1:3012/`, studio `/studio`.
- Current-home visual truth: `/var/folders/w5/fd0gsd1x0mb573n1pkyvvjj40000gn/T/codex-clipboard-9f4c8b81-4945-4559-b057-ac8d2ddd3b6c.png`, 3454 × 1750 pixels.
- Rhyme-marking visual truth: `/var/folders/w5/fd0gsd1x0mb573n1pkyvvjj40000gn/T/codex-clipboard-2df079d0-a5bc-4f1e-96e7-66802f1d374a.png`, 3404 × 1460 pixels.
- Additional user direction: words arrive before an actual highlighter sweep, a central processing/audio indicator, gentle scrolling and fading, steady text during speech revisions, local/free recognition.
- Evidence directory: `/Users/pierreramzy/Documents/ChatGPT/Linkedin Automation/llmc-live-rhymes-20261024/evidence/`.

## Captures and normalization

- `current-home.png`: current Daily/Endless home plus the new studio link; 1728 × 812 captured pixels.
- `local-rhymes-desktop-final.png`: 1728 × 840 captured pixels; desktop browser reported 1728 × 836 CSS viewport. The four-pixel capture-height difference is recorded rather than treated as a design mismatch.
- `local-rhymes-mobile-final.png`: actual requested 390 × 844 CSS viewport, document width 375 pixels. This is the phone demo at about 00:27, with long wrapped lines, fading, rhyme families and transport visible. A previous mislabeled desktop capture was overwritten by this verified phone capture. Temporary viewport overrides were reset.
- `local-full-model-natural-final.png`: completed natural-speech regression check.
- `local-rhymes-live.png` and `local-rhymes-waveform-final.png`: spoken-rhyme recognition states. Individual screenshots can land on a quiet interval; waveform movement was assessed during playback, not inferred from a still image.
- Full comparisons actually generated and viewed together: `qa-current-home-full.png`, `qa-local-studio-full.png`.
- Focused comparisons actually generated and viewed together: `qa-current-home-controls.png`, `qa-local-studio-highlights.png`.
- Full comparisons crop browser chrome/recommendations out of the supplied references and proportionally scale each view into equal 1100-pixel slots. Focused crops separately compare controls and marked words. No stretching is used.
- Reference CSS viewport and image density were not provided. The production Chrome window showed 75% zoom, while the implementation used its normal viewport. Consequently, full-view density/size differences are not scored as pixel-perfect discrepancies; focused crops compare shapes and relative type/layout treatments.

## State and acceptable differences

The new checkout contains the actual Daily/Endless UI, existing Termina/Neulis typography, brand assets and header links. The new studio is a separate requested interaction, rather than a reproduction of the YouTube page. Its dark LLMC surface, pastels, central input waveform, controls and fading trail are intentional adaptations.

Daily is disabled as **Unavailable** locally because `DATABASE_URL` is absent. The supplied production screenshot shows **PLAY DAILY**. This is the existing application's configuration-dependent state; no Daily data or successful challenge state is fabricated. The studio needs no database.

## Required fidelity surfaces

- **Typography:** existing Termina heading and Neulis body fonts are preserved on the current home. Studio words are large, legible, and retain their DOM identities through edits. Supporting labels remain subordinate. Reference and implementation focused crops show the same basic marker-behind-text treatment.
- **Spacing/layout:** home mode order is preserved and the studio link sits below it. Studio uses source/transcript/relationship columns on desktop and a stacked flow on phone. Transcript rows use natural measured heights with a 28-pixel gap, rather than a fixed pitch. Desktop measured row heights included 115.5 and 57.75 pixels; phone wrapped rows measured about 75.9 pixels. Neighboring rows retain the gap and do not overlap. Phone document width stayed within the viewport.
- **Colors/tokens:** the existing home palette remains intact. Studio uses the LLMC dark/mint direction with stable per-session rhyme colors. Solid exact matches, dashed possible matches, neutral uncertain words, and deliberately fading history are visually distinct. The source's literal palette is not being cloned.
- **Image/assets:** current product logos/icons are reused. New studio icons use Phosphor. Official performance thumbnails and external links are retained; unavailable embedded playback has a thumbnail/link fallback. No artist recording or lyrics are bundled. The bundled voice check is an original synthesized spoken verse.
- **Copy/content:** source choice, local processing, one-time model download, accuracy/speed choice, processing, quiet input, detected audio, cancellation and completed state describe actual behavior. The scripted motion demo is labeled separately from recognized speech.

## Correction/comparison history

1. **P1 · wrong application base.** Initial work used GK-Coding's 2023 `main`. The current LineZero repository was identified and cloned separately; the feature is now based on its Daily/Endless main. Evidence: current-home full and focused comparisons.
2. **P1 · browser speech service unavailable.** Browser `SpeechRecognition` was replaced with local Whisper inference in a worker, WebGPU where available and WASM fallback. Actual recognized audio was verified in Chrome and the in-app browser; neither required a speech-service API key.
3. **P2 · revision flicker.** Text edits formerly regenerated a suffix of word keys and moved row keys. Edit alignment, stable segment/row identities, memoized word rendering and a committed prefix now preserve established text. Regression tests include insertions, punctuation edits, corrections and a shorter final hypothesis.
4. **P2 · erased spoken phrase.** The first distilled recognizer could omit a repeated phrase on finalization, and a short hard audio boundary could misread a word. Accuracy mode now uses full Whisper Small with a full-precision GPU encoder, up to twelve seconds of context, and stable confirmed prefixes. The natural-speech retest produced all 22 expected words in order, apart from punctuation.
5. **P2 · input feedback was decorative.** A real analyser now drives a canvas waveform independently of recognition. Quiet/detected/off states were observed during actual audio playback. Display gain adapts to make low-amplitude input visible without inventing movement.
6. **P2 · wrapped-line spacing.** The fixed 104-pixel pitch was replaced with natural line heights and measured scrolling. New desktop/phone captures and DOM measurements confirm 28-pixel gaps after wrapped rows.

Final full/focused visual comparisons found no additional P0/P1/P2 changes to apply.

## Validation

- Production build passes, including type and lint validation.
- 21 studio checks pass: pronunciation/phrase matching, stable colors, corrections, committed-prefix protection, stable row identities, silence/windowing, queue coalescing, 48 kHz stereo → 16 kHz mono resampling, actual selected-input analyser wiring, stream cleanup and cancellation.
- Natural human speech sample from the official Transformers.js documentation was used temporarily for QA; it is not bundled. The final full-model transcript contained the expected 22 words in sequence. Last measured GPU recognition pass was about 0.8 seconds.
- The final original spoken rhyme sample is 8.2075 seconds long. Actual recognition produced 40 words and four families in Chrome and the in-app browser: light/right/night, flow/grow, spark/mark/dark and pace/space/face. “Write” was recognized as the homophone “right”; this remains a transcription limitation and does not affect that phonetic rhyme relationship.
- Recognition passes in these checks were approximately 0.8–1.4 seconds. These are per-pass processing times, not total caption latency. Input buffering, inference, visual pacing and highlight delay add latency.
- Waveform **Audio detected** was observed while real audio was active, then **Audio off** after completion. Recognition and visible rhyme families continued through real hypotheses; the source text was not inserted into the transcript by the test.
- Chrome and in-app studio consoles were checked after recognition and had no warnings/errors.
- New studio home link, source changes, sample playback, cancellation, pause/reset, typography, desktop composition and phone wrapping were checked. Existing source/family/tempo/highlighter interactions from the first studio iteration remain in place.
- The existing Datamuse-backed suite produced 144 passes and four failures (saw/raw, law/raw, jaw/raw, saline/daily) when network access was available. The evaluator and those tests are unchanged from this repository's main. These are not counted as passing studio checks.

## Residual gaps and limitations

- These clean human/synthesized speech checks do not establish word error rate on fast freestyle, accents, slang or music-heavy audio. No universal accuracy/latency claim is made.
- Native microphone and shared-tab permission flows were covered with lifecycle mocks, not a new human microphone recording. The actual capture worklet, audio graph, local inference, transcript, highlights and waveform were tested end-to-end using audio files.
- Accuracy mode can download roughly 250–600 MB once, depending on CPU/GPU format; speed mode is lighter. Browser cache and GPU availability materially affect startup and performance. WASM fallback exists but was not benchmarked here.
- Native file-picker automation was blocked by the Chrome extension's file-access setting; the app's sample control verified the same decoded-file recognition path without expanding browser permissions. Manual file selection and transcript download were not fully verified by automation.
- Tempo is manual/tap-based. No automatic beat detection, exact word timestamps, or timing score is implemented.
- A full screen-reader, accessibility and performance audit remains future work. The visual trail intentionally fades historical text.

## Implementation checklist

- [x] Correct current repository and isolated feature branch.
- [x] Source/current implementation full and focused comparisons opened together.
- [x] Five fidelity surfaces checked; known P1/P2 issues corrected and retested.
- [x] Real audio inference and rhyme relationships verified in two browsers.
- [x] Desktop and actual phone-width evidence captured; viewport reset.
- [x] Studio checks/build pass; legacy test/configuration gaps recorded accurately.
- [x] Local preview remains available; no push or deployment performed.
