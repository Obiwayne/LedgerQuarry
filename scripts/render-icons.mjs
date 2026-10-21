// Renders ui/icons/logo.svg to the PNG sizes the phone app and the installer need.
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync(new URL('../ui/icons/logo.svg', import.meta.url), 'utf8');
const render = (src, size) => new Resvg(src, { fitTo: { mode: 'width', value: size } }).render().asPng();
const out = (name, png) => writeFileSync(new URL(`../ui/icons/${name}`, import.meta.url), png);

out('icon-1024.png', render(svg, 1024));
out('icon-512.png', render(svg, 512));
out('icon-192.png', render(svg, 192));
out('apple-touch-icon.png', render(svg.replace(/rx="116"/, 'rx="0"'), 180));
// Maskable: full-bleed background with the artwork inside the 80% safe zone.
const inner = svg.replace(/<svg[^>]*>/, '').replace('</svg>', '');
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#0b0d12"/><g transform="translate(51.2 51.2) scale(0.8)">${inner}</g></svg>`;
out('maskable-512.png', render(maskable, 512));
console.log('icons written');
