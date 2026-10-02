const VOCAB_BANK = [
  ["apple", "苹果"], ["banana", "香蕉"], ["orange", "橙子"], ["grape", "葡萄"],
  ["watermelon", "西瓜"], ["pear", "梨"], ["peach", "桃子"], ["strawberry", "草莓"],
  ["cat", "猫"], ["dog", "狗"], ["bird", "鸟"], ["fish", "鱼"], ["rabbit", "兔子"],
  ["tiger", "老虎"], ["elephant", "大象"], ["monkey", "猴子"], ["book", "书"],
  ["pen", "钢笔"], ["pencil", "铅笔"], ["ruler", "尺子"], ["bag", "书包"],
  ["desk", "课桌"], ["chair", "椅子"], ["school", "学校"], ["teacher", "老师"],
  ["student", "学生"], ["friend", "朋友"], ["family", "家庭"], ["father", "爸爸"],
  ["mother", "妈妈"], ["brother", "兄弟"], ["sister", "姐妹"], ["red", "红色"],
  ["blue", "蓝色"], ["green", "绿色"], ["yellow", "黄色"], ["black", "黑色"],
  ["white", "白色"], ["one", "一"], ["two", "二"], ["three", "三"], ["four", "四"],
  ["five", "五"], ["six", "六"], ["seven", "七"], ["eight", "八"], ["nine", "九"],
  ["ten", "十"], ["run", "跑"], ["jump", "跳"], ["read", "读"], ["write", "写"],
  ["sing", "唱歌"], ["dance", "跳舞"], ["eat", "吃"], ["drink", "喝"],
  ["happy", "高兴的"], ["sad", "难过的"], ["big", "大的"], ["small", "小的"],
  ["long", "长的"], ["short", "短的"], ["hot", "热的"], ["cold", "冷的"],
  ["sunny", "晴朗的"], ["rainy", "下雨的"], ["morning", "早晨"], ["afternoon", "下午"],
  ["evening", "晚上"], ["home", "家"], ["park", "公园"], ["water", "水"],
  ["milk", "牛奶"], ["rice", "米饭"], ["bread", "面包"]
];

const DEFAULT_QUESTIONS = VOCAB_BANK.flatMap(([en, zh]) => ([
  { prompt: `"${en}" 的中文是？`, answer: zh, wrongOptions: [] },
  { prompt: `"${zh}" 的英文是？`, answer: en, wrongOptions: [] }
]));

let questionBank = normalizeQuestions(DEFAULT_QUESTIONS);

window.alert = (message) => {
  console.warn(message);
  const preview = document.getElementById("bankPreview");
  if (preview && !preview.closest("[hidden]")) {
    preview.value = String(message || "");
  }
};

const state = {
  scoreDelta: 0,
  leftCorrect: 0,
  rightCorrect: 0,
  winLimit: 6,
  startedAt: Date.now(),
  pausedAt: 0,
  totalPausedTime: 0,
  gameOver: false,
  paused: true,
  timerId: null,
  bgmPlaying: false,
  left: { current: null, locked: false, recent: [] },
  right: { current: null, locked: false, recent: [] }
};

