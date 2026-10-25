# LLMC voice cloud and word formation

Date: 25 October 2026
Branch: feat/live-rhyme-studio
final result: passed

## Comparison target and evidence

Motion reference: https://linezero-capabilities.pierreramzy.chatgpt.site/
User target: a persistent particle cloud at the bottom center, responding to speech and lending its particles to the next word.

Local evidence folder: `/Users/pierreramzy/Documents/ChatGPT/Linkedin Automation/llmc-particle-flow-20261025/`.

- Source visual truth: `reference-cloud.png`, `reference-formed.png` and the three user attachments.
- Implementation: `final-demo-00.png` through `final-demo-21.png`, `final-voice-00.png` through `final-voice-35.png`, `final-audio-result.png`.
- Full comparison: `reference-implementation-comparison.png` puts the actual source and implementation in the same image.
- Focused comparison: `focused-word-handoff.png` shows the actual glyph handoff and reservoir at readable scale.
- Animation: `particle-word-flow.gif`, recorded from the clearly labelled scripted motion demo. Its captured frame intervals are retained; it is not a transcription speed benchmark.
- Browser observations: `final-demo-observations.json`, `final-voice-observations.json`, `final-browser-state.json`, `validation-summary.json`.
- Capture geometry: source 1265 x 720 CSS pixels at reported DPR 2, returned PNG 1265 x 712 pixels; implementation 1280 x 720 CSS pixels at DPR 2, returned PNG 1280 x 720 pixels. The browser tool returns images normalized to approximately CSS-pixel scale. The full comparison aspect-fits the source into a 1280 x 720 cell; this is a qualitative motion comparison, not a claim of pixel-identical page layout.
- Desktop implementation viewport: 1280 x 720 CSS pixels. Screenshots are compared at their captured scale; no phone frame or device emulation was added. The source is an effect reference, not a request to clone its page layout, object, red branding or particle count. The current LLMC typography and palette are intentional.

## Findings and comparison history

1. Earlier studio implementation: expanding rings beside the caption frontier did not provide the requested fixed source or continuous journey into letters. Replaced with one 2,800-particle pool at the bottom center. Real time-domain amplitude and frequency bins drive its deformation; its grains peel off toward the transcript while recognition works.
2. First visual pass, P2: solid ink started while some grains were still travelling. Evidence: `voice-gap-13.png`, `voice-form-04.png`, `iteration-1-comparison.png`. Corrected the timeline so grains finish the glyph geometry before ink appears. A hypothesis that has already gathered has a shorter landing; a fresh confirmed word completes within 650 ms, plus the existing small batch stagger.
3. Post-fix pass: `final-demo-*`, `final-voice-*` and the combined comparisons were opened and reviewed. Glyphs gather before the handoff, ink remains steady, and the rhyme marker starts its sweep at the handoff with zero animation delay. No actionable P0, P1 or P2 issue remains for this scoped desktop motion change.

## Required fidelity surfaces

- Fonts and typography: preserved Neulis Sans, the existing 500 weight, tracking, wrapping and line height. The checked desktop word size was 31.36 px with a 49.5488 px line height. Glyph particles use actual DOM character positions to retain font geometry. Solid captions remain selectable HTML text.
- Spacing and layout rhythm: existing header, small play control, verse area and scroll controls remain. The cloud adds no layout panel. Its stage-local center stayed at x=576, y=523 throughout both final recordings. Canvas pointer events remain disabled.
- Colors and tokens: retained the charcoal background and LLMC mint, purple and rhyme colors. The reference's red is intentionally not imported.
- Image quality and assets: the requested effect is live procedural canvas, not a raster illustration. No logo or image was approximated, no asset placeholders were added, and no new image or animation dependency was installed.
- Copy and content: product controls and captions are unchanged. The demo is clearly labelled; speech verification uses the actual bundled audio path with the local model. No expected transcript was injected into the UI.

## Functional and regression verification

- All 64 studio checks pass: the previous 58 and six particle timing/geometry checks. In particular, unconfirmed hypotheses cannot create ink, a confirmed hypothesis continues its existing formation, ink waits for the geometry, and ribbons finish exactly on their targets.
- Production build, type checking and lint pass. Only existing module-type/browser-data freshness notices remain.
- Final spoken-audio run: 40 words, all settled and fully opaque; zero browser console errors.
- Across 22 final demo frames and 36 final voice frames: zero changed, retracted or replayed published words. Highlight delays were 0 seconds. The cloud center stayed fixed as words arrived.
- Real input was detected before any word existed: the first voice frames show nonzero amplitude and travelling grains with zero caption words. Later frames show tentative particle glyphs, then confirmed ink.
- Scrollback was checked with the 116-word demo: Home reached scrollTop=0, older rows stayed at full opacity and Back to live resumed following. Evidence: `scrollback.png`, `scrollback-observation.json`. The final timing-only correction does not change that path.
- Source selection, file playback, reset, dialog close and return to live were exercised. The preview remains local.

## Practical limits and follow-up

The cloud gives immediate audio feedback; recognizable letter shapes still require a model hypothesis. This change does not improve recognition accuracy or remove actual inference time. Local decoding can still deliver words in batches. The six unit checks cover reduced waiting and geometry; the operating system's reduced-motion preference and low-powered/mobile hardware were not changed or benchmarked during this pass. The existing reduced-motion fallback exposes text immediately and keeps the audio status available.

## Implementation checklist

- [x] Persistent audio-reactive cloud at the bottom center.
- [x] Reuse travelling voice grains for the next recognized word.
- [x] Sample exact glyph positions and finish geometry before ink.
- [x] Start detected rhyme sweeps without an extra timer.
- [x] Keep published words stable and manual history review usable.
- [x] Run studio regressions, build and browser comparison.
