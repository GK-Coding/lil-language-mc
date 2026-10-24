## Live rhyme studio

This feature branch is based on `linezerogio/lil-language-mc` (the Daily/Endless application), rather than the older `GK-Coding/lil-language-mc` checkout.

Open **Live rhyme studio** below the home screen's play controls, or visit `/studio`.

- **My mic** runs recognition locally in a Web Worker. The waveform reads the actual selected input independently of recognition and distinguishes quiet input from detected audio. Audio is not sent to a speech API, and no API key is required.
- **Accuracy first** uses `onnx-community/whisper-small.en`; **Speed first** uses `onnx-community/whisper-base.en`. WebGPU is preferred where the model and driver support it, with a WASM CPU fallback. The first use downloads the model from Hugging Face (roughly 250–600 MB for Accuracy first, depending on backend/precision); model files are cached by the browser. Clearing browser storage removes that cache.
- **Try voice sample** in My mic plays a bundled original synthesized spoken sample through the actual local recognizer. This validates the audio/recognition path; it is not a rap accuracy benchmark.
- **Freestyles** links to the official J. Cole L.A. Leakers #108 and Black Thought Funk Flex #087 performances. Choose the playing tab and enable **Share tab audio**, or use **Open audio file** for a local clip. Artist recordings and lyrics are not bundled. Audio files are limited to 100 MB and five minutes.
- **Demo** is an explicitly scripted visual demonstration over an original synthesized instrumental. Its words still go through the real phonetic matcher.

The local speech runtime is copied from the pinned npm package into `public/studio/vendor/` by `predev`/`prebuild`. These generated files are gitignored. No runtime JavaScript CDN is required. Fonts, thumbnails, model downloads and the original application's integrations can still make network requests; local recognition does not mean the entire application is offline.

Recognition produces revisable partial utterances. Repeatedly confirmed prefixes are kept when a later partial or final hypothesis tries to erase them. This favors stable live captions over rewriting the entire utterance at the end. Edit alignment and stable row identities prevent corrections from replaying the arrival animation for the whole line. Burst arrivals are paced over a small visual buffer; this is a display effect, not word-level vocal timing. Exact/phrase rhyme highlights wait for stable text, then sweep in after the chosen highlighter delay. Near rhymes have a lighter dashed marker. The existing writing-game scorer is preserved; the studio has a separate rolling phonetic matcher backed by the same CMU pronunciation source.

Tempo is manual or tap-based, not automatic beat detection. The demo shares the beat's audio clock. Microphone and local audio transcription use a presentation clock; no beat-placement or syllable-timing score is claimed. Recognition speed and accuracy depend on hardware, accent, delivery and the backing track. A bounded queue coalesces stale partial hypotheses while preserving final utterances; it stops with an explanation if the device cannot keep up.

The studio does not need PostgreSQL. Daily/Endless modes still need the existing database configuration. The PostHog provider now skips initialization when its key is absent; studio content carries the no-capture class.

Run `npm run test:studio` on Node 22.18+ for phonetic matching, stable word/row identities, audio resampling, partial-window backpressure, selected-input monitoring and cancellation cleanup. Existing rhyme tests remain under `npm test` and contact Datamuse.

Speech implementation references: [Transformers.js pipeline API](https://huggingface.co/docs/transformers.js/v3.8.1/pipelines), [WebGPU support](https://huggingface.co/docs/transformers.js/v3.8.1/guides/webgpu).

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