const els = {
  tugScene: document.getElementById("tugScene"),
  blueTeam: document.getElementById("blueTeam"),
  redTeam: document.getElementById("redTeam"),
  leftPrompt: document.getElementById("leftPrompt"),
  rightPrompt: document.getElementById("rightPrompt"),
  leftOptions: document.getElementById("leftOptions"),
  rightOptions: document.getElementById("rightOptions"),
  leftFeedback: document.getElementById("leftFeedback"),
  rightFeedback: document.getElementById("rightFeedback"),
  leftCorrect: document.getElementById("leftCorrect"),
  rightCorrect: document.getElementById("rightCorrect"),
  leftMode: document.getElementById("leftMode"),
  rightMode: document.getElementById("rightMode"),
  blueScore: document.getElementById("blueScore"),
  redScore: document.getElementById("redScore"),
  timer: document.getElementById("timer"),
  deltaMarker: document.getElementById("deltaMarker"),
  deltaText: document.getElementById("deltaText"),
  resultBanner: document.getElementById("resultBanner"),
  resultText: document.getElementById("resultText"),
  winLimitSelect: document.getElementById("winLimitSelect"),
  subjectSelect: document.getElementById("subjectSelect"),
  resetBtn: document.getElementById("resetBtn"),
  playAgainBtn: document.getElementById("playAgainBtn"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
  audioBtn: document.getElementById("audioBtn"),
  bankBtn: document.getElementById("bankBtn"),
  bankModal: document.getElementById("bankModal"),
  closeBankBtn: document.getElementById("closeBankBtn"),
  templateXlsxBtn: document.getElementById("templateXlsxBtn"),
  importBankBtn: document.getElementById("importBankBtn"),
  importBankInput: document.getElementById("importBankInput"),
  bankPreview: document.getElementById("bankPreview"),
  bankCount: document.getElementById("bankCount"),
  historyBankBtn: document.getElementById("historyBankBtn"),
  historyModal: document.getElementById("historyModal"),
  closeHistoryBtn: document.getElementById("closeHistoryBtn"),
  historyList: document.getElementById("historyList"),
  historyCount: document.getElementById("historyCount"),
  customAlert: document.getElementById("customAlert"),
  alertMessage: document.getElementById("alertMessage"),
  alertBtn: document.getElementById("alertBtn"),
  bgmAudio: document.getElementById("bgmAudio"),
  correctSound: document.getElementById("correctSound"),
  wrongSound: document.getElementById("wrongSound"),
  pullSound: document.getElementById("pullSound"),
  winSound: document.getElementById("winSound"),
  clickSound: document.getElementById("clickSound")
};

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function showCustomAlert(message) {
  els.alertMessage.textContent = message;
  els.customAlert.hidden = false;
}

function hideCustomAlert() {
  els.customAlert.hidden = true;
}

function pickFirst(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && String(row[name]).trim() !== "") return String(row[name]).trim();
  }
  return "";
}

function normalizeQuestions(rows) {
  console.log("normalizeQuestions开始处理，原始行数:", rows.length);
  
  const raw = rows.map((row) => {
    const prompt = pickFirst(row, ["题目", "问题", "prompt", "question"]);
    const answer = pickFirst(row, ["正确答案", "答案", "answer", "correct"]);
    const wrongOptions = [
      pickFirst(row, ["错误选项1", "干扰项1", "选项A", "wrong1"]),
      pickFirst(row, ["错误选项2", "干扰项2", "选项B", "wrong2"]),
      pickFirst(row, ["错误选项3", "干扰项3", "选项C", "wrong3"])
    ].filter(Boolean);
    return { prompt, answer, wrongOptions };
  }).filter((row) => row.prompt && row.answer);

  console.log("过滤后有效题目数:", raw.length);

  if (raw.length < 4) {
    throw new Error("题库至少需要 4 道题，才能让两个队伍岔开出题并生成干扰选项。");
  }

  const allAnswers = [...new Set(raw.map((row) => row.answer))];
  return raw.map((row, index) => {
    const fallbackWrong = shuffle(allAnswers.filter((answer) => answer !== row.answer));
    const wrongOptions = [...new Set([...row.wrongOptions, ...fallbackWrong])]
      .filter((option) => option !== row.answer)
      .slice(0, 3);

    if (wrongOptions.length < 3) {
      throw new Error("题库答案需要更丰富，或在模板里填写 3 个错误选项。");
    }

    return {
      id: `${index}-${row.prompt}-${row.answer}`,
      prompt: row.prompt,
      answer: row.answer,
      wrongOptions
    };
  });
}

function buildOptions(question) {
  return shuffle([question.answer, ...shuffle(question.wrongOptions).slice(0, 3)]);
}

function pickQuestion(side) {
  const otherSide = side === "left" ? "right" : "left";
  const otherId = state[otherSide].current?.id;
  const recent = new Set(state[side].recent);
  const strictPool = questionBank.filter((question) => question.id !== otherId && !recent.has(question.id));
  const loosePool = questionBank.filter((question) => question.id !== otherId);
  const pool = strictPool.length ? strictPool : (loosePool.length ? loosePool : questionBank);
  const question = randomItem(pool);
  state[side].recent = [question.id, ...state[side].recent.filter((id) => id !== question.id)].slice(0, 4);
  return { ...question, options: buildOptions(question) };
}

function textWeight(text) {
  return Array.from(String(text)).reduce((sum, char) => {
    return sum + (/[\u4e00-\u9fff]/.test(char) ? 2 : 1);
  }, 0);
}

