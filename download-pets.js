// Parallel download all pet stage images
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://mc.cctvtao.top/' + encodeURIComponent('动物图片') + '/';
const OUT = path.join(__dirname, '动物图片');
const CONCURRENCY = 16;

const folders = [
  'aurora_dolphin','aurora_elk','azure_luan','baixi','baize','bifang','bubble_hamster',
  'candy_bear','cerberus','cloud_swan','clover_dragon','comet_squirrel','corona_mantis',
  'cotton_dog','dangkang','dark_scorpion','dessert_fox','dijiang','fairy_dragon','fire_eagle',
  'flame_lion','flower_spirit','galaxy_whale','gem_bird','ghost_dragon','griffin','hundun',
  'ice_mammoth','iron_croc','jellyfish','jiliang','kungfu_panda','kunpeng','lava_golem',
  'lunar_owl','luwu','mecha_beetle','mecha_dragon','mecha_shark','mermaid','meteor_hedgehog',
  'moon_rabbit','nebula_otter','nine_deer','ninetail_fox','pegasus','pixiu','pulsar_hummingbird',
  'qilin','quantum_chameleon','rock_tortoise','saber_tooth','saturn_octopus','shadow_leopard',
  'snow_fox','stardust_firefly','starry_cat','supernova_peacock','taotie','thunder_wolf','trex',
  'unicorn','void_frog','wormhole_pangolin','yinglong','yingzhao',
  '白猫十阶段图片','豹子十阶段图片','比熊十阶段图片','边牧十阶段图片','变色龙十阶段图片',
  '布偶十阶段图片','仓鼠十阶段图片','柴犬十阶段图片','大白熊十阶段图片','大象十阶段图片',
  '鳄鱼十阶段图片','法斗十阶段图片','黑猫十阶段图片','猴子十阶段图片','狐狸十阶段图片',
  '虎斑十阶段图片','吉娃娃十阶段图片','加菲猫十阶段图片','金渐层十阶段图片','金毛十阶段图片',
  '九尾狐十阶段图片','橘猫十阶段图片','卡皮巴拉十阶段图片','柯基十阶段图片','恐龙十阶段图片',
  '拉布拉多十阶段图片','蓝猫十阶段图片','老虎十阶段图片','狸花猫十阶段图片','马十阶段图片',
  '梅花鹿十阶段图片','企鹅十阶段图片','青蛙十阶段图片','萨摩耶十阶段图片','三花十阶段图片',
  '松鼠十阶段图片','泰迪十阶段图片','乌龟十阶段图片','西高地十阶段图片','暹罗猫十阶段图片',
  '小黄鸡十阶段图片','小兔子十阶段图片','小羊羔十阶段图片','小猪仔十阶段图片','熊猫十阶段图片',
  '雪瑞纳十阶段图片','鸭子十阶段图片','银渐层十阶段图片','鹦鹉十阶段图片','中华田园犬十阶段图片'
];

// Build task list: bear_1.png, po.png, then folder/{1..10}.webp
const tasks = [];
tasks.push({ folder: '', file: 'bear_1.png' });
tasks.push({ folder: '', file: 'po.png' });
for (const f of folders) {
  for (let s = 1; s <= 10; s++) {
    tasks.push({ folder: f, file: s + '.webp' });
  }
}

let done = 0, ok = 0, fail = 0, skip = 0;
const total = tasks.length;
const fails = [];

function download(task) {
  return new Promise((resolve) => {
    const rel = task.folder ? path.join(task.folder, task.file) : task.file;
    const dest = path.join(OUT, rel);
    // Skip if already exists and non-empty
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      skip++; done++;
      if (done % 100 === 0) process.stdout.write(`\r[${done}/${total}] ok=${ok} skip=${skip} fail=${fail}`);
      return resolve();
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const url = BASE + encodeURIComponent(task.folder + '/' + task.file).replace(/%2F/g, '/');
    const req = https.get(url, { timeout: 20000 }, (res) => {
      if (res.statusCode !== 200) {
        fail++; fails.push(rel + ' -> ' + res.statusCode);
        res.resume(); resolve();
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        fs.writeFileSync(dest, Buffer.concat(chunks));
        ok++;
        done++;
        if (done % 50 === 0 || done === total) process.stdout.write(`\r[${done}/${total}] ok=${ok} skip=${skip} fail=${fail}   `);
        resolve();
      });
    });
    req.on('error', () => { fail++; fails.push(rel + ' -> err'); done++; resolve(); });
    req.on('timeout', () => { req.destroy(); fail++; fails.push(rel + ' -> timeout'); done++; resolve(); });
  });
}

async function run() {
  console.log(`Total tasks: ${total}, concurrency: ${CONCURRENCY}`);
  let idx = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (idx < tasks.length) {
      const i = idx++;
      await download(tasks[i]);
    }
  });
  await Promise.all(workers);
  console.log(`\n\nDone. ok=${ok} skip=${skip} fail=${fail} total=${done}`);
  if (fails.length) {
    console.log('\nFailed files:');
    fails.slice(0, 50).forEach(f => console.log('  ' + f));
    if (fails.length > 50) console.log(`  ... and ${fails.length - 50} more`);
  }
}
run();
