/* ═══════════════════════ CONFIG.JS ═══════════════════════
   Pet types, level settings, constants
═══════════════════════════════════════════════════════════ */

const PET_TYPES = [
  /* 《有兽焉》神兽（本地自用） */
  { type: 'tianlu', name: '天禄', emoji: '🐉' },
  { type: 'bixie', name: '辟邪', emoji: '🐉' },
  { type: 'sibuxiang', name: '四不像', emoji: '🦌' },
  { type: 'tuye', name: '兔爷', emoji: '🐰' },
  { type: 'jinjiao', name: '金角', emoji: '🐹' },
  { type: 'yinjiao', name: '银角', emoji: '🐹' },
  /* 原有动物（保留图片显示） */
  { type: 'baimao', name: '白猫', emoji: '🐱' },
  { type: 'bixiong', name: '比熊', emoji: '🐶' },
  { type: 'bianmu', name: '边牧', emoji: '🐕' },
  { type: 'buou', name: '布偶', emoji: '🐱' },
  { type: 'chaiquan', name: '柴犬', emoji: '🐕' },
  { type: 'fadou', name: '法斗', emoji: '🐶' },
  { type: 'heimao', name: '黑猫', emoji: '🐱' },
  { type: 'huban', name: '虎斑', emoji: '🐱' },
  { type: 'jiafeimao', name: '加菲猫', emoji: '🐱' },
  { type: 'jinjianceng', name: '金渐层', emoji: '🐱' },
  { type: 'jinmao', name: '金毛', emoji: '🐕' },
  { type: 'jumao', name: '橘猫', emoji: '🐱' },
  { type: 'keji', name: '柯基', emoji: '🐕' },
  { type: 'labuduo', name: '拉布拉多', emoji: '🐕' },
  { type: 'lanmao', name: '蓝猫', emoji: '🐱' },
  { type: 'samoyed', name: '萨摩耶', emoji: '🐕' },
  { type: 'sanhua', name: '三花', emoji: '🐱' },
  { type: 'taidi', name: '泰迪', emoji: '🐩' },
  { type: 'xianluomao', name: '暹罗猫', emoji: '🐱' },
  { type: 'yinjianceng', name: '银渐层', emoji: '🐱' },
  { type: 'xiaotuzi', name: '小兔子', emoji: '🐰' },
  { type: 'songshu', name: '松鼠', emoji: '🐿️' },
  { type: 'xiongmao', name: '熊猫', emoji: '🐼' },
  { type: 'dabaixiong', name: '大白熊', emoji: '🐕' },
  { type: 'houzi', name: '猴子', emoji: '🐒' },
  { type: 'xiaozhuzai', name: '小猪仔', emoji: '🐷' },
  { type: 'yazi', name: '鸭子', emoji: '🦆' },
  { type: 'lihuamao', name: '狸花猫', emoji: '🐱' },
  { type: 'jiuweihu', name: '九尾狐', emoji: '🦊' },
  { type: 'kapibala', name: '卡皮巴拉', emoji: '🦫' },
  { type: 'xueruina', name: '雪瑞纳', emoji: '🐩' },
  { type: 'xiaoyanggao', name: '小羊羔', emoji: '🐑' },
  { type: 'ma', name: '马', emoji: '🐴' },
  { type: 'qie', name: '企鹅', emoji: '🐧' },
  { type: 'laohu', name: '老虎', emoji: '🐯' },
  { type: 'baozi', name: '豹子', emoji: '🐆' },
  { type: 'xigaodi', name: '西高地', emoji: '🐕' },
  { type: 'konglong', name: '恐龙', emoji: '🦕' },
  { type: 'xiaohuangji', name: '小黄鸡', emoji: '🐤' },
  { type: 'yingwu', name: '鹦鹉', emoji: '🦜' },
  { type: 'cangshu', name: '仓鼠', emoji: '🐹' },
  { type: 'meihualu', name: '梅花鹿', emoji: '🦌' },
  { type: 'zhonghuatianyuanquan', name: '中华田园犬', emoji: '🐕' },
  { type: 'daxiang', name: '大象', emoji: '🐘' },
  { type: 'jiwawa', name: '吉娃娃', emoji: '🐕' },
  { type: 'qingwa', name: '青蛙', emoji: '🐸' },
  { type: 'wugui', name: '乌龟', emoji: '🐢' },
  { type: 'huli', name: '狐狸', emoji: '🦊' },
  { type: 'eyu', name: '鳄鱼', emoji: '🐊' },
  { type: 'bianselong', name: '变色龙', emoji: '🦎' },
  /* 新增动物 */
  { type: 'unicorn', name: '独角兽', emoji: '🦄' },
  { type: 'fairy_dragon', name: '仙龙', emoji: '🐉' },
  { type: 'starry_cat', name: '星空猫', emoji: '🐱' },
  { type: 'moon_rabbit', name: '月兔', emoji: '🐰' },
  { type: 'pegasus', name: '天马', emoji: '🐴' },
  { type: 'nine_deer', name: '九色鹿', emoji: '🦌' },
  { type: 'snow_fox', name: '雪狐', emoji: '🦊' },
  { type: 'mermaid', name: '美人鱼', emoji: '🧜‍♀️' },
  { type: 'flower_spirit', name: '花精灵', emoji: '🌸' },
  { type: 'candy_bear', name: '糖果熊', emoji: '🐻' },
  { type: 'gem_bird', name: '宝石鸟', emoji: '🐦' },
  { type: 'clover_dragon', name: '四叶龙', emoji: '🐉' },
  { type: 'jellyfish', name: '水母', emoji: '🪼' },
  { type: 'aurora_elk', name: '极光麋鹿', emoji: '🦌' },
  { type: 'dessert_fox', name: '甜点狐', emoji: '🦊' },
  { type: 'trex', name: '霸王龙', emoji: '🦖' },
  { type: 'thunder_wolf', name: '雷狼', emoji: '🐺' },
  { type: 'mecha_dragon', name: '机甲龙', emoji: '🐉' },
  { type: 'flame_lion', name: '火焰狮', emoji: '🦁' },
  { type: 'shadow_leopard', name: '暗影豹', emoji: '🐆' },
  { type: 'cerberus', name: '地狱犬', emoji: '🐕' },
  { type: 'griffin', name: '狮鹫', emoji: '🦅' },
  { type: 'mecha_shark', name: '机甲鲨', emoji: '🦈' },
  { type: 'rock_tortoise', name: '岩石龟', emoji: '🐢' },
  { type: 'saber_tooth', name: '剑齿虎', emoji: '🐯' },
  { type: 'lava_golem', name: '熔岩巨人', emoji: '🪨' },
  { type: 'mecha_beetle', name: '机甲甲虫', emoji: '🪲' },
  { type: 'ghost_dragon', name: '幽灵龙', emoji: '🐉' },
  { type: 'ice_mammoth', name: '冰猛犸', emoji: '🦣' },
  { type: 'kungfu_panda', name: '功夫熊猫', emoji: '🐼' },
  { type: 'cotton_dog', name: '棉花狗', emoji: '🐕' },
  { type: 'bubble_hamster', name: '泡泡仓鼠', emoji: '🐹' },
  { type: 'cloud_swan', name: '云天鹅', emoji: '🦢' },
  { type: 'fire_eagle', name: '火焰鹰', emoji: '🦅' },
  { type: 'iron_croc', name: '铁鳄', emoji: '🐊' },
  { type: 'nebula_otter', name: '星云水獭', emoji: '🦫' },
  { type: 'galaxy_whale', name: '银河鲸', emoji: '🐋' },
  { type: 'qilin', name: '麒麟', emoji: '🦌' },
  { type: 'taotie', name: '饕餮', emoji: '🐉' },
  { type: 'lunar_owl', name: '月枭', emoji: '🦉' },
  { type: 'void_frog', name: '虚空蛙', emoji: '🐸' },
  { type: 'aurora_dolphin', name: '极光海豚', emoji: '🐬' },
  { type: 'pulsar_hummingbird', name: '脉冲蜂鸟', emoji: '🐦' },
  { type: 'saturn_octopus', name: '土星章鱼', emoji: '🐙' },
  { type: 'comet_squirrel', name: '彗星松鼠', emoji: '🐿️' },
  { type: 'dark_scorpion', name: '暗蝎', emoji: '🦂' },
  { type: 'supernova_peacock', name: '超新星孔雀', emoji: '🦚' },
  { type: 'meteor_hedgehog', name: '流星刺猬', emoji: '🦔' },
  { type: 'quantum_chameleon', name: '量子变色龙', emoji: '🦎' },
  { type: 'corona_mantis', name: '日冕螳螂', emoji: '🦗' },
  { type: 'stardust_firefly', name: '星尘萤火虫', emoji: '✨' },
  { type: 'wormhole_pangolin', name: '虫洞穿山甲', emoji: '🦔' },
  { type: 'baize', name: '白泽', emoji: '🦌' },
  { type: 'kunpeng', name: '鲲鹏', emoji: '🐦' },
  { type: 'ninetail_fox', name: '九尾狐', emoji: '🦊' },
  { type: 'pixiu', name: '貔貅', emoji: '🐉' },
  { type: 'azure_luan', name: '青鸾', emoji: '🐦' },
  { type: 'yinglong', name: '应龙', emoji: '🐉' },
  { type: 'dangkang', name: '当康', emoji: '🐗' },
  { type: 'bifang', name: '毕方', emoji: '🐦' },
  { type: 'hundun', name: '混沌', emoji: '🐉' },
  { type: 'yingzhao', name: '英招', emoji: '🐴' },
  { type: 'luwu', name: '陆吾', emoji: '🐯' },
  { type: 'dijiang', name: '帝江', emoji: '🐦' },
  { type: 'baixi', name: '白犀', emoji: '🦏' },
  { type: 'jiliang', name: '吉量', emoji: '🐴' },
];

