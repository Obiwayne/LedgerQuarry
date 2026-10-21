// Promo v2: the snappier "Apple-style" cut (see STORYBOARD-v2.md).
import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { C, FONT, FPS, RECEIPT, SPEND, TREND, CATS, URL_TEXT } from './config';
import { Counter, EASE, IN, OUT, Phone, Tap, useIn } from './kit';
import { useFonts } from './Promo';

const L = { bg: '#f4f5f7', text: '#0f1115', muted: '#5b6372', card: '#ffffff' };

export const S2 = {
  open: { from: 0, dur: 96 },
  punch: { from: 96, dur: 84 },
  meet: { from: 180, dur: 120 },
  snap: { from: 300, dur: 180 },
  read: { from: 480, dur: 180 },
  track: { from: 660, dur: 180 },
  priv: { from: 840, dur: 150 },
  logo: { from: 990, dur: 120 },
  end: { from: 1110, dur: 90 },
};

const VO2 = [
  ['v2-1.wav', 6, 1.23], ['v2-2.wav', 98, 1.48], ['v2-3.wav', 196, 1.13], ['v2-4.wav', 318, 0.97], ['v2-5.wav', 498, 2.08],
  ['v2-6.wav', 676, 1.21], ['v2-7.wav', 856, 1.17], ['v2-8.wav', 1000, 0.87], ['v2-9.wav', 1116, 1.18],
] as const;
const WHOOSH = [94, 178, 298, 478, 658, 838, 988, 1108];
const POP = [204, 382, 530, 676, 860, 1004];
const CLICK = [404];

// ---------------------------------------------------------------- pieces

const GLYPH: Record<string, string> = {
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/><path d="M10 10h4v4h-4z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  receipt: '<path d="M6 3h12v18l-2-1.3L14 21l-2-1.3L10 21l-2-1.3L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
};
const TILE_BG: Record<string, string> = {
  camera: 'linear-gradient(160deg,#6ff5bb,#22b97a)',
  chip: 'linear-gradient(160deg,#9db4ff,#5161e8)',
  lock: 'linear-gradient(160deg,#ffd27a,#f29a1f)',
  check: 'linear-gradient(160deg,#6ff5bb,#22b97a)',
  receipt: 'linear-gradient(160deg,#ffffff,#e6e9ef)',
};

/** Glossy app-icon tile that sits inside a line of type. */
const Tile: React.FC<{ kind: string; size: number; delay: number; logo?: boolean }> = ({ kind, size, delay, logo }) => {
  const p = useIn(delay, 11);
  return (
    <span style={{ display: 'inline-grid', placeItems: 'center', width: size, height: size, borderRadius: size * 0.26, verticalAlign: 'middle', margin: `0 ${size * 0.14}px`, position: 'relative', top: -size * 0.06, background: logo ? 'transparent' : TILE_BG[kind], boxShadow: logo ? 'none' : `0 ${size * 0.12}px ${size * 0.3}px rgba(0,0,0,0.22), inset 0 2px 0 rgba(255,255,255,0.5)`, transform: `scale(${p}) rotate(${(1 - p) * -18}deg)` }}>
      {logo ? <Img src={staticFile('logo.svg')} style={{ width: size, height: size, borderRadius: size * 0.26, boxShadow: `0 ${size * 0.12}px ${size * 0.3}px rgba(0,0,0,0.25)` }} /> : (
        <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke={kind === 'receipt' ? '#0f1115' : '#fff'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: GLYPH[kind] }} />
      )}
    </span>
  );
};

type Part = string | { tile: string; logo?: boolean };

/** A line of kinetic type: words rise in 3 frames apart; tiles pop in place. */
const Line: React.FC<{ parts: Part[]; delay: number; size?: number; color?: string; top: number; accent?: string; exitAt?: number }> = ({ parts, delay, size = 104, color = L.text, top, accent, exitAt }) => {
  const f = useCurrentFrame();
  const out = exitAt === undefined ? 0 : interpolate(f, [exitAt, exitAt + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: IN });
  let i = 0;
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top, textAlign: 'center', font: `700 ${size}px/1.08 ${FONT.display}`, letterSpacing: '-0.035em', color, opacity: 1 - out, transform: `translateY(${-50 * out}px) scale(${1 - out * 0.05})` }}>
      {parts.flatMap((p) => (typeof p === 'string' ? p.split(' ').filter(Boolean).map((w) => ({ w })) : [{ tile: p.tile, logo: p.logo }])).map((p: any, k) => {
        const d = delay + i++ * 3;
        if (p.tile) return <Tile key={k} kind={p.tile} size={size * 1.02} delay={d} logo={p.logo} />;
        return <Word key={k} w={p.w} delay={d} accent={accent && p.w.replace(/[^\w]/g, '') === accent} />;
      })}
    </div>
  );
};

