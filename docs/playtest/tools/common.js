// テスト用の共通処理。Three.js r128 を CDN の代わりにローカルファイルから読み込みます。
// 使い方: npm pack three@0.128.0 で取得した three.min.js の場所を THREE_PATH で指定します。
//   THREE_PATH=/path/to/three.min.js node docs/playtest/tools/bot.js spam 1500
const { chromium, devices } = require('playwright');
const path = require('path');
const THREE_PATH = process.env.THREE_PATH || path.join(__dirname, 'three.min.js');
const GAME = 'file://' + path.resolve(__dirname, '../../../index.html');
async function open(opts = {}) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext(opts.device ? { ...devices[opts.device] } : { viewport: opts.viewport || { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
  await page.route('**/three.min.js', r => r.fulfill({ path: THREE_PATH, contentType: 'application/javascript' }));
  await page.goto(GAME + (opts.query || ''));
  await page.waitForFunction(() => window.__galaxyShark, null, { timeout: 30000 });
  return { browser, ctx, page, logs };
}
module.exports = { open };
