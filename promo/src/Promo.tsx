import React, { useEffect, useState } from 'react';
import { AbsoluteFill, Audio, continueRender, delayRender, interpolate, Sequence, staticFile } from 'remotion';
import { C, FONT, SCENES, VO, FPS } from './config';
import { Backdrop, Caption } from './kit';
import { End, Hook, Private, Read, Snap, Track } from './scenes';

/** Load the brand fonts before frame 0 renders: a fallback font is a bug. */
export function useFonts() {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    const faces = [
      new FontFace(FONT.display, `url(${staticFile('space-grotesk-latin-wght-normal.woff2')})`, { weight: '300 700' }),
      new FontFace(FONT.body, `url(${staticFile('inter-latin-wght-normal.woff2')})`, { weight: '100 900' }),
    ];
    Promise.all(faces.map((f) => f.load())).then((loaded) => {
      loaded.forEach((f) => document.fonts.add(f));
      return document.fonts.ready;
    }).then(() => continueRender(handle));
  }, [handle]);
}

/** Music sits at -10 dB and ducks to about -18 dB under each voice line, with 0.2 s ramps. */
function musicVolume(f: number) {
  let duck = 0;
  for (const v of VO) {
    const end = v.at + v.seconds * FPS;
    duck = Math.max(duck, interpolate(f, [v.at - 12, v.at, end, end + 14], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  }
  const fadeOut = interpolate(f, [1140, 1200], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (0.34 - duck * 0.21) * fadeOut;
}

export const Promo: React.FC = () => {
  useFonts();
  const scenes: [keyof typeof SCENES, React.FC][] = [['hook', Hook], ['snap', Snap], ['read', Read], ['track', Track], ['priv', Private], ['end', End]];
  return (
    <AbsoluteFill style={{ background: C.ink, fontFamily: FONT.body, color: C.text }}>
      <Backdrop />
      {scenes.map(([key, Scene]) => (
        <Sequence key={key} from={SCENES[key].from} durationInFrames={SCENES[key].dur}>
          <Scene />
        </Sequence>
      ))}
      {VO.map((v) => (
        <Sequence key={v.file} from={v.at} durationInFrames={Math.ceil(v.seconds * FPS) + 24}>
          <Audio src={staticFile(v.file)} volume={1} />
          {v.at >= SCENES.snap.from && v.at < SCENES.end.from ? <Caption text={v.text} seconds={v.seconds} /> : null}
        </Sequence>
      ))}
      <Audio src={staticFile('jazz.wav')} volume={(f) => musicVolume(f)} />
    </AbsoluteFill>
  );
};
