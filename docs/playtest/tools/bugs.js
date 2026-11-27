const { open } = require('./common');
(async () => {
  const { browser, page, logs } = await open();
  await page.evaluate(() => { window.__fakeNow = performance.now(); performance.now = () => window.__fakeNow; window.requestAnimationFrame = () => 0; });
  await page.click('#play-btn');
  const r = await page.evaluate(async () => {
    const g = window.__galaxyShark; g.renderer.render = (sc) => sc.updateMatrixWorld();
    const step = (n = 1) => { for (let i = 0; i < n; i++) { window.__fakeNow += 33.3; g.loop(window.__fakeNow); } };
    const out = {};
    step(5);
    // 1. Space key bite?
    const cd0 = g.shark.biteCd;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); step(1);
    out.spaceBite = { biteCdBefore: cd0, biteActiveAfter: g.shark.biteActiveTimer, note: 'biteActiveTimer>0 means Space bites' };
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    // 2. Mouse drift (desktop, sticks hidden)
    out.sticksVisible = g.sticksVisible;
    g.mouseNDC = { x: 0.6, y: 0.5, active: true };
    const yaw0 = g.shark.yaw, y0 = g.shark.pos.y; step(60);
    out.mouseDrift = { yawChange: +(g.shark.yaw - yaw0).toFixed(2), yChange: +(g.shark.pos.y - y0).toFixed(2), note: 'cursor resting right/up of center, no keys pressed, 2s' };
    g.mouseNDC.active = false;
    // 3. Damage while evolution modal open (orca strike)
    g.shark.evolutionPoints = 1; g.hasCompletedFirstEvo = true; g.forcedEvoTutorial = false;
    g.shark.invulnTimer = 0;
    g.spawnPrey(false, true);
    const orca = g.preys[g.preys.length - 1];
    orca.cfg = window.__galaxyShark.constructor ? orca.cfg : orca.cfg;
    const PREY = g.preys.map(p => p.cfg).find(c => c.id === 'orca') || null;
    // build an orca-like by cloning cfg from catalog via any prey list
    g.openEvolutionModal();
    const hp0 = g.shark.hp;
    // place a whale/orca in strike right on the shark
    const cat = (await Promise.resolve(null));
    orca.cfg = Object.assign({}, orca.cfg, { id: 'orca', ai: 'HUNTER', isHostile: true, realSizeMeters: 50, damageToShark: 15 });
    orca.pos.copy(g.shark.pos); orca.aiState = 'STRIKE'; orca.strikeTimer = 5; orca.stunTimer = 0; orca.strikeDir.set(0,0,0);
    step(30);
    out.damageInModal = { mode: g.mode, hpBefore: hp0, hpAfter: g.shark.hp };
    // 4. die while modal open
    g.shark.hp = 1; g.shark.invulnTimer = 0; orca.aiState = 'STRIKE'; orca.strikeTimer = 5; orca.pos.copy(g.shark.pos); step(20);
    out.dieInModal = { mode: g.mode, evoModalActive: document.getElementById('evo-modal').classList.contains('active'), resultActive: document.getElementById('result-modal').classList.contains('active') };
    document.getElementById('evo-modal').classList.remove('active');
    // 5. retry state leaks: set flood + phase 3 audio
    g.audio.phase = 3; g.floodPlane.visible = true; g.shark.phase = 2;
    document.getElementById('res-retry-btn').click(); step(3);
    out.retryLeaks = { audioPhase: g.audio.phase, floodPlaneVisibleInOcean: g.floodPlane.visible, sharkPhase: g.shark.phase, forcedEvoNextRun: 'see below' };
    g.shark.evolutionPoints = 1; step(2);
    out.retryLeaks.forcedEvoTutorialAgain = g.forcedEvoTutorial;
    // 6. boss cutin text
    g.forcedEvoTutorial = false; document.getElementById('forced-evo-backdrop').classList.remove('active'); document.getElementById('forced-evo-callout').classList.remove('active');
    g.hasCompletedFirstEvo = true; g.shark.evolutionPoints = 0;
    g.spawnBossForPhase(1);
    out.bossCutin = document.getElementById('cutin-main').textContent + ' / ' + document.getElementById('boss-name').textContent;
    // 7. ignore boss -> uncapped growth: simulate eating many while boss alive
    g.shark.realLengthMeters = 400; g.checkProgression(false);
    out.growWhileBoss = { len: g.shark.realLengthMeters, stage: g.shark.stage, phase: g.shark.phase, hud: document.getElementById('hud-phase').textContent };
    step(2); out.growWhileBoss.hud = document.getElementById('hud-phase').textContent; out.growWhileBoss.lenHud = document.getElementById('hud-length').textContent;
    g.damageBoss(99999); step(5);
    out.afterKillBigKraken = { phase: g.shark.phase, stage: g.shark.stage, bossNow: g.boss ? g.boss.cfg.id : null };
    // 8. formatters via result screen
    g.stats.totalMassTons = 6e21; g.stats.totalDamageYen = 3e25; g.shark.realLengthMeters = 5e12;
    g.showResult(false);
    out.formatters = { mass: document.getElementById('res-mass').textContent, yen: document.getElementById('res-yen').textContent, len: document.getElementById('res-len').textContent };
    // 9. score on game over early
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  console.log(logs.filter(l => !l.includes('GPU stall')).join('\n'));
  await browser.close();
})();
