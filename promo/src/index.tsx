import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { FPS, H, W } from './config';
import { Promo } from './Promo';
import { PromoV2 } from './v2';

const Root: React.FC = () => (
  <>
    <Composition id="Promo" component={Promo} durationInFrames={1200} fps={FPS} width={W} height={H} />
    <Composition id="PromoV2" component={PromoV2} durationInFrames={1200} fps={FPS} width={W} height={H} />
  </>
);

registerRoot(Root);
