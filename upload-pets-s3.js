/* 批量上传宠物图片到 Bitiful (S3 兼容) */
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const BUCKET = 'cxopeeef66';
const ENDPOINT = 'https://s3.bitiful.net';
const PET_DIR = path.join(__dirname, '动物图片');

const s3 = new S3Client({
  endpoint: ENDPOINT,
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: 'TWPAIlBrKEmzNLwu8LK5CPUc',
    secretAccessKey: 'cgmX8GfSitSXT73FW47b4Q3ytUFSoTT',
  },
});

const CONTENT_TYPE = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };

async function uploadOne(file) {
  const key = file.name; // 保留原始文件名，放桶根目录
  const body = fs.readFileSync(file.full);
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: CONTENT_TYPE[path.extname(file.name).toLowerCase()] || 'application/octet-stream',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return key;
}

function walk(dir, base, out) {
  for (const n of fs.readdirSync(dir)) {
    const full = path.join(dir, n);
    const rel = base ? base + '/' + n : n;
    if (fs.statSync(full).isDirectory()) walk(full, rel, out);
    else out.push({ name: rel, full });
  }
  return out;
}

async function main() {
  const all = walk(PET_DIR, '', []);
  console.log('待上传:', all.length);

  // 先传一个测试
  const testKey = await uploadOne(all[0]);
  console.log('测试上传成功:', testKey);
  console.log('公开访问地址: https://' + BUCKET + '.s3.bitiful.net/' + testKey.split('/').map(encodeURIComponent).join('/'));

  let done = 1, fail = 0;
  const CONC = 16;
  let idx = 1;
  async function worker() {
    while (idx < all.length) {
      const cur = all[idx++];
      try {
        await uploadOne(cur);
        done++;
      } catch (e) {
        // 重试一次
        try { await uploadOne(cur); done++; }
        catch (e2) { fail++; console.error('失败:', cur.name, e2.message); }
      }
      if ((done + fail) % 50 === 0) console.log(`进度 ${done + fail}/${all.length}, 失败 ${fail}`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  console.log(`完成: 成功 ${done}, 失败 ${fail}`);
}

main().catch(e => { console.error('上传流程错误:', e); process.exit(1); });