function applyTextDensity(element, text, type) {
  const weight = textWeight(text);
  if (type === "prompt") {
    element.classList.remove("prompt-long", "prompt-very-long", "prompt-tiny");
    if (weight >= 54) element.classList.add("prompt-tiny");
    else if (weight >= 38) element.classList.add("prompt-very-long");
    else if (weight >= 26) element.classList.add("prompt-long");
    return;
  }

  element.classList.remove("long-text", "extra-long-text", "compact-text", "micro-text");
  if (weight >= 36) element.classList.add("micro-text");
  else if (weight >= 26) element.classList.add("compact-text");
  else if (weight >= 18) element.classList.add("extra-long-text");
  else if (weight >= 12) element.classList.add("long-text");
}

function markPromptLength(promptEl, side, text) {
  const panel = promptEl.closest(".team-panel");
  const weight = textWeight(text);
  panel?.classList.remove("has-long-prompt", "has-very-long-prompt");
  if (weight >= 38) panel?.classList.add("has-very-long-prompt");
  else if (weight >= 26) panel?.classList.add("has-long-prompt");

  window.requestAnimationFrame(() => fitPromptText(promptEl));
}

function fitPromptText(promptEl) {
  let size = parseFloat(getComputedStyle(promptEl).fontSize);
  let guard = 0;
  while (
    guard < 18 &&
    size > 14 &&
    (promptEl.scrollHeight > promptEl.clientHeight + 1 || promptEl.scrollWidth > promptEl.clientWidth + 1)
  ) {
    size -= 1.4;
    promptEl.style.fontSize = `${size}px`;
    promptEl.style.lineHeight = size < 18 ? "1.04" : "1.08";
    guard += 1;
  }
}

function renderQuestion(side) {
  if (!questionBank || questionBank.length === 0) {
    console.warn("题库为空，无法渲染题目");
    const promptEl = side === "left" ? els.leftPrompt : els.rightPrompt;
    promptEl.textContent = "题库加载中...";
    return;
  }
  
  const sideState = state[side];
  sideState.current = pickQuestion(side);
  const promptEl = side === "left" ? els.leftPrompt : els.rightPrompt;
  const optionsEl = side === "left" ? els.leftOptions : els.rightOptions;
  const feedbackEl = side === "left" ? els.leftFeedback : els.rightFeedback;

  console.log(`${side}队渲染题目:`, sideState.current.prompt);

  promptEl.textContent = sideState.current.prompt;
  promptEl.style.fontSize = "";
  promptEl.style.lineHeight = "";
  applyTextDensity(promptEl, sideState.current.prompt, "prompt");
  markPromptLength(promptEl, side, sideState.current.prompt);
  feedbackEl.textContent = side === "left" ? "点中正确答案就向左拉" : "点中正确答案就向右拉";
  optionsEl.innerHTML = "";

  sideState.current.options.forEach((optionText) => {
    const button = document.createElement("button");
    button.className = "option-btn";
    button.type = "button";
    button.textContent = optionText;
    applyTextDensity(button, optionText, "option");
    button.addEventListener("pointerup", (event) => {
      event.preventDefault();
      handleAnswer(side, optionText, button);
    });
    optionsEl.appendChild(button);
  });
}

function handleAnswer(side, selected, button) {
  if (state.gameOver || state[side].locked) return;
  
  // 如果游戏暂停，提示用户点击开始按钮
  if (state.paused) {
    showCustomAlert("请点击右上角 开始 按钮");
    return;
  }

  const current = state[side].current;
  if (!current) return;

  playSound(els.clickSound, 0.18);

  if (selected !== current.answer) {
    playSound(els.wrongSound, 0.42);
    button.classList.remove("wrong-flash");
    void button.offsetWidth;
    button.classList.add("wrong-flash");
    setFeedback(side, "答错了，题目不换，继续想");
    window.setTimeout(() => button.classList.remove("wrong-flash"), 900);
    return;
  }

  state[side].locked = true;
  button.classList.add("correct-flash");
  playSound(els.correctSound, 0.42);
  window.setTimeout(() => playSound(els.pullSound, 0.34), 70);

  if (side === "left") {
    state.scoreDelta += 1;
    state.leftCorrect += 1;
    triggerPull("left");
    setFeedback("left", "正确，蓝队发力");
  } else {
    state.scoreDelta -= 1;
    state.rightCorrect += 1;
    triggerPull("right");
    setFeedback("right", "正确，红队发力");
  }

  updateScoreboard();
  updateScenePosition();

  if (Math.abs(state.scoreDelta) >= state.winLimit) {
    finishGame(state.scoreDelta > 0 ? "left" : "right");
    return;
  }

  window.setTimeout(() => {
    state[side].locked = false;
    renderQuestion(side);
  }, 360);
}

