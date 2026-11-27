const { open } = require('./common');
(async () => {
  const { browser, page } = await open();
  await page.evaluate(() => { window.__fakeNow = performance.now(); performance.now = () => window.__fakeNow; window.requestAnimationFrame = () => 0; });
  await page.click('#play-btn');
  const r = await page.evaluate(() => {
    const g = window.__galaxyShark; g.renderer.render = (sc) => sc.updateMatrixWorld();
    const step = (n = 1) => { for (let i = 0; i < n; i++) { window.__fakeNow += 33.3; g.loop(window.__fakeNow); } };
    const out = {};
    step(3);
    g.hasCompletedFirstEvo = true; g.shark.evolutionPoints = 1; g.openEvolutionModal();
    g.showResult(false); // simulate death while modal open
    document.getElementById('res-retry-btn').click(); step(3);
    out.evoModalStillOpenAfterRetry = document.getElementById('evo-modal').classList.contains('active');
    out.modeAfterRetry = g.mode; out.epAfterRetry = g.shark.evolutionPoints;
    document.querySelector('#evo-cards .evo-card').click();
    out.epAfterClickingStaleCard = g.shark.evolutionPoints; out.unlocked = [...g.shark.unlockedEvolutions];
    // 最初の進化の説明を一度終えたら、次の回では出ないか
    g.resetState(); g.mode = 'PLAYING'; g.shark.evolutionPoints = 1; step(2);
    out.forcedTutorialFirstRun = g.forcedEvoTutorial;
    g.openEvolutionModal(); document.querySelector('#evo-cards .evo-card').click(); step(1);
    document.getElementById('res-retry-btn').click(); step(2);
    g.shark.evolutionPoints = 1; step(2);
    out.forcedTutorialSecondRun = g.forcedEvoTutorial;
    g.closeEvolutionModal(); g.shark.evolutionPoints = 0;
    // golden chase test: spawn golden ahead at various S and chase full throttle + bite spam
    const res = [];
    for (const [stage, len] of [[1, 0.6], [1, 1.2], [2, 3.0], [3, 12], [4, 40]]) {
      g.resetState(); g.mode = 'PLAYING'; g.hasCompletedFirstEvo = true; g.clearEntities();
      g.shark.realLengthMeters = len; g.shark.stage = stage; g.checkProgression(false); g.shark.stage = stage;
      g.shark.yaw = 0; g.shark.pos.set(0, 0, 0);
      g.spawnPrey(true);
      const gp = g.preys[g.preys.length - 1]; gp.pos.set(0, 0, g.shark.internalScale * 12);
      let caught = -1, lastBite = 0;
      for (let f = 0; f < 900; f++) {
        if (!gp.alive) { caught = f / 30; break; }
        const s = g.shark; const dx = gp.pos.x - s.pos.x, dz = gp.pos.z - s.pos.z, dy = gp.pos.y - s.pos.y;
        let diff = Math.atan2(dx, dz) - s.yaw; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
        g.touchVec = { x: Math.max(-1, Math.min(1, -diff * 2.5)), y: 1, active: true };
        g.vertStick = { y: Math.max(-1, Math.min(1, dy / (s.internalScale * 2))), active: true };
        if (f - lastBite >= 9) { g.performManualBite(); lastBite = f; }
        g.preys = g.preys.filter(p => p === gp); // isolate
        step(1);
        if (!g.preys.includes(gp) && gp.alive) { caught = -2; break; }
      }
      res.push({ len, S: +g.shark.internalScale.toFixed(2), caughtSec: caught, endDist: +gp.pos.distanceTo(g.shark.pos).toFixed(1) });
    }
    out.goldenChase = res;
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
