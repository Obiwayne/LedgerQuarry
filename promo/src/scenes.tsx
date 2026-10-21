import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { C, CATS, FONT, RECEIPT, SCENES, SPEND, TREND, URL_TEXT } from './config';
import { Camera, Card, Counter, EASE, IN, OUT, Phone, Tap, Title, useIn, useOut } from './kit';

const PHONE_W = 560;
const PHONE_H = PHONE_W * (2517 / 1236);
const centre = (w: number, h: number, dy = 0): React.CSSProperties => ({ position: 'absolute', left: (1080 - w) / 2, top: (1920 - h) / 2 + dy, width: w, height: h });

// ---------------------------------------------------------------- 1. Hook

const PaperReceipt: React.FC<{ i: number }> = ({ i }) => {
  const lines = 5 + (i % 3);
  return (
    <div style={{ width: 300, padding: '26px 24px 34px', background: '#f7f4ec', borderRadius: 6, boxShadow: '0 30px 60px rgba(0,0,0,0.5)', clipPath: 'polygon(0 0,100% 0,100% 94%,92% 100%,84% 94%,76% 100%,68% 94%,60% 100%,52% 94%,44% 100%,36% 94%,28% 100%,20% 94%,12% 100%,4% 94%,0 100%)' }}>
      <div style={{ height: 18, width: '62%', margin: '0 auto 18px', background: '#2b2b2b', borderRadius: 4 }} />
      {Array.from({ length: lines }).map((_, k) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ height: 10, width: `${40 + ((k * 17 + i * 11) % 35)}%`, background: '#9a9588', borderRadius: 3 }} />
          <div style={{ height: 10, width: '16%', background: '#9a9588', borderRadius: 3 }} />
        </div>
      ))}
      <div style={{ borderTop: '3px dashed #777', margin: '10px 0 12px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ height: 16, width: '30%', background: '#2b2b2b', borderRadius: 4 }} />
        <div style={{ height: 16, width: '24%', background: '#2b2b2b', borderRadius: 4 }} />
      </div>
    </div>
  );
};

const PILE = [
  [-170, 60, -14], [150, 20, 11], [-40, 140, -4], [210, 180, 16], [-230, 230, -19], [40, 270, 7], [-110, 330, 12],
];

export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const exit = useOut(SCENES.hook.dur - 16, 16);
  return (
    <Camera dur={SCENES.hook.dur} from={1} to={1.06}>
      <Title text="Still keeping receipts in a drawer?" accent="drawer" top={260} size={104} delay={6} exitAt={SCENES.hook.dur - 14} />
      {PILE.map(([x, y, r], i) => {
        const p = useIn(14 + i * 4, 13);
        return (
          <div key={i} style={{ position: 'absolute', left: 540 - 150 + x - exit * 900, top: 720 + y - (1 - p) * 900, transform: `scale(0.9) rotate(${r + (1 - p) * 30 + Math.sin((f + i * 20) / 40) * 1.2}deg)`, opacity: Math.min(1, p * 2) }}>
            <PaperReceipt i={i} />
          </div>
        );
      })}
    </Camera>
  );
};

// ---------------------------------------------------------------- 2. Snap