/* Default level configuration (10 levels 满级).
   minFeeds = 升到该等级所需的累计已投喂鸡腿数（fedLegs）。
   Teachers can customize per class via 升级设置. */
const DEFAULT_LEVELS = [
  { level: 1, minFeeds: 0, title: '萌新学员', stage: 1 },
  { level: 2, minFeeds: 15, title: '见习学员', stage: 2 },
  { level: 3, minFeeds: 35, title: '初级学员', stage: 3 },
  { level: 4, minFeeds: 60, title: '中级学员', stage: 4 },
  { level: 5, minFeeds: 90, title: '进阶学员', stage: 5 },
  { level: 6, minFeeds: 130, title: '高级学员', stage: 6 },
  { level: 7, minFeeds: 180, title: '精英学员', stage: 7 },
  { level: 8, minFeeds: 240, title: '强化学员', stage: 8 },
  { level: 9, minFeeds: 320, title: '卓越学员', stage: 9 },
  { level: 10, minFeeds: 420, title: '无上学员', stage: 10 },
];

const SCORE_REASONS = [
  '课堂积极发言', '认真完成作业', '帮助同学', '团队合作',
  '进步奖励', '活动参与', '诚实守信', '保持整洁', '创意表现', '综合表现'
];

/* 加分/扣分项目（支持首字母搜索，icon 为 Remix Icon 类名） */
const SCORE_ADD_ITEMS = [
  { icon: 'ri-book-2-line', name: '早读打卡', value: 1, py: 'zddk' },
  { icon: 'ri-checkbox-circle-line', name: '答对问题', value: 2, py: 'ddwt' },
  { icon: 'ri-file-edit-line', name: '作业优秀', value: 3, py: 'zyyx' },
  { icon: 'ri-mic-line', name: '完成背诵', value: 2, py: 'wcbs' },
  { icon: 'ri-thumb-up-line', name: '积极举手', value: 1, py: 'jjjs' },
  { icon: 'ri-heart-line', name: '帮助同学', value: 2, py: 'bztx' },
  { icon: 'ri-sparkling-2-line', name: '值日认真', value: 2, py: 'zrzr' },
  { icon: 'ri-book-read-line', name: '课外阅读', value: 1, py: 'kwyd' },
  { icon: 'ri-rocket-line', name: '进步明显', value: 3, py: 'jbmx' },
  { icon: 'ri-palette-line', name: '才艺展示', value: 3, py: 'cyzs' },
  { icon: 'ri-team-line', name: '团队合作', value: 2, py: 'tdhz' },
  { icon: 'ri-lightbulb-flash-line', name: '创意表现', value: 2, py: 'cybx' },
];