const Word: React.FC<{ w: string; delay: number; accent?: boolean | string }> = ({ w, delay, accent }) => {
  const p = useIn(delay, 13);
  return <span style={{ display: 'inline-block', margin: '0 0.12em', opacity: Math.min(1, p * 1.6), transform: `translateY(${(1 - p) * 70}px)`, color: accent ? C.mint : undefined }}>{w}</span>;
};

/** One word that slams in and is knocked out by the next. */
const Punch: React.FC<{ word: string; at: number; until: number; color?: string; size?: number }> = ({ word, at, until, color = C.text, size = 190 }) => {
  const f = useCurrentFrame();
  const p = useIn(at, 12);
  const out = interpolate(f, [until - 6, until], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (f < at || f >= until) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 820, textAlign: 'center', font: `700 ${size}px ${FONT.display}`, letterSpacing: '-0.04em', color, transform: `scale(${1.6 - p * 0.6 + out * 0.15})`, opacity: Math.min(1, p * 2) * (1 - out), filter: `blur(${(1 - p) * 10}px)` }}>{word}</div>
  );
};

const WhiteCard: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div style={{ borderRadius: 40, background: L.card, boxShadow: '0 40px 90px rgba(17,24,39,0.14), 0 2px 0 rgba(255,255,255,0.8) inset', border: '1.5px solid rgba(15,17,21,0.06)', ...style }}>{children}</div>
);

// ---------------------------------------------------------------- scenes

