#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const outDir = path.join(__dirname, "..", "assets");
const sizes = [16, 32, 48, 128];

function crcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = crcTable();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    c = CRC_TABLE[(c ^ buffer[index]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, crc]);
}

function writePng(file, width, height, pixels) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  fs.writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", header),
      chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0))
    ])
  );
}

function setPixel(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const offset = (Math.floor(y) * size + Math.floor(x)) * 4;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
  pixels[offset + 3] = color[3];
}

function blendPixel(pixels, size, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= size || y >= size || alpha <= 0) return;
  const offset = (Math.floor(y) * size + Math.floor(x)) * 4;
  const sourceAlpha = (color[3] / 255) * Math.min(1, alpha);
  const targetAlpha = pixels[offset + 3] / 255;
  const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
  if (outputAlpha <= 0) return;
  pixels[offset] = Math.round((color[0] * sourceAlpha + pixels[offset] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
  pixels[offset + 1] = Math.round((color[1] * sourceAlpha + pixels[offset + 1] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
  pixels[offset + 2] = Math.round((color[2] * sourceAlpha + pixels[offset + 2] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
  pixels[offset + 3] = Math.round(outputAlpha * 255);
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)) : 0;
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.hypot(px - x, py - y);
}

function roundedRectCoverage(x, y, size, radius) {
  const inset = radius;
  const left = inset;
  const right = size - inset;
  const top = inset;
  const bottom = size - inset;
  if ((x >= left && x <= right && y >= 0 && y <= size) || (y >= top && y <= bottom && x >= 0 && x <= size)) return 1;
  const cx = x < left ? left : right;
  const cy = y < top ? top : bottom;
  return Math.max(0, Math.min(1, radius + 0.5 - Math.hypot(x - cx, y - cy)));
}

function gradient(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    255
  ];
}

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const navyA = [7, 17, 19, 255];
  const navyB = [13, 27, 30, 255];
  const mintA = [47, 255, 208, 255];
  const blueB = [56, 189, 248, 255];
  const ink = [7, 17, 19, 255];
  const radius = size * 0.23;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const coverage = roundedRectCoverage(x + 0.5, y + 0.5, size, radius);
      if (coverage <= 0) continue;
      const t = (x + y) / (size * 2);
      blendPixel(pixels, size, x, y, gradient(navyA, navyB, t), coverage);
      const glow = Math.max(0, 1 - Math.hypot(x - size * 0.72, y - size * 0.28) / (size * 0.72));
      if (glow > 0) blendPixel(pixels, size, x, y, [47, 255, 208, 70], glow * 0.28);
    }
  }

  const shield = [
    [size * 0.5, size * 0.15],
    [size * 0.78, size * 0.26],
    [size * 0.78, size * 0.48],
    [size * 0.72, size * 0.68],
    [size * 0.5, size * 0.84],
    [size * 0.28, size * 0.68],
    [size * 0.22, size * 0.48],
    [size * 0.22, size * 0.26]
  ];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (pointInPolygon(x + 0.5, y + 0.5, shield)) {
        blendPixel(pixels, size, x, y, gradient(mintA, blueB, (x + y) / (size * 2)), 1);
      }
    }
  }

  const speaker = [
    [size * 0.36, size * 0.47],
    [size * 0.44, size * 0.47],
    [size * 0.56, size * 0.36],
    [size * 0.56, size * 0.66],
    [size * 0.44, size * 0.55],
    [size * 0.36, size * 0.55]
  ];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (pointInPolygon(x + 0.5, y + 0.5, speaker)) setPixel(pixels, size, x, y, ink);
    }
  }

  const slashWidth = Math.max(2.5, size * 0.085);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = distanceToSegment(x, y, size * 0.66, size * 0.36, size * 0.34, size * 0.76);
      if (distance < slashWidth) blendPixel(pixels, size, x, y, ink, 1);
    }
  }

  if (size >= 32) {
    const waveWidth = Math.max(1.5, size * 0.035);
    const waves = [
      [size * 0.64, size * 0.44, size * 0.7, size * 0.5, size * 0.64, size * 0.58],
      [size * 0.72, size * 0.38, size * 0.81, size * 0.5, size * 0.72, size * 0.63]
    ];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        waves.forEach(([ax, ay, bx, by, cx, cy]) => {
          const d1 = distanceToSegment(x, y, ax, ay, bx, by);
          const d2 = distanceToSegment(x, y, bx, by, cx, cy);
          if (Math.min(d1, d2) < waveWidth) blendPixel(pixels, size, x, y, ink, 0.92);
        });
      }
    }
  }

  return pixels;
}

fs.mkdirSync(outDir, { recursive: true });
sizes.forEach((size) => {
  writePng(path.join(outDir, `icon${size}.png`), size, size, drawIcon(size));
});

console.log(`Generated QuietNet icons: ${sizes.map((size) => `icon${size}.png`).join(", ")}`);