export const Snap: React.FC = () => {
  const f = useCurrentFrame();
  const rise = useIn(4, 15);
  const press = 92;
  const flash = interpolate(f, [press + 2, press + 6, press + 22], [0, 0.95, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const showReading = interpolate(f, [press + 10, press + 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const btn = interpolate(f, [press, press + 4, press + 8], [1, 0.96, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const phoneTop = (1920 - PHONE_H) / 2 + 170;
  const phoneLeft = (1080 - PHONE_W) / 2;
  // Shutter centre in the capture: (618, 580) of 1236 px wide.
  const sx = phoneLeft + 14 + (618 / 1236) * PHONE_W;
  const sy = phoneTop + 14 + (580 / 1236) * PHONE_W;
  const drop = useIn(press + 16, 13);
  return (
    <Camera dur={SCENES.snap.dur} from={1} to={1.05} y={[0, -20]}>
      <Title text="Snap it." accent="Snap" top={230} size={128} delay={4} />
      <div style={{ position: 'absolute', left: phoneLeft, top: phoneTop + (1 - rise) * 900, transform: `scale(${btn})`, transformOrigin: `${sx - phoneLeft}px ${sy - phoneTop}px` }}>
        <Phone src="phone-reading.png" width={PHONE_W}>
          {/* Hide the upload card (capture rows 1340–1620) until the photo is taken. */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: (1340 / 1236) * PHONE_W, height: (280 / 1236) * PHONE_W, background: '#0f1218', opacity: 1 - showReading }} />
          <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: flash }} />
        </Phone>
      </div>
      {/* The receipt photo drops from above into the upload card. */}
      <Img
        src={staticFile('sample-receipt.jpg')}
        style={{ position: 'absolute', width: 230, left: 540 - 115 + (1 - drop) * 40, top: phoneTop + 560 - (1 - drop) * 520, transform: `rotate(${-6 + drop * 6}deg) scale(${1 - drop * 0.55})`, opacity: f < press + 16 ? 0 : 1 - interpolate(f, [press + 40, press + 52], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), borderRadius: 12, boxShadow: '0 30px 70px rgba(0,0,0,0.6)' }}
      />
      <Tap from={[880, 1700]} to={[sx, sy]} start={40} travel={40} pressAt={press} />
    </Camera>
  );
};

// ---------------------------------------------------------------- 3. Read

const Field: React.FC<{ label: string; value: string; delay: number; big?: boolean }> = ({ label, value, delay, big }) => {
  const p = useIn(delay, 15);
  const f = useCurrentFrame();
  const typed = Math.max(0, Math.min(value.length, Math.floor((f - delay) / 1.6)));
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '20px 0', borderBottom: '2px solid rgba(255,255,255,0.07)', opacity: Math.min(1, p * 1.5), transform: `translateX(${(1 - p) * 40}px)` }}>
      <span style={{ font: `500 34px ${FONT.body}`, color: C.muted }}>{label}</span>
      <span style={{ font: `${big ? 700 : 600} ${big ? 52 : 40}px ${FONT.display}`, color: C.text }}>{value.slice(0, typed)}</span>
    </div>
  );
};

