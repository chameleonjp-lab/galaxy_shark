"""サムネイル画像（ogp.jpg、1200×630）を作る。

ゲーム画面は毎回少しずつ違う（獲物の位置など）ので、何回か作って見比べ、よいものを選ぶ。

手順（tools/ogp/work で実行。THREE_PATH には vendor/three.min.js を指定する）:
  node ../capture_scenes.js            # 海・都市・宇宙のゲーム画面（p1/p2/p4.png）
  node ../render_shark.js '[[4.3,1.3,5.6,0.0]]'   # 口を開けたサメだけを透明な背景で（shark0.png）
  python3 ../build.py                  # 部品を組み合わせて ogp.html を作り、ogp.jpg に書き出す
"""
import base64, re, subprocess
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
src = (ROOT / 'index.html').read_text(encoding='utf-8')
fonts = ''.join(re.findall(r'  @font-face \{.*?\n  \}\n', src, re.S))
im = Image.open('shark0.png'); im.crop(im.getbbox()).save('shark_c.png')
uri = lambda p: 'data:image/png;base64,' + base64.b64encode(Path(p).read_bytes()).decode()
html = (HERE / 'template.html').read_text(encoding='utf-8').replace('/*FONTS*/', fonts)
for n in ['p1', 'p2', 'p4', 'shark_c']:
    html = html.replace('{{%s}}' % n, uri(n + '.png'))
Path('ogp.html').write_text(html, encoding='utf-8')
subprocess.run(['node', '-e', """
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.goto('file://' + process.cwd() + '/ogp.html'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: 'ogp.png' }); await b.close(); })();
"""], check=True)
Image.open('ogp.png').convert('RGB').save(ROOT / 'ogp.jpg', quality=88, optimize=True)
print('ogp.jpg を書き出しました')
