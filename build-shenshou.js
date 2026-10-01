/* 下载神兽图 -> 裁正方形 -> 转 webp -> 铺满 10 阶段 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const sharp = require('sharp');

const PET_ROOT = path.join(__dirname, '动物图片');
const SIZE = 512;

// crop: center(默认) / left / right（用于双人图各取一半）
const LIST = [
  { type: 'tianlu',    name: '天禄',   url: 'https://aka.doubaocdn.com/s/5gZlCU2rW8', crop: 'center' },
  { type: 'bixie',     name: '辟邪',   url: 'https://aka.doubaocdn.com/s/ss73OQVITm', crop: 'center' },
  { type: 'sibuxiang', name: '四不像', url: 'https://aka.doubaocdn.com/s/ADmG6IWsEd', crop: 'center' },
  { type: 'tuye',      name: '兔爷',   url: 'https://aka.doubaocdn.com/s/LqYZljRHrV', crop: 'center' },
  { type: 'jinjiao',   name: '金角',   url: 'https://aka.doubaocdn.com/s/jfY2I6D3xY', crop: 'left'   },
  { type: 'yinjiao',   name: '银角',   url: 'https://aka.doubaocdn.com/s/jfY2I6D3xY', crop: 'right'  },
];

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location)
        return download(r.headers.location).then(resolve, reject);
      const ch = [];
      r.on('data', d => ch.push(d));
      r.on('end', () => resolve(Buffer.concat(ch)));
    }).on('error', reject);
  });
}

async function toSquare(buf, crop) {
  const img = sharp(buf);
  const m = await img.metadata();
  let side = Math.min(m.width, m.height);
  let left = Math.round((m.width - side) / 2);
  let top = Math.round((m.height - side) / 2);
  if (crop === 'left')  { side = m.height; left = 0; top = 0; }
  if (crop === 'right') { side = m.height; left = m.width - side; top = 0; }
  return sharp(buf).extract({ left, top, width: side, height: side })
    .resize(SIZE, SIZE, { fit: 'cover' })
    .webp({ quality: 90 })
    .toBuffer();
}

async function main() {
  for (const it of LIST) {
    const dir = path.join(PET_ROOT, it.type);
    fs.mkdirSync(dir, { recursive: true });
    const raw = await download(it.url);
    const webp = await toSquare(raw, it.crop);
    for (let s = 1; s <= 10; s++)
      fs.writeFileSync(path.join(dir, s + '.webp'), webp);
    console.log('OK', it.type, it.name, webp.length + 'B');
  }
  console.log('全部完成');
}
main().catch(e => { console.error(e); process.exit(1); });