const SCORE_DEDUCT_ITEMS = [
  { icon: 'ri-time-line', name: '迟到', value: 1, py: 'cd' },
  { icon: 'ri-smartphone-line', name: '玩手机', value: 2, py: 'wsj' },
  { icon: 'ri-moon-line', name: '打瞌睡', value: 1, py: 'dks' },
  { icon: 'ri-file-damage-line', name: '未交作业', value: 2, py: 'wjzy' },
  { icon: 'ri-chat-voice-line', name: '课堂吵闹', value: 1, py: 'ktcn' },
  { icon: 'ri-forbid-2-line', name: '违反纪律', value: 2, py: 'wfjl' },
  { icon: 'ri-edit-line', name: '书写潦草', value: 1, py: 'sxlz' },
  { icon: 'ri-alert-line', name: '未带学具', value: 1, py: 'wdxj' },
];

const GROUP_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#8cc522ff',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#ec4899', '#a514b8ff',
  /* 新增 10 种鲜艳炫酷颜色 */
  '#ff3d00', '#00e676', '#f129ffff', '#651fff',
  '#ffd600', '#00b0ff', '#f50057', '#f900aeff',
  '#00e5ff', '#76ff03'
];

/* 小卖部商品图标：按分类，使用 Remix Icon 矢量图 */
const SHOP_ICONS_CATEGORIES = {
  food: {
    label: '美食',
    icon: 'ri-restaurant-line',
    icons: ['ri-cake-2-line', 'ri-cake-3-line', 'ri-cup-line', 'ri-restaurant-line', 'ri-restaurant-2-line', 'ri-apple-line', 'ri-gift-line', 'ri-heart-line', 'ri-star-line', 'ri-cake-line', 'ri-goblet-line', 'ri-flask-line', 'ri-fire-line', 'ri-handbag-line', 'ri-shopping-bag-line', 'ri-star-smile-line'],
  },
  stationery: {
    label: '文具',
    icon: 'ri-pencil-line',
    icons: ['ri-pencil-line', 'ri-edit-line', 'ri-book-line', 'ri-book-2-line', 'ri-book-open-line', 'ri-file-text-line', 'ri-scissors-line', 'ri-ruler-line', 'ri-palette-line', 'ri-brush-line', 'ri-pen-nib-line', 'ri-mark-pen-line', 'ri-bookmark-line', 'ri-sticky-note-line', 'ri-file-list-line'],
  },
  entertainment: {
    label: '娱乐',
    icon: 'ri-gamepad-line',
    icons: ['ri-gamepad-line', 'ri-gamepad-2-line', 'ri-music-line', 'ri-music-2-line', 'ri-movie-line', 'ri-movie-2-line', 'ri-basketball-line', 'ri-football-line', 'ri-camera-line', 'ri-mic-line', 'ri-headphone-line', 'ri-tv-line', 'ri-remote-control-line', 'ri-run-line', 'ri-swim-line'],
  },
  privilege: {
    label: '特权',
    icon: 'ri-vip-crown-line',
    icons: ['ri-vip-crown-line', 'ri-medal-line', 'ri-medal-2-line', 'ri-award-line', 'ri-trophy-line', 'ri-shield-star-line', 'ri-shield-check-line', 'ri-gift-line', 'ri-sparkling-2-line', 'ri-magic-line', 'ri-plant-line', 'ri-flower-line', 'ri-leaf-line', 'ri-flashlight-line', 'ri-goblet-2-line'],
  },
  misc: {
    label: '杂项',
    icon: 'ri-apps-line',
    icons: ['ri-gift-line', 'ri-heart-line', 'ri-star-half-line', 'ri-flag-line', 'ri-palette-line', 'ri-brush-2-line', 'ri-shopping-bag-line', 'ri-shopping-cart-line', 'ri-basket-line', 'ri-24-hours-line', 'ri-home-smile-line', 'ri-plant-line', 'ri-sun-line', 'ri-moon-line', 'ri-apps-line'],
  },
};
const SHOP_ICONS = ['ri-gift-line', 'ri-cake-2-line', 'ri-book-line', 'ri-gamepad-line', 'ri-vip-crown-line', 'ri-star-line', 'ri-heart-line', 'ri-medal-line', 'ri-shopping-bag-line', 'ri-music-line', 'ri-pencil-line', 'ri-apps-line'];
const SHOP_COLORS = ['#e9d5ff', '#8b5cf6', '#f97316', '#ec4899', '#67e8f9', '#fbbf24', '#86efac', '#f472b6', '#94a3b8', '#ef4444'];