function setFeedback(side, text) {
  const feedbackEl = side === "left" ? els.leftFeedback : els.rightFeedback;
  feedbackEl.textContent = text;
}

function triggerPull(side) {
  const cluster = side === "left" ? els.blueTeam : els.redTeam;
  cluster.classList.remove("pulling");
  void cluster.offsetWidth;
  cluster.classList.add("pulling");
  window.setTimeout(() => cluster.classList.remove("pulling"), 560);
}

function updateScoreboard() {
  els.leftCorrect.textContent = state.leftCorrect;
  els.rightCorrect.textContent = state.rightCorrect;
  els.blueScore.textContent = state.leftCorrect;
  els.redScore.textContent = state.rightCorrect;
  els.deltaText.textContent = `${Math.abs(state.scoreDelta)} / ${state.winLimit}`;
}

function updateScenePosition() {
  const step = Math.min(42, Math.max(30, els.tugScene.clientWidth * 0.045));
  const offset = -state.scoreDelta * step;
  els.tugScene.style.setProperty("--scene-offset", `${offset}px`);

  const markerPercent = 50 - (state.scoreDelta / state.winLimit) * 46;
  els.deltaMarker.style.left = `${Math.max(4, Math.min(96, markerPercent))}%`;
}

function finishGame(winner) {
  state.gameOver = true;
  state.paused = false;
  state.left.locked = true;
  state.right.locked = true;
  
  // 暂停BGM背景音乐
  if (state.bgmPlaying && els.bgmAudio) {
    els.bgmAudio.pause();
  }
  
  els.resultBanner.hidden = false;
  els.resultBanner.classList.toggle("red-win", winner === "right");
  els.resultText.textContent = winner === "left" ? "蓝队获胜" : "红队获胜";
  els.resetBtn.textContent = "重新开始";
  setFeedback("left", winner === "left" ? "蓝队赢了" : "本局结束");
  setFeedback("right", winner === "right" ? "红队赢了" : "本局结束");
  playSound(els.winSound, 0.45);
}

function resetGame() {
  console.log("重置游戏，当前题库数量:", questionBank?.length || 0);
  
  state.scoreDelta = 0;
  state.leftCorrect = 0;
  state.rightCorrect = 0;
  state.winLimit = Number(els.winLimitSelect.value);
  state.startedAt = Date.now();
  state.pausedAt = 0;
  state.totalPausedTime = 0;
  state.gameOver = false;
  state.paused = true;
  state.left.locked = false;
  state.right.locked = false;
  state.left.recent = [];
  state.right.recent = [];
  els.resultBanner.hidden = true;
  els.resultBanner.classList.remove("red-win");
  els.resetBtn.textContent = "开始";
  updateScoreboard();
  updateScenePosition();
  renderQuestion("left");
  renderQuestion("right");
}

function togglePause() {
  if (state.gameOver) {
    resetGame();
    return;
  }
  
  state.paused = !state.paused;
  els.resetBtn.textContent = state.paused ? "开始" : "暂停";
  
  if (state.paused) {
    // 记录暂停时间
    state.pausedAt = Date.now();
    setFeedback("left", "游戏已暂停");
    setFeedback("right", "游戏已暂停");
  } else {
    // 计算暂停时长并累加
    if (state.pausedAt > 0) {
      state.totalPausedTime += Date.now() - state.pausedAt;
      state.pausedAt = 0;
    }
    // 继续游戏时重新渲染题目，确保有题目显示
    if (!state.left.current || !state.right.current) {
      renderQuestion("left");
      renderQuestion("right");
    }
    setFeedback("left", "点中正确答案就向左拉");
    setFeedback("right", "点中正确答案就向右拉");
  }
}

