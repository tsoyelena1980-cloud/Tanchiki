
(() => {
  "use strict";

  const TILE = 48;
  const GRID = 13;
  const SIZE = TILE * GRID;
  const STEP = 1 / 120;
  const STORAGE = "tanchiki-retro-v1";

  const T = {
    EMPTY: 0, BRICK: 1, STEEL: 2,
    WATER: 3, FOREST: 4, ICE: 5, BASE: 6
  };

  const DIR = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 }
  ];

  const TYPES = {
    normal: { hp: 1, speed: 67, score: 100, color: "#e8b86b", fire: 2.2 },
    fast: { hp: 1, speed: 105, score: 200, color: "#f08072", fire: 1.8 },
    armor: { hp: 3, speed: 51, score: 300, color: "#b1b9c8", fire: 2.5 },
    elite: { hp: 2, speed: 83, score: 400, color: "#ba85e9", fire: 1.05 }
  };

  const BONUS_TYPES = ["star", "shield", "clock", "grenade", "life", "shovel"];

  const LEVELS = [
    {
      enemies: [5, 2, 1, 0],
      rows: [
        ".............",
        "..BB.....BB..",
        "..BB..W..BB..",
        ".....WWW.....",
        ".BB.......BB.",
        ".BB.S...S.BB.",
        "....FF.FF....",
        "...F.....F...",
        ".BB...I...BB.",
        ".BB..III..BB.",
        ".............",
        ".....B.B.....",
        ".....B.B....."
      ]
    },
    {
      enemies: [5, 4, 2, 1],
      rows: [
        ".............",
        ".BB..S.S..BB.",
        "..B.......B..",
        "...WW.WW.....",
        ".S...W...S...",
        ".BB.....BB...",
        "....FFFF.....",
        "..BB....BB...",
        "....IIIII....",
        ".BB.....BB...",
        "...S.....S...",
        ".....B.B.....",
        ".....B.B....."
      ]
    },
    {
      enemies: [5, 5, 3, 2],
      rows: [
        ".............",
        "..S.BBB.S....",
        "..S.....S....",
        "....WWW......",
        ".BBB...BBB...",
        "...F...F.....",
        "..FF...FF....",
        "...S...S.....",
        ".BB..I..BB...",
        "....III......",
        "..BB...BB....",
        ".....B.B.....",
        ".....B.B....."
      ]
    },
    {
      enemies: [4, 5, 5, 3],
      rows: [
        ".............",
        ".S.BB.BB.S...",
        "...B...B.....",
        ".WW.....WW...",
        ".WW.S.S.WW...",
        "....FFF......",
        "..BB...BB....",
        "...I...I.....",
        ".S.IIIII.S...",
        "...BB.BB.....",
        "..F.....F....",
        ".....B.B.....",
        ".....B.B....."
      ]
    },
    {
      enemies: [5, 5, 6, 5],
      rows: [
        ".............",
        ".S.B.S.B.S...",
        "..BB...BB....",
        ".WW..S..WW...",
        "...F...F.....",
        ".BB.FFF.BB...",
        "...S...S.....",
        "..I..W..I....",
        ".BB..W..BB...",
        "...IIIII.....",
        ".S.B...B.S...",
        ".....B.B.....",
        ".....B.B....."
      ]
    }
  ];

  const $ = id => document.getElementById(id);
  const canvas = $("game");
  const ctx = canvas.getContext("2d", { alpha: false });

  const ui = {
    overlay: $("overlay"),
    score: $("score"),
    level: $("level"),
    lives: $("lives"),
    remaining: $("remaining"),
    best: $("best")
  };

  const panels = [
    "menuPanel", "recordsPanel", "settingsPanel",
    "pausePanel", "resultPanel", "levelPanel"
  ];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const pad = n => String(n).padStart(6, "0");
  const intersects = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x &&
    a.y < b.y + b.h && a.y + a.h > b.y;

  const box = tank => ({
    x: tank.x - 17, y: tank.y - 17, w: 34, h: 34
  });

  function safeRead() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE) || "{}");
      return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    } catch {
      return {};
    }
  }

  function cleanRecords(data) {
    if (!Array.isArray(data)) return [];
    return data.filter(r =>
      r && typeof r.name === "string" &&
      Number.isSafeInteger(r.score) && r.score >= 0 &&
      Number.isInteger(r.level) && r.level >= 1 && r.level <= 5 &&
      Number.isInteger(r.kills) && r.kills >= 0 &&
      typeof r.date === "string" &&
      Number.isFinite(Date.parse(r.date))
    ).map(r => ({
      name: r.name.slice(0, 16),
      score: r.score,
      level: r.level,
      kills: r.kills,
      date: r.date
    })).sort((a, b) => b.score - a.score).slice(0, 10);
  }

  const stored = safeRead();
  let records = cleanRecords(stored.records);
  let settings = {
    sound: typeof stored.settings?.sound === "boolean"
      ? stored.settings.sound : true,
    volume: Number.isFinite(stored.settings?.volume)
      ? clamp(stored.settings.volume, 0, 1) : 0.45
  };

  function persist() {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ records, settings }));
      return true;
    } catch {
      return false;
    }
  }

  class Sound {
    constructor() { this.context = null; }

    unlock() {
      try {
        if (!this.context) {
          const Audio = window.AudioContext || window.webkitAudioContext;
          if (Audio) this.context = new Audio();
        }
        if (this.context?.state === "suspended") this.context.resume().catch(() => {});
      } catch {}
    }

    tone(freq, duration, type = "square", volume = 0.12, end = null, delay = 0) {
      if (!settings.sound || !settings.volume || !this.context) return;
      try {
        const ac = this.context;
        const start = ac.currentTime + delay;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(Math.max(20, freq), start);
        if (end) osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
        gain.gain.setValueAtTime(Math.max(0.0001, volume * settings.volume), start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(start);
        osc.stop(start + duration + 0.01);
      } catch {}
    }

    play(name) {
      switch (name) {
        case "shoot": this.tone(650, .09, "square", .13, 160); break;
        case "hit": this.tone(200, .08, "triangle", .16, 75); break;
        case "explosion":
          this.tone(140, .23, "sawtooth", .23, 35);
          this.tone(65, .28, "triangle", .18, 25);
          break;
        case "destroy":
          this.tone(370, .12, "square", .14, 110);
          this.tone(140, .25, "sawtooth", .2, 35, .1);
          break;
        case "bonus":
          [440, 660, 880].forEach((f, i) => this.tone(f, .13, "square", .13, null, i * .09));
          break;
        case "lose": this.tone(320, .45, "sawtooth", .2, 45); break;
        case "win":
          [392, 523, 659, 784].forEach((f, i) => this.tone(f, .18, "square", .16, null, i * .15));
          break;
        case "click": this.tone(420, .045, "square", .07); break;
      }
    }
  }

  const audio = new Sound();

  const input = {
    keys: new Set(),
    touch: { up: new Set(), down: new Set(), left: new Set(), right: new Set(), fire: new Set() },
    active(name) {
      const map = {
        up: ["ArrowUp", "KeyW"],
        down: ["ArrowDown", "KeyS"],
        left: ["ArrowLeft", "KeyA"],
        right: ["ArrowRight", "KeyD"],
        fire: ["Space"]
      };
      return this.touch[name].size > 0 || map[name].some(k => this.keys.has(k));
    },
    clear() {
      this.keys.clear();
      Object.values(this.touch).forEach(s => s.clear());
      document.querySelectorAll(".pressed").forEach(el => el.classList.remove("pressed"));
    }
  };

  class Tank {
    constructor(x, y, team, type = "normal") {
      this.x = x; this.y = y;
      this.team = team;
      this.type = type;
      this.dir = team === "player" ? 0 : 2;
      this.hp = team === "player" ? 1 : TYPES[type].hp;
      this.speed = team === "player" ? 112 : TYPES[type].speed;
      this.cooldown = team === "player" ? 0 : rand(.6, 1.6);
      this.spawn = 1.4;
      this.invulnerable = team === "player" ? 2.6 : 0;
      this.track = 0;
      this.recoil = 0;
      this.aiTime = rand(.4, 1.2);
      this.stuck = 0;
      this.targetDir = this.dir;
      this.slipX = 0; this.slipY = 0;
      this.alive = true;
      this.flash = 0;
      this.weapon = 0;
    }
  }

  class Game {
    constructor() {
      this.state = "menu";
      this.map = [];
      this.tanks = [];
      this.bullets = [];
      this.particles = [];
      this.bonuses = [];
      this.player = null;
      this.level = 1;
      this.score = 0;
      this.lives = 3;
      this.kills = 0;
      this.queue = [];
      this.spawnTimer = 0;
      this.bonusTimer = 0;
      this.freeze = 0;
      this.baseArmor = 0;
      this.shake = 0;
      this.time = 0;
      this.transition = 0;
      this.last = 0;
      this.accumulator = 0;
      this.savedResult = false;
      this.ending = false;
      this.bestAtStart = 0;
      this.setupCanvas();
      this.bind();
      this.show("menuPanel");
      this.updateHUD();
      requestAnimationFrame(t => this.frame(t));
    }

    setupCanvas() {
      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(SIZE * dpr);
        canvas.height = Math.round(SIZE * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
      };
      resize();
      window.addEventListener("resize", resize);
    }

    show(id) {
      ui.overlay.classList.toggle("hidden", !id);
      panels.forEach(p => $(p).classList.toggle("hidden", p !== id));
    }

    bind() {
      const click = (id, fn) => $(id).addEventListener("click", () => {
        audio.unlock();
        audio.play("click");
        fn();
      });

      click("startBtn", () => this.start());
      click("retryBtn", () => this.start());
      click("recordsBtn", () => this.openRecords());
      click("settingsBtn", () => this.openSettings());
      click("resumeBtn", () => this.pause());
      click("pauseBtn", () => this.pause());
      click("pauseMenuBtn", () => this.menu());
      click("resultMenuBtn", () => this.menu());
      click("saveRecordBtn", () => this.saveRecord());
      click("soundBtn", () => this.toggleSound());

      document.querySelectorAll(".backBtn").forEach(b =>
        b.addEventListener("click", () => {
          audio.play("click");
          this.show("menuPanel");
        })
      );

      click("clearRecordsBtn", () => {
        if (confirm("Удалить все рекорды?")) {
          records = [];
          persist();
          this.openRecords();
          this.updateHUD();
        }
      });

      $("soundToggle").addEventListener("change", e => {
        settings.sound = e.target.checked;
        persist();
        this.syncSettings();
      });

      $("volumeSlider").addEventListener("input", e => {
        settings.volume = clamp(Number(e.target.value) / 100, 0, 1);
        persist();
        this.syncSettings();
      });

      $("playerName").addEventListener("keydown", e => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.saveRecord();
        }
      });

      window.addEventListener("keydown", e => {
        const code = e.code;
        const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
        if (typing) return;

        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(code) &&
            ["playing", "paused", "ready"].includes(this.state)) e.preventDefault();

        if (code === "KeyM" && !e.repeat) this.toggleSound();
        if ((code === "KeyP" || code === "Escape") && !e.repeat) this.pause();

        if (code === "Enter" && !e.repeat &&
            ["menu", "over"].includes(this.state)) this.start();

        input.keys.add(code);
        if (["Space", "Enter"].includes(code)) audio.unlock();
      });

      window.addEventListener("keyup", e => input.keys.delete(e.code));
      window.addEventListener("blur", () => {
        input.clear();
        if (this.state === "playing") this.pause();
      });

      document.addEventListener("visibilitychange", () => {
        if (document.hidden && this.state === "playing") this.pause();
      });

      document.querySelectorAll("[data-control]").forEach(btn => {
        const name = btn.dataset.control;
        btn.addEventListener("pointerdown", e => {
          e.preventDefault();
          audio.unlock();
          try { btn.setPointerCapture(e.pointerId); } catch {}
          input.touch[name].add(e.pointerId);
          btn.classList.add("pressed");
        });
        const release = e => {
          input.touch[name].delete(e.pointerId);
          if (!input.touch[name].size) btn.classList.remove("pressed");
        };
        btn.addEventListener("pointerup", release);
        btn.addEventListener("pointercancel", release);
        btn.addEventListener("lostpointercapture", release);
      });

      this.syncSettings();
    }

    syncSettings() {
      $("soundToggle").checked = settings.sound;
      $("volumeSlider").value = Math.round(settings.volume * 100);
      $("volumeValue").textContent = Math.round(settings.volume * 100) + "%";
      $("soundBtn").textContent = settings.sound ? "♫ ВКЛ" : "♫ ВЫКЛ";
    }

    toggleSound() {
      audio.unlock();
      settings.sound = !settings.sound;
      persist();
      this.syncSettings();
      if (settings.sound) audio.play("click");
    }

    menu() {
      this.state = "menu";
      this.ending = false;
      input.clear();
      this.show("menuPanel");
    }

    openSettings() {
      this.syncSettings();
      this.show("settingsPanel");
    }

    openRecords() {
      const tbody = $("recordsBody");
      tbody.replaceChildren();

      if (!records.length) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 6;
        td.textContent = "ПОКА НЕТ РЕКОРДОВ";
        tr.appendChild(td);
        tbody.appendChild(tr);
      }

      records.forEach((r, i) => {
        const tr = document.createElement("tr");
        const values = [
          i + 1, r.name, r.score, r.level, r.kills,
          new Date(r.date).toLocaleString("ru-RU", {
            day: "2-digit", month: "2-digit",
            year: "2-digit", hour: "2-digit", minute: "2-digit"
          })
        ];
        values.forEach(v => {
          const td = document.createElement("td");
          td.textContent = String(v);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      this.show("recordsPanel");
    }

    start() {
      audio.unlock();
      input.clear();
      this.score = 0;
      this.lives = 3;
      this.kills = 0;
      this.level = 1;
      this.ending = false;
      this.savedResult = false;
      this.bestAtStart = records[0]?.score || 0;
      this.loadLevel();
    }

    loadLevel() {
      const config = LEVELS[this.level - 1];
      this.map = config.rows.map(row =>
        [...row].map(ch => ({
          ".": T.EMPTY, B: T.BRICK, S: T.STEEL,
          W: T.WATER, F: T.FOREST, I: T.ICE
        })[ch] ?? T.EMPTY)
      );

      // Центральный орёл и укрепления.
      this.map[12][6] = T.BASE;
      this.map[11][5] = T.BRICK;
      this.map[11][6] = T.EMPTY;
      this.map[11][7] = T.BRICK;
      this.map[12][5] = T.BRICK;
      this.map[12][7] = T.BRICK;

      // Свободные точки появления.
      for (const x of [0, 6, 12]) {
        this.map[0][x] = T.EMPTY;
        this.map[1][x] = T.EMPTY;
      }
      this.map[12][4] = T.EMPTY;
      this.map[11][4] = T.EMPTY;

      this.tanks = [];
      this.bullets = [];
      this.particles = [];
      this.bonuses = [];
      this.freeze = 0;
      this.baseArmor = 0;
      this.shake = 0;
      this.bonusTimer = rand(9, 14);
      this.spawnTimer = 1.3;
      this.transition = 2.2;
      this.queue = [];

      const names = ["normal", "fast", "armor", "elite"];
      config.enemies.forEach((count, i) => {
        for (let j = 0; j < count; j++) this.queue.push(names[i]);
      });
      // Разнообразный, но воспроизводимый по сложности набор.
      this.queue.sort(() => Math.random() - 0.5);

      this.player = new Tank(4.5 * TILE, 12.5 * TILE, "player");
      this.tanks.push(this.player);
      this.state = "ready";
      $("levelTitle").textContent = "УРОВЕНЬ " + this.level;
      this.show("levelPanel");
      this.updateHUD();
    }

    pause() {
      if (this.state === "playing") {
        this.state = "paused";
        input.clear();
        this.show("pausePanel");
      } else if (this.state === "paused") {
        this.state = "playing";
        this.show(null);
      }
    }

    updateHUD() {
      ui.score.textContent = pad(this.score);
      ui.level.textContent = String(this.level).padStart(2, "0") + " / 05";
      ui.lives.textContent = this.lives > 0 ? "♥".repeat(Math.min(5, this.lives)) +
        (this.lives > 5 ? "+" + (this.lives - 5) : "") : "0";
      ui.remaining.textContent = String(this.queue.length +
        this.tanks.filter(t => t.team === "enemy" && t.alive).length).padStart(2, "0");
      ui.best.textContent = pad(Math.max(this.bestAtStart, records[0]?.score || 0));
    }

    frame(timestamp) {
      if (!this.last) this.last = timestamp;
      const dt = Math.min((timestamp - this.last) / 1000, 0.05);
      this.last = timestamp;

      if (this.state === "playing" || this.state === "ready") {
        this.accumulator = Math.min(this.accumulator + dt, .15);
        let loops = 0;
        while (this.accumulator >= STEP && loops++ < 20) {
          this.update(STEP);
          this.accumulator -= STEP;
        }
      } else {
        this.accumulator = 0;
      }

      this.render();
      requestAnimationFrame(t => this.frame(t));
    }

    update(dt) {
      this.time += dt;

      if (this.state === "ready") {
        this.transition -= dt;
        if (this.transition <= 0) {
          this.state = "playing";
          this.show(null);
        }
        return;
      }

      if (this.ending) {
        this.transition -= dt;
        this.updateParticles(dt);
        if (this.transition <= 0) this.finish();
        return;
      }

      this.freeze = Math.max(0, this.freeze - dt);
      this.baseArmor = Math.max(0, this.baseArmor - dt);
      this.shake = Math.max(0, this.shake - dt * 12);

      this.updatePlayer(dt);
      this.updateEnemies(dt);
      this.updateBullets(dt);
      this.updateBonuses(dt);
      this.updateParticles(dt);

      this.tanks = this.tanks.filter(t => t.alive);

      this.spawnTimer -= dt;
      const active = this.tanks.filter(t => t.team === "enemy").length;
      if (this.queue.length && active < Math.min(4, 2 + Math.floor(this.level / 2)) &&
          this.spawnTimer <= 0) {
        if (this.spawnEnemy()) this.spawnTimer = Math.max(.65, 1.65 - this.level * .12);
        else this.spawnTimer = .35;
      }

      if (!this.queue.length && !this.tanks.some(t => t.team === "enemy") && !this.ending) {
        this.score += 500;
        this.updateHUD();
        audio.play("win");
        if (this.level === LEVELS.length) {
          this.end(true);
        } else {
          this.ending = "next";
          this.transition = 1.7;
        }
      }
    }

    tileAt(x, y) {
      if (x < 0 || y < 0 || x >= GRID || y >= GRID) return T.STEEL;
      return this.map[y][x];
    }

    terrain(x, y) {
      return this.tileAt(Math.floor(x / TILE), Math.floor(y / TILE));
    }

    blocked(x, y, tank) {
      const rect = { x: x - 17, y: y - 17, w: 34, h: 34 };
      if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > SIZE ||
          rect.y + rect.h > SIZE) return true;

      const minX = Math.floor(rect.x / TILE);
      const maxX = Math.floor((rect.x + rect.w - .01) / TILE);
      const minY = Math.floor(rect.y / TILE);
      const maxY = Math.floor((rect.y + rect.h - .01) / TILE);

      for (let ty = minY; ty <= maxY; ty++) {
        for (let tx = minX; tx <= maxX; tx++) {
          const tile = this.tileAt(tx, ty);
          if ([T.BRICK, T.STEEL, T.WATER, T.BASE].includes(tile)) return true;
        }
      }

      for (const other of this.tanks) {
        if (other === tank || !other.alive) continue;
        if (intersects(rect, box(other))) return true;
      }
      return false;
    }

    move(tank, dx, dy) {
      let moved = false;
      if (dx && !this.blocked(tank.x + dx, tank.y, tank)) {
        tank.x += dx;
        moved = true;
      }
      if (dy && !this.blocked(tank.x, tank.y + dy, tank)) {
        tank.y += dy;
        moved = true;
      }
      if (moved) tank.track += Math.abs(dx) + Math.abs(dy);
      return moved;
    }

    updatePlayer(dt) {
      const p = this.player;
      if (!p?.alive) return;
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.spawn = Math.max(0, p.spawn - dt);
      p.invulnerable = Math.max(0, p.invulnerable - dt);
      p.recoil = Math.max(0, p.recoil - dt * 6);
      p.flash = Math.max(0, p.flash - dt);

      let direction = -1;
      if (input.active("up")) direction = 0;
      else if (input.active("right")) direction = 1;
      else if (input.active("down")) direction = 2;
      else if (input.active("left")) direction = 3;

      const ice = this.terrain(p.x, p.y) === T.ICE;
      const rate = ice ? 3.8 : 22;

      const vx = direction >= 0 ? DIR[direction].x * p.speed : 0;
      const vy = direction >= 0 ? DIR[direction].y * p.speed : 0;

      if (direction >= 0) p.dir = direction;

      p.slipX += (vx - p.slipX) * Math.min(1, rate * dt);
      p.slipY += (vy - p.slipY) * Math.min(1, rate * dt);

      if (!this.move(p, p.slipX * dt, p.slipY * dt)) {
        p.slipX = 0; p.slipY = 0;
      }

      if (input.active("fire")) this.fire(p);
    }

    spawnEnemy() {
      const spots = [0, 6, 12].sort(() => Math.random() - .5);
      for (const col of spots) {
        const x = (col + .5) * TILE, y = TILE * .5;
        if (this.blocked(x, y, null)) continue;
        const type = this.queue.shift();
        const tank = new Tank(x, y, "enemy", type);
        this.tanks.push(tank);
        return true;
      }
      return false;
    }

    chooseDirection(tank) {
      const dirs = [0, 1, 2, 3];
      const target = Math.random() < (.25 + this.level * .055)
        ? this.player : { x: 6.5 * TILE, y: 12.5 * TILE };

      const dx = target.x - tank.x;
      const dy = target.y - tank.y;
      const toward = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);

      const options = Math.random() < .67
        ? [toward, ...dirs.sort(() => Math.random() - .5)]
        : dirs.sort(() => Math.random() - .5);

      for (const dir of options) {
        const d = DIR[dir];
        if (!this.blocked(tank.x + d.x * 7, tank.y + d.y * 7, tank))
          return dir;
      }
      return (tank.dir + 2) % 4;
    }

    updateEnemies(dt) {
      for (const t of this.tanks) {
        if (!t.alive || t.team !== "enemy") continue;
        t.spawn = Math.max(0, t.spawn - dt);
        t.recoil = Math.max(0, t.recoil - dt * 6);
        t.flash = Math.max(0, t.flash - dt);
        t.cooldown = Math.max(0, t.cooldown - dt);

        if (this.freeze > 0 || t.spawn > 0) continue;

        t.aiTime -= dt;
        if (t.aiTime <= 0 || t.stuck > .22) {
          t.dir = this.chooseDirection(t);
          t.aiTime = rand(.45, 1.5);
          t.stuck = 0;
        }

        const d = DIR[t.dir];
        const speed = t.speed * (1 + (this.level - 1) * .035);
        const moved = this.move(t, d.x * speed * dt, d.y * speed * dt);
        if (!moved) t.stuck += dt;
        else t.stuck = 0;

        const player = this.player;
        const aligned = player?.alive &&
          ((Math.abs(t.x - player.x) < 25 && (t.dir === 0 || t.dir === 2)) ||
           (Math.abs(t.y - player.y) < 25 && (t.dir === 1 || t.dir === 3)));

        if (t.cooldown <= 0 && (aligned || Math.random() < dt * .95)) {
          this.fire(t);
        }
      }
    }

    fire(tank) {
      if (!tank.alive || tank.cooldown > 0 || tank.spawn > .25) return;

      const own = this.bullets.filter(b => b.alive && b.owner === tank).length;
      const limit = tank.team === "player" ? (tank.weapon >= 1 ? 2 : 1) : 1;
      if (own >= limit) return;

      const d = DIR[tank.dir];
      this.bullets.push({
        x: tank.x + d.x * 24,
        y: tank.y + d.y * 24,
        vx: d.x * (tank.team === "player" ? 350 : 265),
        vy: d.y * (tank.team === "player" ? 350 : 265),
        owner: tank,
        team: tank.team,
        power: tank.team === "player" && tank.weapon >= 2 ? 2 : 1,
        alive: true
      });

      tank.cooldown = tank.team === "player"
        ? (tank.weapon >= 1 ? .19 : .33)
        : TYPES[tank.type].fire * rand(.8, 1.25);
      tank.recoil = 1;
      this.sparks(tank.x + d.x * 24, tank.y + d.y * 24, "#fff0a4", 5, 55);
      audio.play("shoot");
    }

    updateBullets(dt) {
      for (const b of this.bullets) {
        if (!b.alive) continue;
        const distance = Math.hypot(b.vx, b.vy) * dt;
        const steps = Math.max(1, Math.ceil(distance / 4));
        const sx = b.vx * dt / steps;
        const sy = b.vy * dt / steps;

        for (let i = 0; i < steps && b.alive; i++) {
          b.x += sx;
          b.y += sy;

          if (b.x < 0 || b.y < 0 || b.x >= SIZE || b.y >= SIZE) {
            b.alive = false;
            break;
          }

          const tx = Math.floor(b.x / TILE);
          const ty = Math.floor(b.y / TILE);
          const tile = this.map[ty][tx];

          if (tile === T.BASE) {
            b.alive = false;
            this.sparks(b.x, b.y, "#ffb852", 25, 140);
            this.shake = 7;
            this.end(false);
            break;
          }

          if (tile === T.BRICK || tile === T.STEEL) {
            b.alive = false;
            if (tile === T.BRICK) {
              this.map[ty][tx] = T.EMPTY;
              this.sparks(b.x, b.y, "#bc7750", 15, 110);
              audio.play("hit");
            } else if (b.power >= 2 && this.baseArmor <= 0) {
              // Улучшенный снаряд разрушает обычную сталь.
              this.map[ty][tx] = T.EMPTY;
              this.sparks(b.x, b.y, "#b5c9db", 17, 120);
              audio.play("hit");
            } else {
              this.sparks(b.x, b.y, "#e1edff", 7, 65);
              audio.play("hit");
            }
            break;
          }

          for (const tank of this.tanks) {
            if (!tank.alive || tank.team === b.team || tank.spawn > 0) continue;
            if (Math.abs(b.x - tank.x) < 19 && Math.abs(b.y - tank.y) < 19) {
              b.alive = false;
              this.damage(tank, b.power);
              break;
            }
          }

          if (!b.alive) break;

          for (const other of this.bullets) {
            if (other === b || !other.alive || other.team === b.team) continue;
            if (Math.abs(b.x - other.x) < 7 && Math.abs(b.y - other.y) < 7) {
              b.alive = false;
              other.alive = false;
              this.sparks(b.x, b.y, "#ffffff", 7, 65);
              break;
            }
          }
        }
      }
      this.bullets = this.bullets.filter(b => b.alive);
    }

    damage(tank, amount) {
      if (!tank.alive || tank.invulnerable > 0) {
        if (tank.alive) this.sparks(tank.x, tank.y, "#80e5ff", 9, 85);
        return;
      }

      tank.hp -= amount;
      tank.flash = .18;

      if (tank.hp > 0) {
        this.sparks(tank.x, tank.y, "#d8e4f7", 13, 90);
        audio.play("hit");
        return;
      }

      tank.alive = false;
      this.sparks(tank.x, tank.y, "#ffb45a", 36, 170);
      this.shake = Math.max(this.shake, 4);
      audio.play("destroy");

      if (tank.team === "player") {
        this.lives--;
        audio.play("lose");
        if (this.lives <= 0) {
          this.end(false);
        } else {
          this.respawnPlayer();
        }
      } else {
        this.score += TYPES[tank.type].score;
        this.kills++;
        if (Math.random() < .12 && this.bonuses.length < 2) this.spawnBonus();
      }
      this.updateHUD();
    }

    respawnPlayer() {
      const spots = [
        [4.5, 12.5], [8.5, 12.5],
        [3.5, 11.5], [9.5, 11.5]
      ];

      // Удаляем вражеские танки, стоящие прямо на точке возрождения.
      const spot = spots.find(([x, y]) =>
        !this.blocked(x * TILE, y * TILE, this.player)
      );

      if (!spot) {
        for (const t of this.tanks) {
          if (t.team === "enemy" && t.y > 9 * TILE) {
            t.alive = false;
            this.sparks(t.x, t.y, "#ffb45a", 15, 100);
          }
        }
      }

      const [sx, sy] = spot || spots[0];
      this.player = new Tank(sx * TILE, sy * TILE, "player");
      this.tanks.push(this.player);
    }

    spawnBonus() {
      const free = [];
      for (let y = 2; y < 11; y++) {
        for (let x = 0; x < GRID; x++) {
          const tile = this.map[y][x];
          if ([T.EMPTY, T.FOREST, T.ICE].includes(tile)) free.push([x, y]);
        }
      }
      if (!free.length) return;
      const [x, y] = pick(free);
      this.bonuses.push({
        x: (x + .5) * TILE,
        y: (y + .5) * TILE,
        type: pick(BONUS_TYPES),
        life: 11
      });
    }

    updateBonuses(dt) {
      this.bonusTimer -= dt;
      if (this.bonusTimer <= 0) {
        if (this.bonuses.length < 2) this.spawnBonus();
        this.bonusTimer = rand(11, 17);
      }

      for (const b of this.bonuses) {
        b.life -= dt;
        if (this.player?.alive &&
            Math.abs(this.player.x - b.x) < 30 &&
            Math.abs(this.player.y - b.y) < 30) {
          b.life = 0;
          this.applyBonus(b.type);
          this.sparks(b.x, b.y, "#ffdf78", 24, 125);
          audio.play("bonus");
        }
      }
      this.bonuses = this.bonuses.filter(b => b.life > 0);
    }

    applyBonus(type) {
      switch (type) {
        case "star":
          this.player.weapon = Math.min(2, this.player.weapon + 1);
          break;
        case "shield":
          this.player.invulnerable = Math.max(this.player.invulnerable, 12);
          break;
        case "clock":
          this.freeze = 9;
          break;
        case "grenade":
          for (const t of this.tanks) {
            if (t.team === "enemy" && t.alive) {
              t.invulnerable = 0;
              this.damage(t, 99);
            }
          }
          break;
        case "life":
          this.lives++;
          break;
        case "shovel":
          this.baseArmor = 14;
          break;
      }
      this.updateHUD();
    }

    sparks(x, y, color, count, speed) {
      for (let i = 0; i < count; i++) {
        const a = rand(0, Math.PI * 2);
        const s = rand(speed * .2, speed);
        const life = rand(.18, .65);
        this.particles.push({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life, maxLife: life, size: rand(2, 6), color
        });
      }
      if (this.particles.length > 450) this.particles.splice(0, this.particles.length - 450);
    }

    updateParticles(dt) {
      for (const p of this.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - Math.min(.9, dt * 2.4);
        p.vy *= 1 - Math.min(.9, dt * 2.4);
        p.life -= dt;
      }
      this.particles = this.particles.filter(p => p.life > 0);
    }

    end(victory) {
      if (this.ending) return;
      this.ending = victory ? "win" : "lose";
      this.transition = victory ? 1.4 : .85;
      if (!victory) audio.play("lose");
    }

    finish() {
      if (this.ending === "next") {
        this.level++;
        this.ending = false;
        this.loadLevel();
        return;
      }

      const victory = this.ending === "win";
      this.state = "over";
      this.ending = false;
      input.clear();

      $("resultTitle").textContent = victory ? "ПОБЕДА!" : "ИГРА ОКОНЧЕНА";
      $("finalScore").textContent = this.score.toLocaleString("ru-RU");
      $("finalKills").textContent = this.kills;
      $("finalLevel").textContent = this.level;

      const qualifies = this.score > 0 &&
        (records.length < 10 || this.score > records[records.length - 1].score);
      $("nameEntry").classList.toggle("hidden", !qualifies);
      $("newRecord").classList.toggle("hidden", !(this.score > this.bestAtStart));
      $("playerName").value = "";
      this.savedResult = false;
      this.show("resultPanel");
    }

    saveRecord() {
      if (this.savedResult) return;
      const name = $("playerName").value.trim().slice(0, 16) || "ИГРОК";
      records.push({
        name, score: this.score, level: this.level,
        kills: this.kills, date: new Date().toISOString()
      });
      records = cleanRecords(records);
      const ok = persist();
      this.savedResult = true;
      $("nameEntry").classList.add("hidden");
      if (!ok) {
        $("newRecord").textContent = "РЕКОРД СОХРАНЁН ТОЛЬКО ДО ЗАКРЫТИЯ СТРАНИЦЫ";
        $("newRecord").classList.remove("hidden");
      }
      this.updateHUD();
    }

    drawTile(type, x, y, col, row) {
      if (type === T.EMPTY) return;

      if (type === T.BRICK) {
        ctx.fillStyle = "#713d34";
        ctx.fillRect(x, y, TILE, TILE);
        for (let i = 0; i < 4; i++) {
          const yy = y + i * 12;
          const offset = i % 2 ? 0 : 12;
          ctx.fillStyle = "#c07853";
          ctx.fillRect(x + 1, yy + 1, 46, 10);
          ctx.fillStyle = "#dc9467";
          ctx.fillRect(x + 2, yy + 1, 43, 2);
          ctx.fillStyle = "#6b382f";
          for (let j = -1; j < 3; j++) {
            const xx = x + j * 24 + offset;
            if (xx > x && xx < x + 48) ctx.fillRect(xx, yy, 2, 12);
          }
        }
      } else if (type === T.STEEL) {
        ctx.fillStyle = "#64798d";
        ctx.fillRect(x, y, 48, 48);
        ctx.fillStyle = "#b6c8d7";
        ctx.fillRect(x + 3, y + 3, 42, 5);
        ctx.fillRect(x + 3, y + 3, 5, 42);
        ctx.fillStyle = "#364858";
        ctx.fillRect(x + 7, y + 40, 38, 5);
        ctx.fillRect(x + 40, y + 7, 5, 38);
        ctx.fillStyle = "#dce5ec";
        for (const [dx, dy] of [[9, 9], [37, 9], [9, 37], [37, 37]]) {
          ctx.fillRect(x + dx, y + dy, 4, 4);
        }
        ctx.strokeStyle = "#465768";
        ctx.strokeRect(x + 14, y + 14, 20, 20);
      } else if (type === T.WATER) {
        ctx.fillStyle = "#205187";
        ctx.fillRect(x, y, 48, 48);
        ctx.fillStyle = "#367ec1";
        for (let i = 0; i < 4; i++) {
          const wave = (this.time * 17 + i * 13 + col * 7) % 55;
          ctx.fillRect(x + wave - 15, y + 7 + i * 12, 23, 4);
        }
        ctx.fillStyle = "#6fb6e0";
        ctx.fillRect(x + 7, y + 17, 14, 3);
      } else if (type === T.ICE) {
        ctx.fillStyle = "#7db5c8";
        ctx.fillRect(x, y, 48, 48);
        ctx.fillStyle = "#b8e0e7";
        ctx.fillRect(x + 5, y + 6, 31, 3);
        ctx.fillRect(x + 12, y + 11, 3, 20);
        ctx.fillRect(x + 26, y + 22, 17, 3);
        ctx.fillStyle = "#4c91ab";
        ctx.fillRect(x + 4, y + 40, 30, 3);
      } else if (type === T.BASE) {
        ctx.fillStyle = "#343332";
        ctx.fillRect(x, y, 48, 48);
        ctx.fillStyle = "#b9a47b";
        ctx.fillRect(x + 7, y + 7, 34, 34);
        ctx.fillStyle = "#292d31";
        ctx.fillRect(x + 11, y + 11, 26, 26);
        ctx.fillStyle = "#e5c879";
        ctx.beginPath();
        ctx.moveTo(x + 24, y + 12);
        ctx.lineTo(x + 30, y + 22);
        ctx.lineTo(x + 38, y + 19);
        ctx.lineTo(x + 31, y + 29);
        ctx.lineTo(x + 24, y + 35);
        ctx.lineTo(x + 17, y + 29);
        ctx.lineTo(x + 10, y + 19);
        ctx.lineTo(x + 18, y + 22);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#fff0b0";
        ctx.fillRect(x + 22, y + 17, 4, 5);
      }
    }

    drawForest(x, y, col, row) {
      ctx.fillStyle = "#173b2c";
      ctx.fillRect(x + 3, y + 7, 42, 35);
      const points = [
        [7, 7], [23, 3], [35, 11],
        [3, 24], [19, 19], [34, 29], [14, 36]
      ];
      for (let i = 0; i < points.length; i++) {
        const [px, py] = points[i];
        ctx.fillStyle = (i + col + row) % 2 ? "#2b7650" : "#388e5a";
        ctx.fillRect(x + px, y + py, 15, 13);
        ctx.fillStyle = "#53a76c";
        ctx.fillRect(x + px + 3, y + py + 2, 6, 3);
      }
    }

    drawTank(t) {
      if (!t.alive) return;
      if (t.spawn > 0 && Math.floor(this.time * 10) % 2) return;
      if (t.team === "player" && t.invulnerable > 0 &&
          Math.floor(this.time * 12) % 2) return;

      ctx.save();
      ctx.translate(Math.round(t.x), Math.round(t.y));
      ctx.rotate(t.dir * Math.PI / 2);

      const color = t.team === "player" ? "#f2c34f" : TYPES[t.type].color;
      const dark = t.team === "player" ? "#a5782d" : "#694d55";

      ctx.fillStyle = "#0b1016";
      ctx.fillRect(-18, -19, 36, 38);

      // Гусеницы.
      ctx.fillStyle = "#343b45";
      ctx.fillRect(-19, -18, 9, 36);
      ctx.fillRect(10, -18, 9, 36);

      const trackOffset = Math.floor(t.track / 7) % 2;
      ctx.fillStyle = "#9a9d9a";
      for (let i = 0; i < 5; i++) {
        const yy = -16 + i * 8 + trackOffset * 3;
        if (yy < 17) {
          ctx.fillRect(-18, yy, 7, 3);
          ctx.fillRect(11, yy, 7, 3);
        }
      }

      ctx.fillStyle = dark;
      ctx.fillRect(-11, -15, 22, 30);
      ctx.fillStyle = color;
      ctx.fillRect(-9, -13, 18, 26);
      ctx.fillRect(-14, -9, 28, 18);

      // Ствол и отдача.
      ctx.fillStyle = "#26313a";
      ctx.fillRect(-5, -27 + t.recoil * 5, 10, 23);
      ctx.fillStyle = "#d7dfdd";
      ctx.fillRect(-3, -26 + t.recoil * 5, 6, 18);

      ctx.fillStyle = t.flash > 0 ? "#ffffff" : color;
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = "#28313b";
      ctx.fillRect(-5, -5, 10, 10);
      ctx.fillStyle = "#f4e6b6";
      ctx.fillRect(-2, -2, 4, 4);

      if (t.team === "enemy" && t.type === "armor") {
        ctx.fillStyle = "#e5edf3";
        ctx.fillRect(-11, 10, 7, 4);
        ctx.fillRect(4, 10, 7, 4);
      }
      if (t.team === "enemy" && t.type === "elite") {
        ctx.fillStyle = "#e6b9ff";
        ctx.fillRect(-8, -11, 16, 3);
      }
      if (t.team === "player" && t.weapon > 0) {
        ctx.fillStyle = "#fff7a6";
        ctx.fillRect(-3, 10, 6, 4);
      }
      ctx.restore();

      if (t.invulnerable > 0) {
        ctx.strokeStyle = "#75dcff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 25 + Math.sin(this.time * 8) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (t.spawn > 0) {
        ctx.strokeStyle = "#fff0a0";
        ctx.lineWidth = 2;
        const r = 25 + Math.sin(this.time * 13) * 5;
        ctx.strokeRect(t.x - r, t.y - r, r * 2, r * 2);
      }
    }

    drawBonus(b) {
      const symbols = {
        star: "★", shield: "◇", clock: "◷",
        grenade: "✹", life: "♥", shovel: "▣"
      };
      const colors = {
        star: "#ffdf67", shield: "#8cddff", clock: "#d2a3ff",
        grenade: "#ff8c79", life: "#ff7694", shovel: "#a5f1b3"
      };

      const pulse = Math.sin(this.time * 6) * 2;
      ctx.fillStyle = "#121b27";
      ctx.fillRect(b.x - 17 - pulse, b.y - 17 - pulse, 34 + pulse * 2, 34 + pulse * 2);
      ctx.strokeStyle = colors[b.type];
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x - 16, b.y - 16, 32, 32);
      ctx.fillStyle = colors[b.type];
      ctx.font = "bold 27px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(symbols[b.type], b.x, b.y + 1);
    }

    render() {
      ctx.save();
      ctx.fillStyle = "#101419";
      ctx.fillRect(0, 0, SIZE, SIZE);

      if (this.shake > 0) {
        ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
      }

      // Сетка и фактура поля.
      ctx.fillStyle = "#171c22";
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          if ((x + y) % 2 === 0) ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
      }

      for (let y = 0; y < this.map.length; y++) {
        for (let x = 0; x < this.map[y].length; x++) {
          const tile = this.map[y][x];
          if (tile !== T.FOREST) this.drawTile(tile, x * TILE, y * TILE, x, y);
        }
      }

      // Лопата укрепляет стены базы.
      if (this.baseArmor > 0) {
        ctx.fillStyle = "#9daebf";
        for (const [x, y] of [[5, 11], [7, 11], [5, 12], [7, 12]]) {
          ctx.fillRect(x * TILE + 2, y * TILE + 2, 44, 44);
          ctx.fillStyle = "#d5e4ef";
          ctx.fillRect(x * TILE + 6, y * TILE + 6, 36, 5);
          ctx.fillStyle = "#9daebf";
        }
      }

      for (const b of this.bonuses) this.drawBonus(b);
      for (const t of this.tanks) this.drawTank(t);

      // Лес рисуется поверх танков.
      for (let y = 0; y < this.map.length; y++) {
        for (let x = 0; x < this.map[y].length; x++) {
          if (this.map[y][x] === T.FOREST) this.drawForest(x * TILE, y * TILE, x, y);
        }
      }

      for (const b of this.bullets) {
        ctx.fillStyle = b.team === "player" ? "#fff4a0" : "#ff9a8c";
        ctx.fillRect(Math.round(b.x) - 4, Math.round(b.y) - 4, 8, 8);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 2, 4, 4);
      }

      for (const p of this.particles) {
        ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
      ctx.globalAlpha = 1;

      if (this.freeze > 0) {
        ctx.fillStyle = "#78b8ff";
        ctx.font = "bold 15px monospace";
        ctx.textAlign = "left";
        ctx.fillText("◷ " + Math.ceil(this.freeze), 10, 21);
      }

      ctx.restore();
    }
  }

  new Game();
})();
