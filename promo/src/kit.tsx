import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT } from './config';

export const EASE = Easing.bezier(0.42, 0, 0.58, 1); // easy ease for camera
export const OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const IN = Easing.bezier(0.55, 0, 1, 0.45);

/** Spring entrance with a slight overshoot (damping ~14), starting at `delay`. */
export function useIn(delay = 0, damping = 14) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: { damping, stiffness: 120, mass: 0.9 } });
}

/** 0→1 over an exit that starts at `start` and lasts `dur` frames, ease-in. */
export function useOut(start: number, dur = 18) {
  const f = useCurrentFrame();
  return interpolate(f, [start, start + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: IN });
}

/** One camera per scene: slow push plus a tiny drift so nothing ever fully stops. */
export const Camera: React.FC<{ children: React.ReactNode; from?: number; to?: number; dur: number; x?: [number, number]; y?: [number, number] }> = ({ children, from = 1, to = 1.04, dur, x = [0, 0], y = [0, 0] }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, dur], [0, 1], { extrapolateRight: 'clamp', easing: EASE });
  const s = from + (to - from) * p;
  const dx = x[0] + (x[1] - x[0]) * p + Math.sin(f / 50) * 3;
  const dy = y[0] + (y[1] - y[0]) * p + Math.cos(f / 60) * 3;
  return <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px) scale(${s})` }}>{children}</AbsoluteFill>;
};

/** Ink background with slowly drifting mint and violet glows. */
export const Backdrop: React.FC = () => {
  const f = useCurrentFrame();
  const a = 50 + Math.sin(f / 90) * 8;
  const b = 20 + Math.cos(f / 110) * 6;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(900px 800px at ${a}% ${b}%, rgba(61,220,151,0.20), transparent 60%),
          radial-gradient(800px 700px at ${100 - a}% ${90 - b}%, rgba(124,156,255,0.14), transparent 60%), ${C.ink}`,
      }}
    />
  );
};

/** Big title, revealed word by word (each word 3 frames after the last), optional accent word. */
export const Title: React.FC<{ text: string; delay?: number; size?: number; accent?: string; top?: number; exitAt?: number }> = ({ text, delay = 0, size = 96, accent, top = 230, exitAt }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = exitAt ? interpolate(f, [exitAt, exitAt + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: IN }) : 0;
  const words = text.split(' ');
  return (
    <div style={{ position: 'absolute', left: 80, right: 80, top, textAlign: 'center', font: `700 ${size}px/1.04 ${FONT.display}`, letterSpacing: '-0.025em', color: C.text, opacity: 1 - out, transform: `translateY(${-40 * out}px)` }}>
      {words.map((w, i) => {
        const p = spring({ frame: f - delay - i * 3, fps, config: { damping: 14, stiffness: 140 } });
        const isAccent = accent && w.replace(/[^\w']/g, '') === accent;
        return (
          <span key={i} style={{ display: 'inline-block', marginRight: '0.24em', opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 60}px)`, color: isAccent ? C.mint : undefined }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** Voiceover caption: words light up in time with the line (approximate, by word length). */
export const Caption: React.FC<{ text: string; seconds: number }> = ({ text, seconds }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(' ');
  const weights = words.map((w) => w.length + 2);
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  const starts = weights.map((w) => {
    const s = (acc / total) * seconds * fps;
    acc += w;
    return s;
  });
  const end = seconds * fps;
  const vis = interpolate(f, [0, 6, end + 10, end + 20], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 90, right: 90, top: 1490, textAlign: 'center', opacity: vis }}>
      <span style={{ display: 'inline', padding: '10px 18px', borderRadius: 18, background: 'rgba(11,13,18,0.72)', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', font: `600 46px/1.55 ${FONT.body}` }}>
        {words.map((w, i) => {
          const on = f >= starts[i];
          return (
            <span key={i} style={{ color: on ? C.text : 'rgba(238,241,246,0.32)' }}>
              {w}
              {i < words.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </span>
    </div>
  );
};

/** Count-up over ~1 s, ease-out, never jumping. */
export const Counter: React.FC<{ value: number; delay: number; prefix?: string; dur?: number }> = ({ value, delay, prefix = '£', dur = 60 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [delay, delay + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: OUT });
  return <>{prefix}{(value * p).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
};

/** Phone frame around an app capture (captures are 1236 × 2517, 3x). */
export const Phone: React.FC<{ src: string; width?: number; children?: React.ReactNode; overlaySrc?: string; overlayOpacity?: number }> = ({ src, width = 560, children, overlaySrc, overlayOpacity = 0 }) => {
  const h = width * (2517 / 1236);
  return (
    <div style={{ position: 'relative', width: width + 28, height: h + 28, borderRadius: 74, background: '#050608', padding: 14, boxShadow: '0 0 0 2px rgba(255,255,255,0.14), 0 60px 140px rgba(0,0,0,0.65), 0 0 120px rgba(61,220,151,0.10)' }}>
      <div style={{ position: 'relative', width, height: h, borderRadius: 60, overflow: 'hidden', background: C.ink }}>
        <Img src={staticFile(src)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        {overlaySrc ? <Img src={staticFile(overlaySrc)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: overlayOpacity }} /> : null}
        {children}
      </div>
      <div style={{ position: 'absolute', top: 30, left: '50%', width: 120, height: 32, marginLeft: -60, borderRadius: 20, background: '#050608' }} />
    </div>
  );
};

/** Touch indicator that travels along an arc, eases in and out, settles with overshoot, then presses. */
export const Tap: React.FC<{ from: [number, number]; to: [number, number]; start: number; travel?: number; pressAt: number }> = ({ from, to, start, travel = 36, pressAt }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame: f - start, fps, config: { damping: 15, stiffness: 90 }, durationInFrames: travel });
  const mx = (from[0] + to[0]) / 2 + (to[1] - from[1]) * 0.15;
  const my = (from[1] + to[1]) / 2 - Math.abs(to[0] - from[0]) * 0.15;
  const x = (1 - t) ** 2 * from[0] + 2 * (1 - t) * t * mx + t ** 2 * to[0];
  const y = (1 - t) ** 2 * from[1] + 2 * (1 - t) * t * my + t ** 2 * to[1];
  const press = interpolate(f, [pressAt, pressAt + 4, pressAt + 8], [1, 0.82, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ring = interpolate(f, [pressAt, pressAt + 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: OUT });
  const vis = interpolate(f, [start - 6, start, pressAt + 30, pressAt + 40], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: x - 36, top: y - 36, width: 72, height: 72, opacity: vis }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', transform: `scale(${press})`, boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }} />
      <div style={{ position: 'absolute', inset: -20, borderRadius: '50%', border: '4px solid rgba(255,255,255,0.8)', transform: `scale(${0.6 + ring})`, opacity: f >= pressAt ? 1 - ring : 0 }} />
    </div>
  );
};

/** Glass card. */
export const Card: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div style={{ borderRadius: 34, background: 'rgba(19,22,29,0.97)', border: '2px solid rgba(255,255,255,0.09)', boxShadow: '0 40px 100px rgba(0,0,0,0.55)', backdropFilter: 'blur(20px)', ...style }}>{children}</div>
);
