import { readFile } from 'node:fs/promises';
import { createMeasurer, FONT_KEYS } from '../src/report/pdf.js';

const FONT_FILES = { b400: 'Barlow-400', b600: 'Barlow-600', b700: 'Barlow-700', c700: 'BarlowCondensed-700', c800: 'BarlowCondensed-800' };
const rel = (p) => new URL(p, import.meta.url);

export async function loadAssets(photoMap = {}) {
  const fonts = {};
  for (const k of FONT_KEYS) fonts[k] = await readFile(rel(`../src/assets/fonts/${FONT_FILES[k]}.ttf`));
  const images = {
    'logo-black': { type: 'png', bytes: await readFile(rel('../src/assets/logo-black.png')) },
    'logo-white': { type: 'png', bytes: await readFile(rel('../src/assets/logo-white.png')) },
  };
  for (const [key, file] of Object.entries(photoMap)) images[`photo:${key}`] = { type: 'jpg', bytes: await readFile(rel(`fixtures/${file}`)) };
  return { fonts, images, measure: await createMeasurer(fonts) };
}

export const ALL_PHOTOS = { atleta: 'retrato.jpg', agach1: 'vertical.jpg', agach2: 'vertical.jpg', afundo1: 'horizontal.jpg', afundo2: 'vertical.jpg', step1: 'retrato.jpg', step2: 'retrato.jpg' };
