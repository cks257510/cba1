import { BATTLE_NUMBERS } from './battleNumbers.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const now = () => Date.now();

export class BattleRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.inputs = new Map();
    this.loop = null;
    this.lastTickAt = now();
    this.lastSnapshotAt = 0;
    this.battle = this.createBattleState('control');
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const url = new URL(request.url);
    const playerId = url.searchParams.get('playerId') || crypto.randomUUID();

    server.accept();
    this.sessions.set(playerId, server);
    this.inputs.set(playerId, { moveX: 0, moveY: 0, blink: false, skill1: false });

    server.addEventListener('message', (event) => this.onMessage(playerId, event.data));
    server.addEventListener('close', () => this.removeSession(playerId));
    server.addEventListener('error', () => this.removeSession(playerId));

    this.send(server, { type: 'joined', playerId, battle: this.battle });
    this.broadcast({ type: 'presence', players: [...this.sessions.keys()] });

    if (!this.loop) this.startLoop();

    return new Response(null, { status: 101, webSocket: client });
  }

  onMessage(playerId, raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'start') {
      this.battle = this.createBattleState(msg.mode || 'control');
      this.broadcast({ type: 'battleStarted', mode: this.battle.mode, startedAt: this.battle.startedAt });
      return;
    }

    if (msg.type === 'input') {
      this.inputs.set(playerId, {
        moveX: clamp(Number(msg.input?.moveX || 0), -1, 1),
        moveY: clamp(Number(msg.input?.moveY || 0), -1, 1),
        blink: !!msg.input?.blink,
        skill1: !!msg.input?.skill1,
      });
    }
  }

  createBattleState(mode) {
    return {
      mode,
      tick: 0,
      startedAt: now(),
      finished: false,
      winner: null,
      arena: { width: 960, height: 540 },
      players: {
        p1: this.createUnit('p1', 180, 270, 'friend'),
        p2: this.createUnit('p2', 780, 270, 'enemy'),
      },
      projectiles: [],
      events: [],
    };
  }

  createUnit(id, x, y, team) {
    return {
      id,
      team,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: BATTLE_NUMBERS.baseCharacterRadius,
      level: BATTLE_NUMBERS.startLevel,
      hp: 1000,
      maxHp: 1000,
      attack: 100,
      speed: 3.2,
      skillGauge: 0,
      ultimateGauge: 0,
      lastAttackAt: 0,
      lastProjectileAt: 0,
      lastBlinkAt: 0,
      lastSkill1At: 0,
      lastUltimateAt: 0,
    };
  }

  startLoop() {
    this.loop = setInterval(() => this.tick(), BATTLE_NUMBERS.tickMs);
  }

  tick() {
    if (this.battle.finished) return;
    const t = now();
    const dt = Math.min(0.08, (t - this.lastTickAt) / 1000);
    this.lastTickAt = t;
    this.battle.tick += 1;
    this.battle.events = [];

    this.updateLevels(t);
    this.updatePlayers(t, dt);
    this.updateProjectiles(dt);
    this.resolveDamage(t);
    this.checkVictory(t);

    if (t - this.lastSnapshotAt >= BATTLE_NUMBERS.snapshotMs) {
      this.lastSnapshotAt = t;
      this.broadcast({ type: 'snapshot', ...this.battle });
    }
  }

  updateLevels(t) {
    const elapsed = (t - this.battle.startedAt) / 1000;
    const level = clamp(Math.floor(elapsed / BATTLE_NUMBERS.levelUpEverySeconds) + 1, 1, BATTLE_NUMBERS.maxLevel);
    Object.values(this.battle.players).forEach((unit) => {
      if (unit.level !== level) {
        unit.level = level;
        unit.maxHp = Math.round(1000 * (1 + (level - 1) * 0.03));
        unit.attack = Math.round(100 * (1 + (level - 1) * 0.025));
        unit.hp = clamp(unit.hp + 30, 0, unit.maxHp);
        this.battle.events.push({ type: 'levelUp', unitId: unit.id, level });
      }
    });
  }

  updatePlayers(t, dt) {
    const ids = Object.keys(this.battle.players);
    ids.forEach((id, idx) => {
      const unit = this.battle.players[id];
      const input = this.inputs.get(id) || this.inputs.get([...this.inputs.keys()][idx]) || { moveX: 0, moveY: 0 };
      const length = Math.hypot(input.moveX, input.moveY) || 1;
      const mx = input.moveX / length;
      const my = input.moveY / length;

      unit.x += mx * unit.speed * 60 * dt;
      unit.y += my * unit.speed * 60 * dt;
      unit.x = clamp(unit.x, unit.radius, this.battle.arena.width - unit.radius);
      unit.y = clamp(unit.y, unit.radius, this.battle.arena.height - unit.radius);

      unit.skillGauge = clamp(unit.skillGauge + 11 * dt, 0, 100);
      unit.ultimateGauge = clamp(unit.ultimateGauge + 5 * dt, 0, 100);

      if (input.blink && t - unit.lastBlinkAt >= BATTLE_NUMBERS.blinkCooldownMs) {
        unit.x = clamp(unit.x + mx * BATTLE_NUMBERS.blinkDistance, unit.radius, this.battle.arena.width - unit.radius);
        unit.y = clamp(unit.y + my * BATTLE_NUMBERS.blinkDistance, unit.radius, this.battle.arena.height - unit.radius);
        unit.lastBlinkAt = t;
        this.battle.events.push({ type: 'blink', unitId: unit.id, x: unit.x, y: unit.y });
      }

      if (t - unit.lastProjectileAt >= BATTLE_NUMBERS.rangedAutoFireIntervalMs) {
        this.spawnProjectile(unit, mx || (unit.team === 'friend' ? 1 : -1), my || 0);
        unit.lastProjectileAt = t;
      }

      if (unit.ultimateGauge >= 100 && t - unit.lastUltimateAt >= BATTLE_NUMBERS.ultimateCooldownMs) {
        unit.ultimateGauge = 0;
        unit.lastUltimateAt = t;
        this.battle.events.push({ type: 'ultimate', unitId: unit.id });
        for (let i = 0; i < 5; i++) {
          const angle = (Math.PI * 2 * i) / 5;
          this.spawnProjectile(unit, Math.cos(angle), Math.sin(angle), true);
        }
      }
    });
  }

  spawnProjectile(owner, dx, dy, ultimate = false) {
    const len = Math.hypot(dx, dy) || 1;
    this.battle.projectiles.push({
      id: crypto.randomUUID(),
      ownerId: owner.id,
      team: owner.team,
      x: owner.x,
      y: owner.y,
      vx: (dx / len) * (ultimate ? 11 : BATTLE_NUMBERS.projectileBaseSpeed),
      vy: (dy / len) * (ultimate ? 11 : BATTLE_NUMBERS.projectileBaseSpeed),
      radius: BATTLE_NUMBERS.projectileRadius,
      damage: ultimate ? Math.round(owner.attack * 1.15) : Math.round(owner.attack * 0.62),
      lifeMs: ultimate ? 3200 : 2200,
      bornAt: now(),
      bouncesLeft: 2,
    });
    this.battle.events.push({ type: 'projectile', ownerId: owner.id, ultimate });
  }

  updateProjectiles(dt) {
    const t = now();
    this.battle.projectiles.forEach((p) => {
      p.x += p.vx * 60 * dt;
      p.y += p.vy * 60 * dt;
      if ((p.x <= p.radius || p.x >= this.battle.arena.width - p.radius) && p.bouncesLeft > 0) {
        p.vx *= -1;
        p.bouncesLeft -= 1;
      }
      if ((p.y <= p.radius || p.y >= this.battle.arena.height - p.radius) && p.bouncesLeft > 0) {
        p.vy *= -1;
        p.bouncesLeft -= 1;
      }
    });
    this.battle.projectiles = this.battle.projectiles.filter((p) => t - p.bornAt <= p.lifeMs && p.bouncesLeft >= 0);
  }

  resolveDamage(t) {
    const units = Object.values(this.battle.players);
    for (const p of [...this.battle.projectiles]) {
      for (const unit of units) {
        if (unit.team === p.team) continue;
        const hit = Math.hypot(unit.x - p.x, unit.y - p.y) <= unit.radius + p.radius;
        if (hit) {
          unit.hp = clamp(unit.hp - p.damage, 0, unit.maxHp);
          p.lifeMs = 0;
          this.battle.events.push({ type: 'hit', targetId: unit.id, damage: p.damage, hp: unit.hp });
        }
      }
    }

    const [a, b] = units;
    if (Math.hypot(a.x - b.x, a.y - b.y) <= a.radius + b.radius) {
      [a, b].forEach((attacker) => {
        const target = attacker.id === a.id ? b : a;
        if (t - attacker.lastAttackAt >= BATTLE_NUMBERS.meleeContactDamageIntervalMs) {
          const damage = Math.round(attacker.attack * 0.55);
          target.hp = clamp(target.hp - damage, 0, target.maxHp);
          attacker.lastAttackAt = t;
          this.battle.events.push({ type: 'meleeHit', attackerId: attacker.id, targetId: target.id, damage });
        }
      });
    }
  }

  checkVictory(t) {
    const p1 = this.battle.players.p1;
    const p2 = this.battle.players.p2;
    const elapsed = (t - this.battle.startedAt) / 1000;
    if (p1.hp <= 0 || p2.hp <= 0 || elapsed >= BATTLE_NUMBERS.controlTimeLimitSeconds) {
      this.battle.finished = true;
      this.battle.winner = p1.hp === p2.hp ? 'draw' : (p1.hp > p2.hp ? 'p1' : 'p2');
      this.broadcast({ type: 'battleEnd', winner: this.battle.winner, p1Hp: p1.hp, p2Hp: p2.hp });
    }
  }

  send(socket, data) {
    try {
      socket.send(JSON.stringify(data));
    } catch {}
  }

  broadcast(data) {
    const payload = JSON.stringify(data);
    for (const socket of this.sessions.values()) {
      try { socket.send(payload); } catch {}
    }
  }

  removeSession(playerId) {
    this.sessions.delete(playerId);
    this.inputs.delete(playerId);
    this.broadcast({ type: 'presence', players: [...this.sessions.keys()] });
    if (this.sessions.size === 0 && this.loop) {
      clearInterval(this.loop);
      this.loop = null;
    }
  }
}
