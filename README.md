This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Live rhyme studio

Open **Live rhyme studio** on the home screen, or visit `/studio`.

- **Demo** plays an original synthesized instrumental with a clearly labeled scripted verse. Every rhyme is detected by the real pronunciation engine; the highlights are not hand-tagged.
- **My mic** transcribes your microphone using the browser speech recognition service. Desktop Chrome or Edge is recommended. Recognition can send audio to the browser vendor's speech service; this is not an offline recognizer.
- **Freestyles** includes the official J. Cole L.A. Leakers #108 and Black Thought Funk Flex #087 players. Press Listen, choose the browser tab playing the performance, and enable **Share tab audio**. Audio-track recognition needs desktop Chromium 135 or newer. No artist audio files or lyrics are bundled with the project.

Scroll tempo is adjustable and includes tap tempo. It is a visual pacing control, not automatic beat detection. The demo's original instrumental shares the studio tempo. When the embedded player is already playing as listening starts, its playback clock drives the trail. An external tab uses a local clock and tap tempo. Live transcript arrival times are not used to claim beat or syllable timing accuracy.

Words appear first; the highlighter sweeps in after the configurable delay once a matching sound is found. Older rows scroll and fade. The local engine uses CMU pronunciations to compare internal rhymes, multisyllable endings, and short phrases across word boundaries. Possible consonant matches use a lighter, dashed highlight. Unknown words stay neutral; dictionary pronunciations cannot capture every accent or bent vowel.

The live studio requires neither a database nor an API key. The original typing game still uses its existing PostgreSQL configuration.

Run `npm run test:studio` on Node 22.18+ to exercise rhyme matching, provisional words, phrase matching, stable family colors, and transcript corrections.

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