function updateTimer() {
  // 暂停或游戏结束时不更新计时器
  if (state.paused || state.gameOver) {
    return;
  }
  
  const elapsed = Math.max(0, Math.floor((Date.now() - state.startedAt - state.totalPausedTime) / 1000));
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  els.timer.textContent = `${minutes}:${seconds}`;
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

function playSound(audio, volume = 0.35) {
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = volume;
    audio.play().catch(() => {});
  } catch {
    // Some browsers block audio until the first whiteboard tap.
  }
}

async function toggleBgm() {
  if (!state.bgmPlaying) {
    try {
      els.bgmAudio.volume = 0.28;
      await els.bgmAudio.play();
      state.bgmPlaying = true;
      els.audioBtn.textContent = "静音";
    } catch {
      els.audioBtn.textContent = "放入BGM";
      alert("请把本地背景音乐放到 assets/audio/bgm.mp3，然后重新打开游戏。");
    }
  } else {
    els.bgmAudio.pause();
    state.bgmPlaying = false;
    els.audioBtn.textContent = "音乐";
  }
}

function makeTemplateRows() {
  return [
    { 题目: '"apple" 的中文是？', 正确答案: "苹果", 错误选项1: "香蕉", 错误选项2: "学校", 错误选项3: "跑" },
    { 题目: "8 + 7 = ?", 正确答案: "15", 错误选项1: "14", 错误选项2: "16", 错误选项3: "13" },
    { 题目: "“春风又绿江南岸”的下一句是？", 正确答案: "明月何时照我还", 错误选项1: "二月春风似剪刀", 错误选项2: "春眠不觉晓", 错误选项3: "低头思故乡" },
    { 题目: "长方形的面积公式是？", 正确答案: "长×宽", 错误选项1: "边长×边长", 错误选项2: "底×高÷2", 错误选项3: "（上底+下底）×高÷2" },
    { 题目: '"高兴的" 的英文是？', 正确答案: "happy", 错误选项1: "sad", 错误选项2: "cold", 错误选项3: "short" },
    { 题目: "下列哪个是量词？", 正确答案: "只", 错误选项1: "跑", 错误选项2: "红", 错误选项3: "学校" }
  ];
}