export const Read: React.FC = () => {
  const f = useCurrentFrame();
  const phoneTop = (1920 - PHONE_H) / 2 + 170;
  const phoneLeft = (1080 - PHONE_W) / 2;
  const card = useIn(64, 14);
  const done = useIn(178, 10);
  const shimmer = (f * 9) % 1400;
  const reading = interpolate(f, [150, 168], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const exit = useOut(SCENES.read.dur - 16, 16);
  const chip = useIn(26, 14);
  return (
    <Camera dur={SCENES.read.dur} from={1.04} to={1.12} y={[-20, -60]}>
      <div style={{ position: 'absolute', left: phoneLeft, top: phoneTop, opacity: 1 - exit, transform: `translateX(${-exit * 600}px)` }}>
        <Phone src="phone-reading.png" width={PHONE_W} overlaySrc="phone-read.png" overlayOpacity={1 - reading} />
      </div>
      <div style={{ position: 'absolute', left: 540 - 230, top: 300, transform: `scale(${chip})`, opacity: chip * (1 - exit) }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, padding: '16px 28px', borderRadius: 99, background: C.mintSoft, border: `2px solid rgba(61,220,151,0.45)`, font: `600 34px ${FONT.body}`, color: C.mint }}>
          <span style={{ width: 16, height: 16, borderRadius: 8, background: C.mint, boxShadow: `0 0 0 ${6 + Math.sin(f / 6) * 3}px rgba(61,220,151,0.25)` }} />
          AI on your own PC
        </div>
      </div>
      <Card style={{ position: 'absolute', left: 110, right: 110, top: 980 - (1 - card) * 120, padding: '34px 46px 30px', opacity: card * (1 - exit), transform: `scale(${0.9 + card * 0.1}) translateX(${exit * 200}px)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <div style={{ width: 54, height: 54, borderRadius: 16, display: 'grid', placeItems: 'center', background: done > 0.05 ? C.mint : 'rgba(255,255,255,0.08)', transform: `scale(${0.6 + done * 0.4 + (done > 0.98 ? 0 : 0)})` }}>
            {done > 0.05 ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" strokeDasharray="24" strokeDashoffset={24 * (1 - done)} /></svg>
            ) : null}
          </div>
          <div style={{ font: `600 38px ${FONT.display}`, color: C.text, position: 'relative', overflow: 'hidden' }}>
            {f < 178 ? 'Reading your receipt…' : 'Receipt read'}
            {f < 178 ? <div style={{ position: 'absolute', top: 0, bottom: 0, left: shimmer - 400, width: 200, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)' }} /> : null}
          </div>
        </div>
        <Field label="Shop" value={RECEIPT.shop} delay={96} />
        <Field label="Total" value={RECEIPT.total} delay={112} big />
        <Field label="Category" value={RECEIPT.category} delay={128} />
        <Field label="VAT" value={RECEIPT.tax} delay={144} />
      </Card>
    </Camera>
  );
};

// ---------------------------------------------------------------- 4. Track

export const Track: React.FC = () => {
  const f = useCurrentFrame();
  const whip = interpolate(f, [0, 26], [1, 0], { extrapolateRight: 'clamp', easing: OUT });
  const desk = useIn(4, 16);
  const kpi = useIn(22, 14);
  const bars = useIn(40, 16);
  const cats = useIn(70, 15);
  return (
    <Camera dur={SCENES.track.dur} from={1} to={1.05}>
      <Title text="Track it." accent="Track" top={200} size={128} delay={8} />
      {/* The real dashboard, dimmed, as the stage. */}
      <div style={{ position: 'absolute', left: 60, top: 470, width: 1360, transformOrigin: 'top left', transform: `translateX(${whip * 1100}px) scale(${0.708}) skewX(${whip * -8}deg)`, opacity: desk }}>
        <Img src={staticFile('desktop-dashboard.png')} style={{ width: 1360, borderRadius: 26, boxShadow: '0 0 0 3px rgba(255,255,255,0.12), 0 60px 140px rgba(0,0,0,0.6)', filter: 'brightness(0.45) saturate(0.8)' }} />
      </div>
      <Card style={{ position: 'absolute', left: 90, right: 90, top: 560 + (1 - kpi) * 80, padding: '34px 44px', opacity: kpi, background: 'linear-gradient(160deg, rgba(61,220,151,0.22), rgba(19,22,29,0.92) 60%)', borderColor: 'rgba(61,220,151,0.35)' }}>
        <div style={{ font: `500 34px ${FONT.body}`, color: C.muted }}>{SPEND.label}</div>
        <div style={{ font: `700 112px/1.1 ${FONT.display}`, color: C.text, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}><Counter value={SPEND.value} delay={30} /></div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, height: 170, marginTop: 20 }}>
          {TREND.map((h, i) => {
            const g = interpolate(f, [44 + i * 4, 74 + i * 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: OUT });
            return <div key={i} style={{ flex: 1, height: `${h * 100 * g}%`, borderRadius: '10px 10px 0 0', background: i === TREND.length - 1 ? `linear-gradient(180deg, #6ff5bb, ${C.mint})` : 'rgba(255,255,255,0.16)', opacity: bars }} />;
          })}
        </div>
      </Card>
      <Card style={{ position: 'absolute', left: 90, right: 90, top: 1060 + (1 - cats) * 80, padding: '30px 44px', opacity: cats }}>
        {CATS.map(([name, w, amt], i) => {
          const g = interpolate(f, [78 + i * 4, 112 + i * 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: OUT });
          return (
            <div key={name} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 20, alignItems: 'center', padding: '12px 0' }}>
              <div>
                <div style={{ font: `500 32px ${FONT.body}`, color: C.text, marginBottom: 10 }}>{name}</div>
                <div style={{ height: 14, borderRadius: 7, background: 'rgba(255,255,255,0.07)' }}><div style={{ height: '100%', width: `${w * 100 * g}%`, borderRadius: 7, background: C.cats[i] }} /></div>
              </div>
              <div style={{ font: `700 36px ${FONT.display}`, color: C.text, textAlign: 'right' }}>{amt}</div>
            </div>
          );
        })}
      </Card>
    </Camera>
  );
};

// ---------------------------------------------------------------- 5. Private

const Device: React.FC<{ kind: 'phone' | 'pc'; x: number; delay: number }> = ({ kind, x, delay }) => {
  const p = useIn(delay, 13);
  const w = kind === 'phone' ? 120 : 210;
  const h = kind === 'phone' ? 220 : 140;
  return (
    <div style={{ position: 'absolute', left: x - w / 2, top: 1140 - h / 2, width: w, height: h, transform: `scale(${p})`, opacity: p }}>
      <div style={{ width: '100%', height: '100%', borderRadius: kind === 'phone' ? 26 : 16, border: '6px solid rgba(238,241,246,0.85)', background: 'rgba(61,220,151,0.10)' }} />
      {kind === 'pc' ? <div style={{ width: 90, height: 10, margin: '12px auto 0', borderRadius: 5, background: 'rgba(238,241,246,0.85)' }} /> : null}
      <div style={{ font: `600 30px ${FONT.body}`, color: C.muted, textAlign: 'center', marginTop: kind === 'pc' ? 10 : 18 }}>{kind === 'phone' ? 'Phone' : 'Your PC'}</div>
    </div>
  );
};

