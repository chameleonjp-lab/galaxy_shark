(() => {
  'use strict';

  const slug = 'galaxy_shark';
  const clientVersion = 'galaxy-shark-20261128-01';
  const officialOrigin = 'https://chameleonjp-lab.github.io';
  const endpoint = 'https://mlpnjgezrnhdxsxolyzj.supabase.co/rest/v1/rpc/';
  const publicKey = 'sb_publishable_drzcy0v97knU6FgjqSgBHw_0A9XPdFM';
  const nameKey = 'gs_ranking_name_v1';
  const resultPrefix = 'gs_ranking_result_v1:';
  const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
  const inFlight = new Map();
  const debug = /[?&]debug(=1|=true|&|$)/i.test(location.search);
  const canSubmit = !debug && location.origin === officialOrigin && typeof globalThis.crypto?.randomUUID === 'function';
  let counter;

  function cleanName(value) {
    const text = value.replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200b\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069]/gu, '');
    return Array.from(text.trim()).slice(0, 20).join('').trimEnd();
  }

  function saveName(value) {
    const name = cleanName(value);
    try {
      if (name) localStorage.setItem(nameKey, name);
      else localStorage.removeItem(nameKey);
    } catch {}
    return name;
  }

  function savedName() {
    try { return cleanName(localStorage.getItem(nameKey) || ''); } catch { return ''; }
  }

  async function rpc(route, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(endpoint + route, {
        method: 'POST',
        headers: { apikey: publicKey, 'content-type': 'application/json' },
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
        body: JSON.stringify({ p_game_slug: slug, ...body }),
      });
      if (!response.ok) throw new Error('Ranking request failed');
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function register(run) {
    const start = await rpc('start_game_play_v1', {
      p_start_id: run.id, p_display_name: run.name, p_client_version: run.version,
    });
    if (start?.accepted !== true || start.start_id !== run.id || start.game_slug !== slug
      || start.display_name !== run.name || start.client_version !== run.version || !uuid.test(start.play_id)) {
      throw new Error('Named start was not accepted');
    }
    return start.play_id;
  }

  function begin(name) {
    if (!canSubmit) return null;
    counter ??= import('../chameleonjp_lab/play-start.js');
    void counter.then(({ recordPlayStart }) => recordPlayStart(slug)).catch(() => { counter = null; });
    if (!name) return null;
    const run = { id: crypto.randomUUID(), name, version: clientVersion, createdAt: Date.now() };
    run.start = register(run).catch(() => null);
    return run;
  }

  async function upload(result, start) {
    const playId = (await start) || await register(result);
    const fields = { p_play_id: playId, p_display_name: result.name, p_client_version: result.version, p_score: result.score };
    const finish = await rpc('finish_game_play_v1', {
      ...fields, p_result_type: result.type, p_reached_wave: result.phase,
    });
    if (finish?.accepted !== true || finish.play_id !== playId || finish.game_slug !== slug
      || finish.result_type !== result.type || finish.reached_wave !== result.phase || finish.score !== result.score) {
      throw new Error('Result was not accepted');
    }
    const rows = await rpc('submit_score_idempotent_v1', { ...fields, p_submission_id: result.id });
    const receipt = rows?.[0];
    if (!Array.isArray(rows) || rows.length !== 1 || receipt?.accepted !== true
      || receipt.result_submission_id !== result.id || receipt.result_play_id !== playId) {
      throw new Error('Score was not accepted');
    }
    try { localStorage.removeItem(resultPrefix + result.id); } catch {}
  }

  function send(result, start) {
    if (!inFlight.has(result.id)) {
      inFlight.set(result.id, upload(result, start).finally(() => inFlight.delete(result.id)));
    }
    return inFlight.get(result.id);
  }

  function validResult(result) {
    return !!result && uuid.test(result.id) && typeof result.name === 'string' && result.name !== ''
      && cleanName(result.name) === result.name && result.version === clientVersion
      && Number.isFinite(result.createdAt)
      && (result.type === 'clear' || result.type === 'game_over')
      && Number.isInteger(result.phase) && result.phase >= 1 && result.phase <= 5
      && Number.isInteger(result.score) && result.score >= 0 && result.score <= 2147483647;
  }

  function finish(run, type, phase, score) {
    const { id, name, version } = run;
    const result = { id, name, version, createdAt: Date.now(), type, phase, score };
    if (!validResult(result)) return () => Promise.reject(new Error('Invalid ranking result'));
    try { localStorage.setItem(resultPrefix + result.id, JSON.stringify(result)); } catch {}
    return () => send(result, run.start);
  }

  async function recover() {
    if (!canSubmit) return;
    let keys;
    try { keys = Object.keys(localStorage).filter(key => key.startsWith(resultPrefix)); } catch { return; }
    for (const key of keys) {
      let result;
      try { result = JSON.parse(localStorage.getItem(key)); } catch {}
      if (!validResult(result) || key !== resultPrefix + result.id || Date.now() - result.createdAt > 7 * 86400000) {
        try { localStorage.removeItem(key); } catch {}
        continue;
      }
      try { await send(result); } catch { break; }
    }
  }

  async function top30() {
    const rows = await rpc('lab_ranking_page_v1', { p_tab: 'best', p_offset: 0, p_limit: 30 });
    if (!Array.isArray(rows) || rows.length > 30 || rows.some(row =>
      !Number.isSafeInteger(row?.rank_no) || row.rank_no < 1 || typeof row.display_name !== 'string'
        || !Number.isSafeInteger(row.best_score) || row.best_score < 0)) {
      throw new Error('Invalid ranking rows');
    }
    return rows;
  }

  async function playCount() {
    const rows = await rpc('get_game_play_stats');
    const count = rows?.[0]?.total_play_count;
    if (!Array.isArray(rows) || rows.length !== 1 || !Number.isSafeInteger(count) || count < 0) {
      throw new Error('Invalid play count');
    }
    return count;
  }

  if (canSubmit) {
    window.addEventListener('online', () => void recover());
    void recover();
  }
  window.GalaxyRanking = { begin, finish, cleanName, savedName, saveName, top30, playCount };
})();