/* Helper: get pet info by type */
function getPet(type) {
  return PET_TYPES.find(p => p.type === type) || { type, name: type, emoji: '🐾' };
}

/* Helper: get pet image path (stage 1-10)
   动物图片/{文件夹}/{1-10}.webp，如 动物图片/白猫十阶段图片/1.webp
   type -> 实际文件夹名，文件夹内需有 1.webp ~ 10.webp */
/* 宠物图片：神兽走 GitHub 仓库 + jsdelivr CDN（免费），普通动物无图时回退 emoji */
const PET_IMG_BASE = 'https://cdn.jsdelivr.net/gh/177587hvc/ddd@main/pets';
const PET_IMG_FOLDERS = {
  /* 原有动物（中文文件夹名） */
  baimao: '白猫十阶段图片', bixiong: '比熊十阶段图片', bianmu: '边牧十阶段图片',
  buou: '布偶十阶段图片', chaiquan: '柴犬十阶段图片', fadou: '法斗十阶段图片',
  heimao: '黑猫十阶段图片', huban: '虎斑十阶段图片', jiafeimao: '加菲猫十阶段图片',
  jinjianceng: '金渐层十阶段图片', jinmao: '金毛十阶段图片', jumao: '橘猫十阶段图片',
  keji: '柯基十阶段图片', labuduo: '拉布拉多十阶段图片', lanmao: '蓝猫十阶段图片',
  samoyed: '萨摩耶十阶段图片', sanhua: '三花十阶段图片', taidi: '泰迪十阶段图片',
  xianluomao: '暹罗猫十阶段图片', yinjianceng: '银渐层十阶段图片',
  xiaotuzi: '小兔子十阶段图片', songshu: '松鼠十阶段图片', xiongmao: '熊猫十阶段图片',
  dabaixiong: '大白熊十阶段图片', houzi: '猴子十阶段图片', xiaozhuzai: '小猪仔十阶段图片',
  yazi: '鸭子十阶段图片', lihuamao: '狸花猫十阶段图片', jiuweihu: '九尾狐十阶段图片',
  kapibala: '卡皮巴拉十阶段图片', xueruina: '雪瑞纳十阶段图片', xiaoyanggao: '小羊羔十阶段图片',
  ma: '马十阶段图片', qie: '企鹅十阶段图片', laohu: '老虎十阶段图片', baozi: '豹子十阶段图片',
  xigaodi: '西高地十阶段图片', konglong: '恐龙十阶段图片', xiaohuangji: '小黄鸡十阶段图片',
  yingwu: '鹦鹉十阶段图片', cangshu: '仓鼠十阶段图片', meihualu: '梅花鹿十阶段图片',
  zhonghuatianyuanquan: '中华田园犬十阶段图片', daxiang: '大象十阶段图片',
  jiwawa: '吉娃娃十阶段图片', qingwa: '青蛙十阶段图片', wugui: '乌龟十阶段图片',
  huli: '狐狸十阶段图片', eyu: '鳄鱼十阶段图片', bianselong: '变色龙十阶段图片',
  /* 新增动物（英文文件夹名 = type） */
  unicorn: 'unicorn', fairy_dragon: 'fairy_dragon', starry_cat: 'starry_cat',
  moon_rabbit: 'moon_rabbit', pegasus: 'pegasus', nine_deer: 'nine_deer',
  snow_fox: 'snow_fox', mermaid: 'mermaid', flower_spirit: 'flower_spirit',
  candy_bear: 'candy_bear', gem_bird: 'gem_bird', clover_dragon: 'clover_dragon',
  jellyfish: 'jellyfish', aurora_elk: 'aurora_elk', dessert_fox: 'dessert_fox',
  trex: 'trex', thunder_wolf: 'thunder_wolf', mecha_dragon: 'mecha_dragon',
  flame_lion: 'flame_lion', shadow_leopard: 'shadow_leopard', cerberus: 'cerberus',
  griffin: 'griffin', mecha_shark: 'mecha_shark', rock_tortoise: 'rock_tortoise',
  saber_tooth: 'saber_tooth', lava_golem: 'lava_golem', mecha_beetle: 'mecha_beetle',
  ghost_dragon: 'ghost_dragon', ice_mammoth: 'ice_mammoth', kungfu_panda: 'kungfu_panda',
  cotton_dog: 'cotton_dog', bubble_hamster: 'bubble_hamster', cloud_swan: 'cloud_swan',
  fire_eagle: 'fire_eagle', iron_croc: 'iron_croc', nebula_otter: 'nebula_otter',
  galaxy_whale: 'galaxy_whale', qilin: 'qilin', taotie: 'taotie', lunar_owl: 'lunar_owl',
  void_frog: 'void_frog', aurora_dolphin: 'aurora_dolphin', pulsar_hummingbird: 'pulsar_hummingbird',
  saturn_octopus: 'saturn_octopus', comet_squirrel: 'comet_squirrel', dark_scorpion: 'dark_scorpion',
  supernova_peacock: 'supernova_peacock', meteor_hedgehog: 'meteor_hedgehog',
  quantum_chameleon: 'quantum_chameleon', corona_mantis: 'corona_mantis',
  stardust_firefly: 'stardust_firefly', wormhole_pangolin: 'wormhole_pangolin',
  baize: 'baize', kunpeng: 'kunpeng', ninetail_fox: 'ninetail_fox', pixiu: 'pixiu',
  azure_luan: 'azure_luan', yinglong: 'yinglong', dangkang: 'dangkang', bifang: 'bifang',
  hundun: 'hundun', yingzhao: 'yingzhao', luwu: 'luwu', dijiang: 'dijiang',
  baixi: 'baixi', jiliang: 'jiliang',
};
var _supportsWebP = (function() {
  try {
    var c = document.createElement('canvas');
    c.width = 1; c.height = 1;
    return c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  } catch(e) { return false; }
})();

