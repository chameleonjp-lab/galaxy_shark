const { open } = require('../../docs/playtest/tools/common.js');
(async () => {
  const { browser, page, logs } = await open({ viewport: { width: 1200, height: 630 }, query: '?debug=1&lang=ja' });
  await page.waitForTimeout(600);
  await page.click('#play-btn'); await page.waitForTimeout(3500);
  await page.addStyleTag({ content: 'body > *:not(#gl-canvas){visibility:hidden!important} #gl-canvas{visibility:visible!important}' });
  const shot = async (n) => { await page.waitForTimeout(1500); await page.screenshot({ path: n + '.png' }); };
  await shot('p1');
  for (const ph of [2, 4]) {
    await page.evaluate((ph) => { const g = window.__galaxyShark; let k = 0; while (g.shark.phase < ph && k++ < 40) g.debugGrowthJump(); g.interludeTimer = 0; }, ph);
    await page.waitForTimeout(2500);
    await shot('p' + ph);
  }
  console.log(logs.slice(0,5).join('\n'));
  await browser.close();
})();
