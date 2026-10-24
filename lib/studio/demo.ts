// Original text for the motion demo. Artist performances always use captured audio, never these words.
export const DEMO_LINES = [
  'I find a spark and leave a mark inside the dark.',
  'I catch the light and let it write across the night.',
  'The way I flow can turn the snow into a glow.',
  'A steady motion like an ocean moving slow.',
  'I had a nice dream, woke up with some ice cream.',
  'I keep the pace and make a space for every face.',
  'Another station, conversation, imagination.',
  'I take my time and build a line around a rhyme.',
  'A little thunder, then I wonder what is under.',
  'I let it breathe and leave a trail of what I weave.',
  'A new direction, more connection, less perfection.',
  'And every sound I send around comes back to ground.'
];

export type Performance = { id: string; artist: string; title: string; venue: string; year: string; url: string };

export const PERFORMANCES: Performance[] = [
  { id: 'YlpN3S16ZAs', artist: 'J. Cole', title: 'L.A. Leakers #108', venue: 'Power 106 Los Angeles', year: '2021', url: 'https://www.youtube.com/watch?v=YlpN3S16ZAs' },
  { id: 'prmQgSpV3fA', artist: 'Black Thought', title: 'Funk Flex #087', venue: 'HOT 97', year: '2017', url: 'https://www.youtube.com/watch?v=prmQgSpV3fA' }
];