/* 《有兽焉》神兽类型（10 阶段共用一张图） */
const SHENSHOU_TYPES = ['tianlu', 'bixie', 'sibuxiang', 'tuye', 'jinjiao', 'yinjiao'];

function getPetImg(type, stage) {
  stage = Math.max(1, Math.min(10, Math.round(stage || 1)));
  /* 《有兽焉》神兽：10 阶段共用同一张图，始终取 1.webp */
  if (SHENSHOU_TYPES.indexOf(type) >= 0) stage = 1;
  var folder = PET_IMG_FOLDERS[type] || type;
  var ext = _supportsWebP ? '.webp' : '.png';
  return PET_IMG_BASE + '/' + folder + '/' + stage + ext;
}

/* 领养模式下的蛋图（召唤神兽后的待领养状态） */
const ADOPT_EGG_IMG = PET_IMG_BASE + '/bear_1.png';
/** 福利总积分或徽章总数为负时显示的破蛋图 */
const PO_IMG = PET_IMG_BASE + '/po.png';

/* Helper: calculate level info from fedLegs (cumulative feedings) and level config.
   fedLegs = 已累计投喂鸡腿总数，决定等级。 */
function calcLevelInfo(fedLegs, levelConfig) {
  fedLegs = fedLegs || 0;
  const cfg = levelConfig || DEFAULT_LEVELS;
  // 兼容旧配置字段名（minScore → minFeeds 平滑迁移）
  const minKey = cfg[0].minFeeds !== undefined ? 'minFeeds' : 'minScore';

  let info = cfg[0];
  for (let i = cfg.length - 1; i >= 0; i--) {
    if (fedLegs >= cfg[i][minKey]) { info = cfg[i]; break; }
  }
  const idx = cfg.indexOf(info);
  const nextLevel = cfg[idx + 1];
  const curMin = info[minKey];
  const nextMin = nextLevel ? nextLevel[minKey] : null;

  let progress = 100;
  if (nextMin !== null) {
    const range = nextMin - curMin;
    progress = Math.max(0, Math.min(100, Math.floor(((fedLegs - curMin) / range) * 100)));
  }
  return {
    level: info.level,
    title: info.title,
    stage: info.stage,
    progress,
    nextFeeds: nextMin,
    currentMin: curMin,
    remaining: nextMin !== null ? nextMin - fedLegs : 0,
  };
}

