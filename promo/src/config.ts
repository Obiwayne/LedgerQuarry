// Everything a revision usually touches: timing, copy, numbers, colours.
export const FPS = 60;
export const W = 1080;
export const H = 1920;

export const C = {
  ink: '#0b0d12',
  ink2: '#12151c',
  mint: '#3ddc97',
  mintSoft: 'rgba(61,220,151,0.16)',
  text: '#eef1f6',
  muted: '#a0a8b8',
  faint: '#6c7586',
  brand: '#fd8b40',
  cats: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9'],
};

export const FONT = { display: 'Space Grotesk', body: 'Inter' };

// Scene start frames and lengths (sum = 1200 = 20 s).
export const SCENES = {
  hook: { from: 0, dur: 140 },
  snap: { from: 140, dur: 220 },
  read: { from: 360, dur: 280 },
  track: { from: 640, dur: 210 },
  priv: { from: 850, dur: 200 },
  end: { from: 1050, dur: 150 },
};

// Voiceover: one clip per scene, starting a few frames after the cut.
export const VO = [
  { file: 'vo-1.wav', at: 8, text: 'Still keeping receipts in a drawer?', seconds: 1.66 },
  { file: 'vo-2.wav', at: 150, text: 'Snap it with LedgerQuarry.', seconds: 1.47 },
  { file: 'vo-3.wav', at: 372, text: 'A private AI on your own PC reads the shop, total and tax.', seconds: 4.12 },
  { file: 'vo-4.wav', at: 652, text: 'Your spending, sorted. Budgets and all.', seconds: 2.31 },
  { file: 'vo-5.wav', at: 858, text: 'Paired by QR over Tailscale. Nothing in the cloud.', seconds: 3.08 },
  { file: 'vo-6.wav', at: 1056, text: 'LedgerQuarry. Free and open source.', seconds: 2.2 },
];

export const RECEIPT = { shop: "Gail's Bakery", total: '£14.85', category: 'Eating out', tax: '£2.48' };
export const SPEND = { value: 893.6, label: 'Spent in October' };
export const TREND = [0.86, 0.78, 0.6, 0.76, 0.72, 0.55];
export const CATS = [
  ['Groceries', 0.92, '£428'],
  ['Eating out', 0.48, '£207'],
  ['Transport', 0.16, '£58'],
  ['Bills', 0.13, '£55'],
] as const;
export const URL_TEXT = 'github.com/Obiwayne/LedgerQuarry';