function downloadTemplateXlsx() {
  if (!window.XLSX) {
    alert("缺少 XLSX 组件，请确认 assets/vendor/xlsx.full.min.js 存在。");
    return;
  }
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(makeTemplateRows(), {
    header: ["题目", "正确答案", "错误选项1", "错误选项2", "错误选项3"]
  });
  sheet["!cols"] = [{ wch: 34 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(workbook, sheet, "题库模板");
  XLSX.writeFile(workbook, "学习拔河题目模板.xlsx");
}

function openBankModal() {
  refreshBankPreview();
  els.bankModal.hidden = false;
}

function closeBankModal() {
  els.bankModal.hidden = true;
}

function refreshBankPreview() {
  els.bankCount.textContent = `${questionBank.length} 道题`;
  els.bankPreview.value = questionBank
    .slice(0, 80)
    .map((question, index) => `${index + 1}. ${question.prompt}\n答案：${question.answer}\n选项：${shuffle([question.answer, ...question.wrongOptions]).join(" / ")}`)
    .join("\n\n");
}

async function importBankFile(file) {
  if (!window.XLSX) {
    throw new Error("缺少 XLSX 组件，请确认 assets/vendor/xlsx.full.min.js 存在。");
  }
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  questionBank = normalizeQuestions(rows);

  // 保存到导入记录
  saveImportHistory(file.name, rows);

  resetGame();
  refreshBankPreview();
}

// ---- 导入历史记录 ----
const HISTORY_KEY = "tug_import_history";

function loadImportHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveImportHistory(fileName, rows) {
  const history = loadImportHistory();
  // 序列化rows为JSON字符串保存
  const entry = {
    id: Date.now(),
    name: fileName,
    count: normalizeQuestions(rows).length,
    date: new Date().toLocaleString("zh-CN"),
    rows: JSON.stringify(rows)
  };
  // 同名文件更新，不重复添加
  const existingIndex = history.findIndex((item) => item.name === fileName);
  if (existingIndex >= 0) {
    history[existingIndex] = entry;
  } else {
    history.unshift(entry);
  }
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function deleteImportHistory(id) {
  const history = loadImportHistory().filter((item) => item.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistoryList();
}

function applyHistoryEntry(entry) {
  try {
    const rows = JSON.parse(entry.rows);
    questionBank = normalizeQuestions(rows);
    els.leftMode.textContent = entry.name.replace(/\.[^.]+$/, "");
    els.rightMode.textContent = entry.name.replace(/\.[^.]+$/, "");
    resetGame();
    refreshBankPreview();
    closeHistoryModal();
    openBankModal();
  } catch (error) {
    showCustomAlert("记录数据异常，无法应用：" + (error.message || ""));
  }
}

function renderHistoryList() {
  const history = loadImportHistory();
  els.historyCount.textContent = `${history.length} 条记录`;
  els.historyList.innerHTML = "";

  if (history.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "暂无导入记录";
    els.historyList.appendChild(empty);
    return;
  }

  history.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "history-item";

    const info = document.createElement("div");
    info.className = "history-item-info";
    info.innerHTML = `<div class="history-item-name">${entry.name}</div><div class="history-item-meta">${entry.count} 道题 &nbsp;·&nbsp; ${entry.date}</div>`;

    const applyBtn = document.createElement("button");
    applyBtn.className = "history-apply-btn";
    applyBtn.type = "button";
    applyBtn.textContent = "应用";
    applyBtn.addEventListener("click", () => applyHistoryEntry(entry));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "history-delete-btn";
    deleteBtn.type = "button";
    deleteBtn.textContent = "×";
    deleteBtn.addEventListener("click", () => deleteImportHistory(entry.id));

    item.appendChild(info);
    item.appendChild(applyBtn);
    item.appendChild(deleteBtn);
    els.historyList.appendChild(item);
  });
}

function openHistoryModal() {
  renderHistoryList();
  els.historyModal.hidden = false;
}

function closeHistoryModal() {
  els.historyModal.hidden = true;
}

// ---- 导入历史记录 END ----

// 预加载所有学科题库
const subjectData = {};
let preloadComplete = false;

async function preloadAllSubjects() {
  // 检查嵌入数据是否存在
  if (typeof EMBEDDED_SUBJECTS === 'undefined') {
    console.warn("未找到嵌入数据，将使用网络加载");
    preloadComplete = true;
    return;
  }
  
  console.log("嵌入数据已就绪，将按需解码");
  preloadComplete = true;
}

function decodeBase64ToBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function loadSubjectFile() {
  const fileName = els.subjectSelect.value;
  if (!fileName) return;
  
  console.log(`开始加载题库: ${fileName}`);
  
  // 获取学科名称
  const subjectName = els.subjectSelect.options[els.subjectSelect.selectedIndex].text;
  
  try {
    let buffer = subjectData[fileName];
    
    // 如果没有缓存，尝试从嵌入数据解码
    if (!buffer && typeof EMBEDDED_SUBJECTS !== 'undefined' && EMBEDDED_SUBJECTS[fileName]) {
      console.log(`按需解码: ${fileName}`);
      buffer = decodeBase64ToBuffer(EMBEDDED_SUBJECTS[fileName]);
      subjectData[fileName] = buffer; // 缓存解码后的数据
      console.log(`解码完成: ${fileName} (${buffer.byteLength} 字节)`);
    }
    
    // 如果还没有数据，尝试网络加载
    if (!buffer) {
      console.log(`嵌入数据不存在，尝试网络加载: ${fileName}`);
      buffer = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', fileName, true);
        xhr.responseType = 'arraybuffer';
        
        xhr.onload = function() {
          if (xhr.status === 200 || xhr.status === 0) {
            resolve(xhr.response);
          } else {
            reject(new Error(`加载失败 (状态码: ${xhr.status})`));
          }
        };
        
        xhr.onerror = function() {
          reject(new Error(`网络错误`));
        };
        
        xhr.send();
      });
      
      // 缓存起来
      subjectData[fileName] = buffer;
    }
    
    console.log(`使用题库数据，大小: ${buffer.byteLength} 字节`);
    
    if (!window.XLSX) {
      throw new Error("缺少 XLSX 组件，请确认 assets/vendor/xlsx.full.min.js 存在。");
    }
    
    const workbook = XLSX.read(buffer, { type: "array" });
    console.log(`Excel工作簿已解析，工作表: ${workbook.SheetNames.join(', ')}`);
    
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    
    console.log(`读取到 ${rows.length} 行原始数据`);
    
    if (rows.length === 0) {
      throw new Error(`${fileName} 中没有找到题目数据`);
    }
    
    // 显示前几行数据用于调试
    console.log("前3行数据示例:", rows.slice(0, 3));
    
    questionBank = normalizeQuestions(rows);
    console.log(`✓ 题库加载成功: ${fileName}, 共 ${questionBank.length} 道题`);
    console.log("题库前3题:", questionBank.slice(0, 3).map(q => q.prompt));
    
    // 更新学科标签
    els.leftMode.textContent = subjectName;
    els.rightMode.textContent = subjectName;
    
    resetGame();
    
    if (els.bankModal && !els.bankModal.hidden) {
      refreshBankPreview();
    }
  } catch (error) {
    const errorMsg = error.message || `加载学科题库失败：${fileName}`;
    console.error("题库加载错误:", errorMsg, error);
    alert(errorMsg);
  }
}

