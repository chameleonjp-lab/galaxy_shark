const { open } = require('../../docs/playtest/tools/common.js');
const fs = require('fs');
(async () => {
  const { browser, page, logs } = await open({ viewport: { width: 1200, height: 630 }, query: '?debug=1&lang=ja' });
  await page.waitForTimeout(800);
  const views = JSON.parse(process.argv[2] || '[[3.2,0.9,4.2]]');
  for (let i = 0; i < views.length; i++) {
    const url = await page.evaluate(([v, jaw]) => {
      const g = window.__galaxyShark; const T = window.THREE;
      g.paused = true;
      const rig = g.sharkRig;
      const r = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
      r.setPixelRatio(1); r.setSize(1600, 1200); r.setClearColor(0x000000, 0);
      const sc = new T.Scene();
      sc.add(new T.AmbientLight(0xffffff, 0.55));
      const d = new T.DirectionalLight(0xffffff, 0.9); d.position.set(3, 6, 5); sc.add(d);
      const parent = rig.root.parent; sc.add(rig.root);
      rig.root.position.set(0, 0, 0); rig.root.rotation.set(0, 0, 0); rig.root.scale.setScalar(1);
      rig.jawPivot.rotation.x = jaw; rig.headGroup.rotation.x = -0.12;
      const cam = new T.PerspectiveCamera(30, 1600/1200, 0.1, 100);
      cam.position.set(v[0], v[1], v[2]); cam.lookAt(0, 0, v[3] || 0);
      sc.updateMatrixWorld(true);
      r.render(sc, cam);
      const u = r.domElement.toDataURL('image/png');
      parent.add(rig.root); r.dispose();
      return u;
    }, [views[i], 0.6]);
    fs.writeFileSync(`shark${i}.png`, Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log(logs.filter(l => !/GPU stall/.test(l)).slice(0, 5).join('\n'));
  await browser.close();
})();
