const { open } = require('./common');
// policy: 'spam' (steer+bite spam), 'smart' (bite only near target), 'nobite' (steer only), 'idle' (no input)
const policy = process.argv[2] || 'spam';
const maxGameSec = +(process.argv[3] || 1500);
const evoPref = process.argv[4] || 'DESTROYER,MUTANT,SWIFT';
const seed = +(process.argv[5] || 1);
(async () => {
  const { browser, page, logs } = await open();
  await page.evaluate((seed) => {
    // deterministic RNG + virtual clock
    let s = seed >>> 0; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    window.__fakeNow = performance.now();
    const realNow = performance.now.bind(performance);
    performance.now = () => window.__fakeNow;
    window.requestAnimationFrame = () => 0;
    window.__GW = +("" || 1);
  }, seed);
  await page.click('#play-btn');
  const result = await page.evaluate(async ({ policy, maxGameSec, evoPref }) => {
    const g = window.__galaxyShark;
    g.renderer.render = (sc) => { sc.updateMatrixWorld(); };
    const log = []; const ev = (t, msg) => log.push(`${t.toFixed(1)}s ${msg}`);
    const dmgLog = [];
    const origDmg = g.damageShark.bind(g);
    g.damageShark = (amt) => { const before = g.shark.hp; origDmg(amt); const lost = before - g.shark.hp; if (lost > 0) dmgLog.push({ t: g.stats.elapsedSec, lost, boss: !!g.boss, phase: g.shark.phase, mode: g.mode, hp: g.shark.hp }); };
    let lastStage = 1, lastPhase = 1, bossT = null, minHp = 100, lastBite = -1;
    const stageTimes = {}; const bossInfo = []; let modalDamage = 0;
    const prefs = evoPref.split(',');
    let frames = 0; let goldenSeen = 0, goldenEaten = 0; let prevGolden = false;
    const origEat = g.eatPrey.bind(g);
    const eatCounts = {};
    g.eatPrey = (p, fc) => { if (p.alive) { eatCounts[p.cfg.id] = (eatCounts[p.cfg.id] || 0) + 1; if (p.cfg.isGoldenRare) goldenEaten++; } return origEat(p, fc); };
    const origSpawn = g.spawnPrey.bind(g);
    g.spawnPrey = (fg, np) => { const n = g.preys.length; origSpawn(fg, np); if (g.preys.length > n && g.preys[g.preys.length-1].cfg.isGoldenRare) goldenSeen++; };
    const wrap = a => { while (a > Math.PI) a -= 2*Math.PI; while (a < -Math.PI) a += 2*Math.PI; return a; };
    while (g.stats.elapsedSec < maxGameSec && frames < 400000) {
      frames++;
      window.__fakeNow += 33.3;
      const t = g.stats.elapsedSec; const s = g.shark;
      // evolution handling
      if ((g.forcedEvoTutorial || (s.evolutionPoints > 0 && g.mode === 'PLAYING' && policy !== 'idle')) && g.mode === 'PLAYING') {
        g.openEvolutionModal();
      }
      if (g.mode === 'EVOLUTION_SELECT') {
        const cards = [...document.querySelectorAll('#evo-cards .evo-card')];
        let pick = null;
        for (const p of ['HYBRID', ...prefs]) { pick = cards.find(c => c.classList.contains('branch-' + p) && !c.textContent.includes('ポイント不足')); if (pick) break; }
        if (pick) { ev(t, 'EVO ' + pick.querySelector('.evo-card-name').textContent); pick.click(); }
        else g.closeEvolutionModal();
      }
      if (g.mode === 'GAME_OVER' || g.mode === 'CLEAR') break;
      if (policy !== 'idle' && g.mode === 'PLAYING') {
        // target selection
        let target = null, best = 1e9;
        const S = s.internalScale;
        if (g.boss) { target = g.boss.pos; }
        else {
          for (const p of g.preys) {
            if (!p.alive) continue;
            const ratio = p.cfg.realSizeMeters / s.realLengthMeters;
            const edible = ratio <= 0.68 || p.cfg.isGoldenRare || p.cfg.gimmick !== 'NONE' || p.hp <= 0;
            let d = p.pos.distanceTo(s.pos);
            const ang = Math.abs(wrap(Math.atan2(p.pos.x - s.pos.x, p.pos.z - s.pos.z) - s.yaw));
            d *= (1 + ang * 1.2);
            if (!edible) d *= ratio < 1.3 ? 2.5 : 6; // prefer edible
            if (p.cfg.isGoldenRare) d *= window.__GW;
            if (d < best) { best = d; target = p.pos; }
          }
        }
        if (target) {
          const dx = target.x - s.pos.x, dz = target.z - s.pos.z;
          const desired = Math.atan2(dx, dz);
          const diff = wrap(desired - s.yaw);
          const tx = Math.max(-1, Math.min(1, -diff * 2.5));
          const dy = target.y - s.pos.y;
          const hd = Math.hypot(dx, dz);
          g.touchVec = { x: tx, y: (Math.abs(diff) > 1.0 && hd < S * 8) ? -0.6 : 1, active: true };
          g.vertStick = { y: Math.max(-1, Math.min(1, dy / (S * 2))), active: true };
          const dist = Math.hypot(dx, dz, dy);
          if (policy === 'spam' && t - lastBite > 0.3) { g.performManualBite(); lastBite = t; }
          if (policy === 'smart' && dist < S * 6 && t - lastBite > 0.3) { g.performManualBite(); lastBite = t; }
        }
      }
      g.loop(window.__fakeNow);
      if (g.mode === 'EVOLUTION_SELECT' && dmgLog.length && dmgLog[dmgLog.length-1].mode === 'EVOLUTION_SELECT') {}
      minHp = Math.min(minHp, s.hp);
      if (s.stage !== lastStage) { ev(t, `STAGE ${lastStage}->${s.stage} len=${s.realLengthMeters.toExponential(2)} S=${s.internalScale.toFixed(2)} eaten=${g.stats.totalEaten}`); lastStage = s.stage; }
      if (s.phase !== lastPhase) { ev(t, `PHASE ${lastPhase}->${s.phase}`); lastPhase = s.phase; }
      if (g.boss && bossT === null) { bossT = t; ev(t, `BOSS SPAWN ${g.boss.cfg.id} len=${s.realLengthMeters.toExponential(2)} hp=${s.hp.toFixed(0)}`); }
      if (!g.boss && bossT !== null) { bossInfo.push({ dur: t - bossT }); ev(t, `BOSS DOWN after ${(t - bossT).toFixed(1)}s hp=${s.hp.toFixed(0)}`); bossT = null; }
      if (g.mode === 'CLEAR_CELEBRATION') { ev(t, 'CLEAR CELEBRATION'); for (let k=0;k<200 && g.mode==='CLEAR_CELEBRATION';k++){ window.__fakeNow += 33.3; g.loop(window.__fakeNow);} break; }
      if (g.boss && frames % 30 === 0) { const b=g.boss; const jaw=g.sharkRig.getJawWorldPos(new THREE.Vector3()); ev(t, `  boss hp=${b.hp.toFixed(0)}/${b.maxHp} dist=${jaw.distanceTo(b.pos).toFixed(1)} need<${(s.internalScale*1.08+b.internalRadius).toFixed(1)} S=${s.internalScale.toFixed(2)} sharkHp=${s.hp.toFixed(0)} proj=${g.projectiles.length} tele=${b.telegraphTimer.toFixed(2)} down=${b.downTimer.toFixed(1)} sharkY=${s.pos.y.toFixed(1)} bossY=${b.pos.y.toFixed(1)} sx=${s.pos.x.toFixed(1)} sz=${s.pos.z.toFixed(1)} bx=${b.pos.x.toFixed(1)} bz=${b.pos.z.toFixed(1)} yaw=${s.yaw.toFixed(2)} tv=${g.touchVec.x.toFixed(2)},${g.touchVec.y} vel=${s.vel.length().toFixed(1)} lunge=${s.lungeVel.length().toFixed(1)}`); }
      if (frames % 3000 === 0) ev(t, `tick len=${s.realLengthMeters.toExponential(2)} st=${s.stage} hp=${s.hp.toFixed(0)} eaten=${g.stats.totalEaten} combo=${g.stats.maxCombo} preys=${g.preys.length}`);
    }
    const res = document.getElementById('result-modal').classList.contains('active') ? {
      head: document.getElementById('result-headline').textContent, rank: document.getElementById('result-rank').textContent,
      score: document.getElementById('res-score').textContent, time: document.getElementById('res-time').textContent,
      len: document.getElementById('res-len').textContent, mass: document.getElementById('res-mass').textContent, yen: document.getElementById('res-yen').textContent, combo: document.getElementById('res-combo').textContent } : null;
    const dmgByPhase = {}; for (const d of dmgLog) { const k = `p${d.phase}${d.boss ? 'boss' : ''}${d.mode==='EVOLUTION_SELECT'?'-INMODAL':''}`; dmgByPhase[k] = (dmgByPhase[k] || 0) + d.lost; }
    return { log, res, mode: g.mode, minHp, frames, dmgByPhase, eatCounts, goldenSeen, goldenEaten, evos: [...g.shark.unlockedEvolutions], final: { len: g.shark.realLengthMeters, stage: g.shark.stage, phase: g.shark.phase, t: g.stats.elapsedSec, eaten: g.stats.totalEaten, maxCombo: g.stats.maxCombo } };
  }, { policy, maxGameSec, evoPref });
  console.log(JSON.stringify(result, null, 1));
  if (logs.length) console.log(logs.filter(l => !l.includes('GPU stall')).slice(0, 20).join('\n'));
  await browser.close();
})();