/* Helper: 获取满级等级（用于判断是否可召唤神兽） */
function getMaxLevel(levelConfig) {
  const cfg = levelConfig || DEFAULT_LEVELS;
  return cfg.length ? cfg[cfg.length - 1] : { level: 10, stage: 10 };
}

/**
 * 历史投喂次数累计：各轮召唤神兽前的 fedLegs 已并入 cumulativeFedLegs + 当前 fedLegs。
 * 学生卡片左下角展示 getLeaderboardWelfareScore（可为负；与福利榜一致）。
 * fedLegs 仍只表示当前这一轮养成进度，供 calcLevelInfo 使用。
 */
function getStudentDisplayFedTotal(s) {
  if (!s || typeof s !== 'object') return 0;
  return (s.cumulativeFedLegs || 0) + (s.fedLegs || 0);
}

/** 福利榜积分：投喂累计 + 鸡腿 − 兑换消耗；扣分过多时可显示为负（与福利榜、学生卡片一致） */
function getLeaderboardWelfareScore(s) {
  if (!s || typeof s !== 'object') return 0;
  const raw = getStudentDisplayFedTotal(s) + (Number(s.chickenLegs) || 0);
  const debt = Math.max(0, Number(s.shopRedeemDebt) || 0);
  return raw - debt;
}