export const Private: React.FC = () => {
  const f = useCurrentFrame();
  const qr = useIn(14, 14);
  const line = interpolate(f, [50, 90], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE });
  const lock = useIn(84, 11);
  const exit = useOut(SCENES.priv.dur - 14, 14);
  const chips = ['Paired by QR', 'Over Tailscale', 'Nothing in the cloud'];
  return (
    <Camera dur={SCENES.priv.dur} from={1.02} to={1.07}>
      <div style={{ opacity: 1 - exit }}>
        <Title text="Private by design." accent="Private" top={210} size={104} delay={4} />
        <div style={{ ...centre(420, 420, -300), borderRadius: 40, background: '#fff', padding: 24, transform: `scale(${0.7 + qr * 0.3}) rotate(${(1 - qr) * -8}deg)`, opacity: qr, boxShadow: '0 50px 120px rgba(0,0,0,0.55), 0 0 0 10px rgba(61,220,151,0.18)' }}>
          <Img src={staticFile('qr.png')} style={{ width: '100%', height: '100%', borderRadius: 12 }} />
        </div>
        <Device kind="phone" x={250} delay={40} />
        <Device kind="pc" x={830} delay={46} />
        <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0 }}>
          <path d="M 330 1140 Q 540 1050 715 1140" fill="none" stroke={C.mint} strokeWidth="6" strokeDasharray="18 14" strokeDashoffset={-f * 1.4} pathLength={1} style={{ strokeDasharray: `${line} 1`, strokeDashoffset: 0 }} />
        </svg>
        <div style={{ position: 'absolute', left: 540 - 44, top: 1050 - 44, width: 88, height: 88, borderRadius: 26, display: 'grid', placeItems: 'center', background: C.mint, transform: `scale(${lock})`, boxShadow: '0 0 0 12px rgba(61,220,151,0.18)' }}>
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z" /><path d="m9 12 2 2 4-4" /></svg>
        </div>
        <div style={{ position: 'absolute', left: 60, right: 60, top: 1345, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16 }}>
          {chips.map((c, i) => {
            const p = useIn(96 + i * 4, 14);
            return <span key={c} style={{ padding: '14px 26px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.14)', background: 'rgba(19,22,29,0.85)', font: `600 32px ${FONT.body}`, color: C.text, opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>{c}</span>;
          })}
        </div>
      </div>
    </Camera>
  );
};

// ---------------------------------------------------------------- 6. End card

export const End: React.FC = () => {
  const f = useCurrentFrame();
  const logo = useIn(4, 11);
  const word = useIn(14, 14);
  const sub = useIn(24, 14);
  const url = useIn(34, 14);
  const fade = interpolate(f, [SCENES.end.dur - 10, SCENES.end.dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: IN });
  return (
    <Camera dur={SCENES.end.dur} from={1} to={1.04}>
      <div style={{ opacity: 1 - fade * 0.0 }}>
        <Img src={staticFile('logo.svg')} style={{ ...centre(260, 260, -260), transform: `scale(${logo}) rotate(${(1 - logo) * -14}deg)`, filter: 'drop-shadow(0 30px 70px rgba(61,220,151,0.35))' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 900, textAlign: 'center', font: `700 112px ${FONT.display}`, letterSpacing: '-0.03em', color: C.text, opacity: word, transform: `translateY(${(1 - word) * 40}px)` }}>LedgerQuarry</div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1040, textAlign: 'center', font: `600 50px ${FONT.display}`, color: C.mint, opacity: sub, transform: `translateY(${(1 - sub) * 30}px)` }}>Free and open source</div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1150, textAlign: 'center', opacity: url, transform: `translateY(${(1 - url) * 30}px)` }}>
          <span style={{ display: 'inline-block', padding: '16px 30px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(255,255,255,0.12)', font: `500 36px ${FONT.body}`, color: C.text }}>{URL_TEXT}</span>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1290, textAlign: 'center', font: `500 30px ${FONT.body}`, color: C.faint, opacity: url }}>Built from the RepoQuarry catalogue</div>
      </div>
    </Camera>
  );
};