const Open: React.FC = () => {
  const f = useCurrentFrame();
  const tiles = [[-340, -360, -16], [330, -330, 14], [-300, 370, 9], [310, 340, -10]] as const;
  return (
    <AbsoluteFill>
      <Line parts={['Receipts.']} delay={4} size={170} color={C.text} top={700} />
      <Line parts={['everywhere.']} delay={34} size={120} color={C.mint} top={900} />
      {tiles.map(([x, y, r], i) => {
        const p = useIn(30 + i * 4, 12);
        return (
          <div key={i} style={{ position: 'absolute', left: 540 - 70 + x * p, top: 900 - 70 + y * p, transform: `rotate(${r * p + Math.sin((f + i * 30) / 30) * 3}deg) scale(${p})` }}>
            <Tile kind="receipt" size={140} delay={30 + i * 4} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const PunchScene: React.FC = () => (
  <AbsoluteFill>
    <Punch word="Lost." at={2} until={32} />
    <Punch word="Faded." at={32} until={60} color="rgba(238,241,246,0.55)" />
    <Punch word="Forgotten." at={60} until={84} size={170} />
  </AbsoluteFill>
);

const Meet: React.FC = () => {
  const f = useCurrentFrame();
  const drop = useIn(22, 13);
  const away = interpolate(f, [96, 110], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: IN });
  return (
    <AbsoluteFill>
      <WhiteCard style={{ position: 'absolute', left: 70, right: 70, top: 220 - (1 - drop) * 300 - away * 300, padding: '30px 36px', borderRadius: 46, background: 'rgba(255,255,255,0.86)', backdropFilter: 'blur(30px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, font: `600 26px ${FONT.body}`, color: L.muted, letterSpacing: '0.02em' }}>
          <Img src={staticFile('logo.svg')} style={{ width: 52, height: 52, borderRadius: 14 }} /> LEDGERQUARRY <span style={{ marginLeft: 'auto', fontWeight: 500 }}>now</span>
        </div>
        <div style={{ font: `700 40px ${FONT.body}`, color: L.text, marginTop: 14 }}>Receipt read</div>
        <div style={{ font: `500 36px ${FONT.body}`, color: L.muted, marginTop: 4 }}>{RECEIPT.shop} · {RECEIPT.total} · {RECEIPT.category}</div>
      </WhiteCard>
      <Line parts={['Meet']} delay={10} size={110} color={L.muted} top={760} exitAt={104} />
      <Line parts={[{ tile: 'logo', logo: true }, 'LedgerQuarry']} delay={16} size={104} top={900} exitAt={104} />
    </AbsoluteFill>
  );
};

const PHONE_W = 520;
const PHONE_H = PHONE_W * (2517 / 1236);

const SnapScene: React.FC = () => {
  const f = useCurrentFrame();
  const rise = useIn(16, 14);
  const press = 104;
  const flash = interpolate(f, [press + 2, press + 6, press + 22], [0, 0.95, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const showReading = interpolate(f, [press + 10, press + 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const left = (1080 - PHONE_W) / 2;
  const top = 520;
  const sx = left + 14 + (618 / 1236) * PHONE_W;
  const sy = top + 14 + (580 / 1236) * PHONE_W;
  const btn = interpolate(f, [press, press + 4, press + 8], [1, 0.96, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const drop = useIn(press + 14, 13);
  return (
    <AbsoluteFill>
      <Line parts={['Snap', { tile: 'camera' }, 'it.']} delay={4} size={124} top={250} />
      <div style={{ position: 'absolute', left, top: top + (1 - rise) * 1100, transform: `scale(${btn})`, transformOrigin: `${sx - left}px ${sy - top}px` }}>
        <Phone src="phone-reading.png" width={PHONE_W}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: (1340 / 1236) * PHONE_W, height: (280 / 1236) * PHONE_W, background: '#0f1218', opacity: 1 - showReading }} />
          <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: flash }} />
        </Phone>
      </div>
      <Img src={staticFile('sample-receipt.jpg')} style={{ position: 'absolute', width: 220, left: 540 - 110, top: top + 520 - (1 - drop) * 560, transform: `rotate(${-8 + drop * 8}deg) scale(${1 - drop * 0.55})`, opacity: f < press + 14 ? 0 : 1 - interpolate(f, [press + 36, press + 48], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), borderRadius: 12, boxShadow: '0 30px 60px rgba(0,0,0,0.35)' }} />
      <Tap from={[900, 1750]} to={[sx, sy]} start={56} travel={42} pressAt={press} />
    </AbsoluteFill>
  );
};

const Row: React.FC<{ label: string; value: string; delay: number; big?: boolean }> = ({ label, value, delay, big }) => {
  const p = useIn(delay, 14);
  const tick = useIn(delay + 8, 11);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto', alignItems: 'center', gap: 18, padding: '22px 0', borderBottom: '2px solid rgba(15,17,21,0.06)', opacity: Math.min(1, p * 1.6), transform: `translateY(${(1 - p) * 30}px)` }}>
      <span style={{ width: 40, height: 40, borderRadius: 20, display: 'grid', placeItems: 'center', background: C.mint, transform: `scale(${tick})` }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#062016" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
      </span>
      <span style={{ font: `500 34px ${FONT.body}`, color: L.muted }}>{label}</span>
      <span style={{ font: `${big ? 700 : 600} ${big ? 56 : 40}px ${FONT.display}`, color: L.text, letterSpacing: '-0.02em' }}>{value}</span>
    </div>
  );
};

const ReadScene: React.FC = () => {
  const f = useCurrentFrame();
  const slide = interpolate(f, [0, 28], [0, 1], { extrapolateRight: 'clamp', easing: EASE });
  const card = useIn(40, 13);
  return (
    <AbsoluteFill>
      <Line parts={['Read by AI', { tile: 'chip' }]} delay={8} size={110} top={210} />
      <Line parts={['on your PC.']} delay={20} size={110} top={340} accent="PC" />
      <div style={{ position: 'absolute', left: (1080 - PHONE_W) / 2 - slide * 300, top: 520 + slide * 120, transform: `scale(${1 - slide * 0.18}) rotate(${-slide * 6}deg)`, opacity: 1 - slide * 0.25 }}>
        <Phone src="phone-reading.png" width={PHONE_W} overlaySrc="phone-read.png" overlayOpacity={interpolate(f, [90, 104], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      </div>
      <WhiteCard style={{ position: 'absolute', left: 150, right: 60, top: 820 + (1 - card) * 140, padding: '30px 40px 18px', opacity: card, transform: `scale(${0.92 + card * 0.08})` }}>
        <div style={{ font: `700 38px ${FONT.display}`, color: L.text, marginBottom: 6 }}>Receipt read</div>
        <Row label="Shop" value={RECEIPT.shop} delay={58} />
        <Row label="Total" value={RECEIPT.total} delay={70} big />
        <Row label="Category" value={RECEIPT.category} delay={82} />
        <Row label="VAT" value={RECEIPT.tax} delay={94} />
      </WhiteCard>
    </AbsoluteFill>
  );
};

const TrackScene: React.FC = () => {
  const f = useCurrentFrame();
  const card = useIn(8, 13);
  const cats = useIn(46, 13);
  return (
    <AbsoluteFill>
      <WhiteCard style={{ position: 'absolute', left: 80, right: 80, top: 330 + (1 - card) * 160, padding: '40px 46px', opacity: card }}>
        <div style={{ font: `500 34px ${FONT.body}`, color: L.muted }}>{SPEND.label}</div>
        <div style={{ font: `700 124px/1.1 ${FONT.display}`, color: L.text, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}><Counter value={SPEND.value} delay={16} /></div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: 200, marginTop: 24 }}>
          {TREND.map((h, i) => {
            const g = interpolate(f, [26 + i * 4, 54 + i * 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: OUT });
            return <div key={i} style={{ flex: 1, height: `${h * 100 * g}%`, borderRadius: '12px 12px 4px 4px', background: i === TREND.length - 1 ? `linear-gradient(180deg,#6ff5bb,${C.mint})` : '#e6e9ef' }} />;
          })}
        </div>
      </WhiteCard>
      <WhiteCard style={{ position: 'absolute', left: 80, right: 80, top: 990 + (1 - cats) * 120, padding: '24px 46px', opacity: cats }}>
        {CATS.slice(0, 3).map(([name, w, amt], i) => {
          const g = interpolate(f, [52 + i * 4, 84 + i * 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: OUT });
          return (
            <div key={name} style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 20, alignItems: 'center', padding: '14px 0' }}>
              <div>
                <div style={{ font: `600 32px ${FONT.body}`, color: L.text, marginBottom: 10 }}>{name}</div>
                <div style={{ height: 14, borderRadius: 7, background: '#eef0f4' }}><div style={{ height: '100%', width: `${w * 100 * g}%`, borderRadius: 7, background: C.cats[i] }} /></div>
              </div>
              <div style={{ font: `700 38px ${FONT.display}`, color: L.text, textAlign: 'right' }}>{amt}</div>
            </div>
          );
        })}
      </WhiteCard>
      <Line parts={['Sorted.', { tile: 'check' }]} delay={70} size={140} top={1430} />
    </AbsoluteFill>
  );
};

const PrivScene: React.FC = () => {
  const f = useCurrentFrame();
  const flip = useIn(8, 13);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 540 - 230, top: 380, width: 460, height: 460, perspective: 1200 }}>
        <WhiteCard style={{ width: '100%', height: '100%', padding: 30, transform: `rotateY(${(1 - flip) * 80}deg) scale(${0.8 + flip * 0.2})`, opacity: Math.min(1, flip * 1.5) }}>
          <Img src={staticFile('qr.png')} style={{ width: '100%', height: '100%' }} />
        </WhiteCard>
      </div>
      <Line parts={['Private.', { tile: 'lock' }]} delay={22} size={130} top={980} />
      <Line parts={['No cloud.']} delay={40} size={130} top={1140} color={C.mint} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1330, textAlign: 'center', font: `500 34px ${FONT.body}`, color: L.muted, opacity: interpolate(f, [56, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>Paired by QR over Tailscale</div>
    </AbsoluteFill>
  );
};

const LogoScene: React.FC = () => {
  const f = useCurrentFrame();
  const pop = useIn(4, 10);
  const slide = interpolate(f, [26, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE });
  const word = interpolate(f, [34, 58], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: OUT });
  const tag = useIn(70, 13);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 540 - 100 - slide * 350, top: 740, transform: `scale(${pop})` }}>
        <Img src={staticFile('logo.svg')} style={{ width: 200, height: 200, borderRadius: 50, boxShadow: '0 40px 90px rgba(17,24,39,0.25)' }} />
      </div>
      <div style={{ position: 'absolute', left: 320, top: 772, font: `700 96px ${FONT.display}`, letterSpacing: '-0.04em', color: L.text, clipPath: `inset(0 ${(1 - word) * 100}% 0 0)` }}>LedgerQuarry</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1060, textAlign: 'center', font: `600 76px ${FONT.display}`, color: L.muted, letterSpacing: '-0.02em', opacity: tag, transform: `translateY(${(1 - tag) * 40}px)` }}>Track every receipt.</div>
    </AbsoluteFill>
  );
};

const EndScene: React.FC = () => {
  const logo = useIn(4, 11);
  const a = useIn(14, 13);
  const b = useIn(22, 13);
  return (
    <AbsoluteFill>
      <Img src={staticFile('logo.svg')} style={{ position: 'absolute', left: 540 - 110, top: 600, width: 220, height: 220, transform: `scale(${logo})`, filter: 'drop-shadow(0 30px 70px rgba(61,220,151,0.35))' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 880, textAlign: 'center', font: `700 104px ${FONT.display}`, letterSpacing: '-0.03em', color: C.text, opacity: a, transform: `translateY(${(1 - a) * 30}px)` }}>LedgerQuarry</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1010, textAlign: 'center', font: `600 50px ${FONT.display}`, color: C.mint, opacity: a }}>Free and open source</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1120, textAlign: 'center', opacity: b, transform: `translateY(${(1 - b) * 24}px)` }}>
        <span style={{ display: 'inline-block', padding: '16px 30px', borderRadius: 20, background: 'rgba(255,255,255,0.07)', border: '2px solid rgba(255,255,255,0.14)', font: `500 36px ${FONT.body}`, color: C.text }}>{URL_TEXT}</span>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- stage and audio