/** 同 getLeaderboardWelfareScore，保留别名 */
function getLeaderboardWelfareScoreSigned(s) {
  return getLeaderboardWelfareScore(s);
}

/** 宠物饥饿：默认 3 天好饿 → 7 天濒临饿死 → 30 天彻底饿死 */
function getDefaultPetHungerConfig() {
  return {
    enabled: true,
    vacationMode: false,
    hungryAfterDays: 3,
    criticalAfterDays: 7,
    starveAfterDays: 15,
  };
}

/** 自上次投喂 ISO 时间起经过的完整自然日数（本地时区） */
function daysSinceLastPetFed(lastFedIso) {
  if (!lastFedIso) return 0;
  try {
    const d = new Date(lastFedIso);
    const t0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const n = new Date();
    const t1 = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
    return Math.max(0, Math.floor((t1 - t0) / 86400000));
  } catch(e) {
    return 0;
  }
}

/**
 * 取较晚的 ISO 时间字符串（无效日期则当作缺失）
 */
function _laterPetFedIso(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta)) return b;
  if (!Number.isFinite(tb)) return a;
  return ta >= tb ? a : b;
}

/**
 * 饥饿计时用的「上次投喂」时间：
 * lastPetFedAt 与积分里最近一条「加分 / 投喂」取较晚者（避免存档里字段落后于记录，误算饿死）；
 * 若仍无，再退回 createdAt。
 */
