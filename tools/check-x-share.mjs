import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

for (const id of ['share-x-btn', 'res-share-btn']) {
  test(`${id} remains a button when social sharing links are hidden`, () => {
    const control = html.match(new RegExp(`<([a-z]+)\\b([^>]*\\bid="${id}"[^>]*)>`));
    assert.equal(control?.[1], 'button');
    assert.match(control[2], /\btype="button"/);
  });
}
