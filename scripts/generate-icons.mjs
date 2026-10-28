import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public');
mkdirSync(outDir, { recursive: true });

const BLACK = [17, 17, 17];
const ORANGE = [255, 79, 0];
const WHITE = [244, 244, 241];

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

const wavePoints = [];
for (let x = 64; x <= 448; x += 2) {
  const t = ((x - 64) / 384) * Math.PI * 2;
  const y = 256 - Math.sin(t) * 160;
  wavePoints.push([x, y]);
}

function distanceToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.hypot(px - x, py - y);
}

function insideWave(x, y) {
  for (let index = 0; index < wavePoints.length - 1; index += 1) {
    if (distanceToSegment(x, y, wavePoints[index], wavePoints[index + 1]) <= 20) {
      return true;
    }
  }
  return false;
}

function renderIcon(size) {
  const samples = 4;
  const scale = size / 512;
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let waveHits = 0;
      let whiteHits = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = (x + (sx + 0.5) / samples) / scale;
          const py = (y + (sy + 0.5) / samples) / scale;
          if (insideWave(px, py)) {
            waveHits += 1;
          } else if (px >= 396 && px <= 440 && py >= 68 && py <= 112) {
            whiteHits += 1;
          }
        }
      }
      const total = samples * samples;
      const waveRatio = waveHits / total;
      const whiteRatio = whiteHits / total;
      const base = BLACK;
      const color = [
        Math.round(base[0] * (1 - waveRatio) + ORANGE[0] * waveRatio),
        Math.round(base[1] * (1 - waveRatio) + ORANGE[1] * waveRatio),
        Math.round(base[2] * (1 - waveRatio) + ORANGE[2] * waveRatio),
      ];
      const finalColor = [
        Math.round(color[0] * (1 - whiteRatio) + WHITE[0] * whiteRatio),
        Math.round(color[1] * (1 - whiteRatio) + WHITE[1] * whiteRatio),
        Math.round(color[2] * (1 - whiteRatio) + WHITE[2] * whiteRatio),
      ];
      const offset = (y * size + x) * 4;
      pixels[offset] = finalColor[0];
      pixels[offset + 1] = finalColor[1];
      pixels[offset + 2] = finalColor[2];
      pixels[offset + 3] = 255;
    }
  }
  return encodePng(size, size, pixels);
}

function encodePng(width, height, pixels) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    header,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(resolve(outDir, name), renderIcon(size));
  console.log(`wrote public/${name}`);
}