async function toggleBgmSafe() {
  if (!state.bgmPlaying) {
    try {
      els.bgmAudio.volume = 0.28;
      await els.bgmAudio.play();
      state.bgmPlaying = true;
      els.audioBtn.textContent = "静音";
    } catch {
      state.bgmPlaying = false;
      els.audioBtn.textContent = "缺少BGM";
      window.setTimeout(() => {
        if (!state.bgmPlaying) els.audioBtn.textContent = "音乐";
      }, 1500);
    }
    return;
  }

  els.bgmAudio.pause();
  state.bgmPlaying = false;
  els.audioBtn.textContent = "音乐";
}

function installWhiteboardGuards() {
  const stop = (event) => event.preventDefault();
  ["contextmenu", "selectstart", "dragstart", "auxclick"].forEach((eventName) => {
    document.addEventListener(eventName, stop, { capture: true });
  });

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const blocked =
      key === "f12" ||
      (event.ctrlKey && ["u", "s", "p", "o"].includes(key)) ||
      (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key));
    if (blocked) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, { capture: true });
}

els.resetBtn.addEventListener("click", togglePause);
els.playAgainBtn.addEventListener("click", resetGame);
els.winLimitSelect.addEventListener("change", resetGame);
els.subjectSelect.addEventListener("change", () => {
  console.log("学科选择变更:", els.subjectSelect.value);
  loadSubjectFile();
});
els.fullscreenBtn.addEventListener("click", toggleFullscreen);
els.audioBtn.addEventListener("click", toggleBgmSafe);
els.bankBtn.addEventListener("click", openBankModal);
els.closeBankBtn.addEventListener("click", closeBankModal);
els.historyBankBtn.addEventListener("click", openHistoryModal);
els.closeHistoryBtn.addEventListener("click", closeHistoryModal);
els.templateXlsxBtn.addEventListener("click", downloadTemplateXlsx);
els.importBankBtn.addEventListener("click", () => els.importBankInput.click());
els.importBankInput.addEventListener("change", async () => {
  const [file] = els.importBankInput.files;
  if (!file) return;
  try {
    await importBankFile(file);
    els.bankPreview.value = `${els.bankPreview.value}\n\n导入成功：${file.name}`;
  } catch (error) {
    alert(error.message || "题库导入失败，请检查 Excel 表头和内容。");
  } finally {
    els.importBankInput.value = "";
  }
});
els.bankModal.addEventListener("pointerdown", (event) => {
  if (event.target === els.bankModal) closeBankModal();
});
els.historyModal.addEventListener("pointerdown", (event) => {
  if (event.target === els.historyModal) closeHistoryModal();
});
els.alertBtn.addEventListener("click", hideCustomAlert);
els.customAlert.addEventListener("pointerdown", (event) => {
  if (event.target === els.customAlert) hideCustomAlert();
});
window.addEventListener("resize", updateScenePosition);

installWhiteboardGuards();
state.timerId = window.setInterval(updateTimer, 500);
updateTimer();

// 预加载所有学科题库，然后加载默认科目
(async () => {
  console.log("开始预加载所有学科题库...");
  await preloadAllSubjects();
  console.log("预加载完成，加载默认科目...");
  loadSubjectFile();
})();
