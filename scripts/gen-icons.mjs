import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/icon.svg', import.meta.url));
const sizes = [16, 32, 48, 96, 128];
const dir = new URL('../public/icon/', import.meta.url).pathname;

for (const s of sizes) {
  await sharp(svg, { density: 384 })
    .resize(s, s)
    .png()
    .toFile(`${dir}${s}.png`);
  console.log(`generated ${s}.png`);
}
