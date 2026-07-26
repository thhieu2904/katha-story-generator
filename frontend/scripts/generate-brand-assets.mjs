/**
 * Sinh toàn bộ asset logo từ file gốc `Katha.png` ở root repo.
 *
 *   node frontend/scripts/generate-brand-assets.mjs
 *
 * Chỉ chạy lại khi đổi logo gốc. Dùng `sharp` — đi kèm Next nên không khai báo
 * trong package.json; nếu Next bỏ sharp thì `npm i -D sharp` trước khi chạy.
 *
 * Logo gốc là ảnh vàng phát sáng trên nền nâu đen phẳng, không có alpha. Script
 * dựng alpha từ max(r,g,b) qua một ramp tuyến tính — nền phẳng rơi về 0, phần
 * vàng và quầng sáng giữ nguyên. Wordmark dùng ramp nhẹ (giữ quầng sáng), chữ K
 * dùng ramp gắt (bỏ luôn bóng nâu của chữ, nếu không ở 30–36px nó thành ô tối).
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(FE, '..', 'Katha.png');
const SURFACE = '#0e0d17'; // --color-katha-surface
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

async function withAlpha(lo, hi, gamma) {
  const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const out = Buffer.alloc(W * H * 4);
  for (let p = 0; p < W * H; p++) {
    const i = p * C;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    let a = (Math.max(r, g, b) - lo) / (hi - lo);
    a = a < 0 ? 0 : a > 1 ? 1 : a;
    out[p * 4] = r; out[p * 4 + 1] = g; out[p * 4 + 2] = b;
    out[p * 4 + 3] = Math.round(Math.pow(a, gamma) * 255);
  }
  return sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

// Logo chữ đầy đủ — public/katha-logo.png
const wordmark = await sharp(await withAlpha(90, 215, 1.2)).trim({ threshold: 5 }).toBuffer();
await sharp(wordmark)
  .resize({ width: 760 })
  .png({ compressionLevel: 9, palette: true })
  .toFile(path.join(FE, 'public/katha-logo.png'));

// Chữ K, cắt dưới phần tháp Angkor cho đỡ nhiễu ở cỡ nhỏ, canh giữa khung vuông
const k = await sharp(await withAlpha(150, 205, 2.0))
  .extract({ left: 205, top: 510, width: 270, height: 380 })
  .resize({ height: 430, fit: 'contain', background: CLEAR })
  .toBuffer();
const mark = await sharp({ create: { width: 512, height: 512, channels: 4, background: CLEAR } })
  .composite([{ input: k, gravity: 'center' }])
  .png()
  .toBuffer();

// File conventions của Next: favicon + icon màn hình chính iOS (iOS bỏ alpha nên nền đặc)
await sharp(mark).resize(256, 256).png({ compressionLevel: 9 })
  .toFile(path.join(FE, 'src/app/icon.png'));
await sharp({ create: { width: 180, height: 180, channels: 4, background: SURFACE } })
  .composite([{ input: await sharp(mark).resize(168, 168).toBuffer(), gravity: 'center' }])
  .png({ compressionLevel: 9 })
  .toFile(path.join(FE, 'src/app/apple-icon.png'));

// Ảnh chia sẻ mạng xã hội
await sharp({ create: { width: 1200, height: 630, channels: 4, background: SURFACE } })
  .composite([{
    input: await sharp(wordmark).resize({ width: 1040, height: 580, fit: 'inside' }).toBuffer(),
    gravity: 'center',
  }])
  .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
  .toFile(path.join(FE, 'src/app/opengraph-image.jpg'));

for (const f of ['public/katha-logo.png', 'src/app/icon.png',
  'src/app/apple-icon.png', 'src/app/opengraph-image.jpg']) {
  const p = path.join(FE, f);
  const m = await sharp(p).metadata();
  console.log(f.padEnd(32), `${m.width}x${m.height}`.padEnd(10), (fs.statSync(p).size / 1024).toFixed(0) + ' KB');
}