function getEffectiveLastPetFedIso(student) {
  const fromField = (student==null?void 0:student.lastPetFedAt) || null;
  let fromRecords = null;
  const sid = (student==null?void 0:student.id);
  const cid = (student==null?void 0:student.classId);
  if (typeof Store !== 'undefined' && Store.getRecordsForStudent && sid) {
    for (const r of Store.getRecordsForStudent(sid)) {
      if (!(r==null?void 0:r.createdAt)) continue;
      if (cid && r.classId && r.classId !== cid) continue;
      const fromFeed = r.type === 'feed';
      const amt = parseFloat(r.amount);
      const fromAdd = Number.isFinite(amt) && amt > 0;
      if (!fromFeed && !fromAdd) continue;
      if (!fromRecords || new Date(r.createdAt) > new Date(fromRecords)) fromRecords = r.createdAt;
    }
  }
  let best = _laterPetFedIso(fromField, fromRecords);
  if (best) return best;
  return (student==null?void 0:student.createdAt) || null;
}

/**
 * 宠物饥饿阶段（需开启班级配置且有宠物）
 * @returns {null|'hungry'|'critical'|'dead'}
 */
function getPetHungerPhase(student, hungerCfg) {
  if (!(hungerCfg==null?void 0:hungerCfg.enabled) || !(student==null?void 0:student.petType)) return null;
  if (hungerCfg.vacationMode) return null;
  const rawA = Number(hungerCfg.hungryAfterDays);
  const rawB = Number(hungerCfg.starveAfterDays);
  const rawC = Number(hungerCfg.criticalAfterDays);
  const hungryAfter = Math.max(1, Number.isFinite(rawA) ? rawA : 3);
  let starveAfter = Math.max(1, Number.isFinite(rawB) ? rawB : 30);
  if (starveAfter <= hungryAfter) starveAfter = hungryAfter + 2;
  let criticalAfter = Number.isFinite(rawC) ? rawC : hungryAfter + Math.ceil((starveAfter - hungryAfter) / 2);
  criticalAfter = Math.max(hungryAfter + 1, Math.min(starveAfter - 1, criticalAfter));
  if (criticalAfter <= hungryAfter || criticalAfter >= starveAfter) {
    criticalAfter = Math.min(starveAfter - 1, hungryAfter + 1);
  }
  let lastFedIso = getEffectiveLastPetFedIso(student);
  if (!lastFedIso) {
    const daysBack = hungryAfter + 1;
    lastFedIso = new Date(Date.now() - daysBack * 86400000).toISOString();
  }
  const days = daysSinceLastPetFed(lastFedIso);
  if (days >= starveAfter) return 'dead';
  if (days >= criticalAfter) return 'critical';
  if (days >= hungryAfter) return 'hungry';
  return null;
}

/* Helper: format relative time */
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

/* Helper: generate unique ID */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* 按需加载 Excel 库（多 CDN 回退），导出/导入时再加载，加快首屏 */
window.loadXLSX = function () {
  return new Promise((resolve, reject) => {
    if (typeof XLSX !== 'undefined') { resolve(); return; }
    const CDNS = [
      'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    ];
    let idx = 0;
    function tryLoad() {
      if (idx >= CDNS.length) { reject(new Error('Excel 库加载失败')); return; }
      const script = document.createElement('script');
      script.src = CDNS[idx];
      script.onload = () => resolve();
      script.onerror = () => { idx++; tryLoad(); };
      document.head.appendChild(script);
    }
    tryLoad();
  });
};