/** Dark → light (mint circle wipe at the cut to "Meet") → dark for the end card. */
const Stage: React.FC = () => {
  const f = useCurrentFrame();
  const r = interpolate(f, [S2.meet.from - 4, S2.meet.from + 16], [0, 120], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: OUT });
  const ring = interpolate(f, [S2.meet.from - 4, S2.meet.from + 16], [0, 140], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: OUT });
  const back = f >= S2.end.from ? 0 : 1;
  const a = 30 + Math.sin(f / 70) * 10;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(900px 700px at 50% 40%, rgba(61,220,151,0.14), transparent 60%), ${C.ink}` }} />
      <AbsoluteFill style={{ background: C.mint, clipPath: `circle(${ring}% at 50% 48%)`, opacity: back && f < S2.meet.from + 20 ? 1 : 0 }} />
      <AbsoluteFill style={{ clipPath: `circle(${r}% at 50% 48%)`, opacity: back, background: `radial-gradient(800px 700px at ${a}% 20%, rgba(61,220,151,0.18), transparent 60%), radial-gradient(800px 700px at ${100 - a}% 85%, rgba(144,133,233,0.16), transparent 60%), ${L.bg}` }} />
    </AbsoluteFill>
  );
};

function musicVolume(f: number) {
  let duck = 0;
  for (const [, at, sec] of VO2) {
    const end = at + sec * FPS;
    duck = Math.max(duck, interpolate(f, [at - 8, at, end, end + 10], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  }
  return (0.42 - duck * 0.2) * interpolate(f, [1150, 1200], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

const Shot: React.FC<{ s: { from: number; dur: number }; children: React.ReactNode; push?: number }> = ({ s, children, push = 0.04 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, s.dur], [0, 1], { extrapolateRight: 'clamp', easing: EASE });
  return <AbsoluteFill style={{ transform: `scale(${1 + push * p}) translateY(${Math.sin(f / 40) * 3}px)` }}>{children}</AbsoluteFill>;
};

/** `music: false` renders voice and effects only, so the music can be ducked under the voice in ffmpeg (see `npm run mix:v2`). */
export const PromoV2: React.FC<{ music?: boolean }> = ({ music = true }) => {
  useFonts();
  const shots: [{ from: number; dur: number }, React.FC][] = [
    [S2.open, Open], [S2.punch, PunchScene], [S2.meet, Meet], [S2.snap, SnapScene], [S2.read, ReadScene],
    [S2.track, TrackScene], [S2.priv, PrivScene], [S2.logo, LogoScene], [S2.end, EndScene],
  ];
  return (
    <AbsoluteFill style={{ fontFamily: FONT.body }}>
      <Stage />
      {shots.map(([s, Scene], i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.dur}>
          <Shot s={s}><Scene /></Shot>
        </Sequence>
      ))}
      {VO2.map(([file, at, sec]) => (
        <Sequence key={file} from={at} durationInFrames={Math.ceil(sec * FPS) + 20}><Audio src={staticFile(file)} /></Sequence>
      ))}
      {WHOOSH.map((at) => <Sequence key={`w${at}`} from={at - 6} durationInFrames={30}><Audio src={staticFile('sfx-whoosh.wav')} volume={0.22} /></Sequence>)}
      {POP.map((at) => <Sequence key={`p${at}`} from={at} durationInFrames={10}><Audio src={staticFile('sfx-pop.wav')} volume={0.28} /></Sequence>)}
      {CLICK.map((at) => <Sequence key={`c${at}`} from={at} durationInFrames={6}><Audio src={staticFile('sfx-click.wav')} volume={0.4} /></Sequence>)}
      {music ? <Audio src={staticFile('house.wav')} volume={(f) => musicVolume(f)} /> : null}
    </AbsoluteFill>
  );
};
