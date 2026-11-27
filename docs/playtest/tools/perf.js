const { chromium } = require('playwright');
const { open } = require('./common');
(async () => {
  // A) CDN failure
  const b0 = await chromium.launch();
  const p0 = await (await b0.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; p0.on('pageerror', e => errs.push(e.message));
  await p0.route('**/three.min.js', r => r.abort());
  await p0.goto('file://' + require('path').resolve(__dirname, '../../../index.html') + '');
  await p0.waitForTimeout(1500);
  await p0.click('#play-btn').catch(e => errs.push('click:' + e.message));
  await p0.waitForTimeout(800);
  const titleStill = await p0.evaluate(() => !document.getElementById('title-screen').classList.contains('hidden'));
  await p0.screenshot({ path: 'cdn_fail.png' });
  console.log('CDN fail: errors=', errs, 'titleStillVisibleAfterPlay=', titleStill);
  await b0.close();
  // B) draw calls & sim cost per phase
  const { browser, page } = await open();
  await page.evaluate(() => { window.__fakeNow = performance.now(); const rn = performance.now.bind(performance); window.__rn = rn; performance.now = () => window.__fakeNow; window.requestAnimationFrame = () => 0; });
  await page.click('#play-btn');
  const r = await page.evaluate(() => {
    const g = window.__galaxyShark; const realRender = g.renderer.render.bind(g.renderer);
    const out = [];
    g.hasCompletedFirstEvo = true;
    for (const ph of [1, 2, 3, 4, 5]) {
      let guard = 0; while (g.shark.phase < ph && guard++ < 40) g.debugGrowthJump();
      g.forcedEvoTutorial = false; g.interludeTimer = 0; g.shark.evolutionPoints = 0;
      g.renderer.render = (sc) => sc.updateMatrixWorld();
      g.touchVec = { x: 0.2, y: 1, active: true };
      let t0 = window.__rn(); let eats0 = g.stats.totalEaten;
      for (let i = 0; i < 300; i++) { window.__fakeNow += 16.7; if (i % 20 === 0) g.performManualBite(); g.loop(window.__fakeNow); }
      const simMs = (window.__rn() - t0) / 300;
      g.renderer.render = realRender; g.renderer.info.reset(); g.renderer.info.autoReset = false;
      window.__fakeNow += 16.7; g.hitstopTimer = 0; g.loop(window.__fakeNow);
      const info = g.renderer.info; 
      out.push({ phase: ph, simMsPerFrame: +simMs.toFixed(2), eatsPer5s: g.stats.totalEaten - eats0, drawCalls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs.length, preys: g.preys.length, sceneObjects: (() => { let n = 0; g.scene.traverse(() => n++); return n; })() });
      g.renderer.info.autoReset = true;
    }
    return out;
  });
  console.table(r);
  await browser.close();
})();
