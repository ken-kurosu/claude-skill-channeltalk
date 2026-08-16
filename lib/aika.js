// Aika (Mac mini) 経由実行ラッパー
// 全 mutation 系操作は Aika に集約された認証情報 (Open API key, storage_state) を使う
const { execSync, spawn } = require('child_process');

const AIKA_HOST = process.env.AIKA_HOST || 'kurosu@100.84.67.39';
const AIKA_AUTOMATION = '/Users/kurosu/aikasa-channeltalk-impl/automation';
const SSH_OPTS = '-o ConnectTimeout=10 -o ServerAliveInterval=30 -o StrictHostKeyChecking=accept-new';

// Aika 側で Node.js script を実行 (引数文字列はそのまま)
function runOnAika(scriptPath, args = []) {
  const argStr = args.map(a => `'${String(a).replace(/'/g, "'\\''")}'`).join(' ');
  const cmd = `ssh ${SSH_OPTS} ${AIKA_HOST} 'export PATH=/usr/local/bin:$PATH; cd ${AIKA_AUTOMATION} && node ${scriptPath} ${argStr}'`;
  return execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
}

// Aika 側で Open API call (lib/api.js 経由)
// payload + 実行 script を両方 scp してから node 実行 (quote ネスト回避)
function apiCall(method, path, body = null) {
  const fs = require('fs');
  const os = require('os');
  const ts = Date.now();
  const payloadPath = `${os.tmpdir()}/aika_payload_${ts}.json`;
  const scriptPath = `${os.tmpdir()}/aika_apicall_${ts}.js`;
  fs.writeFileSync(payloadPath, JSON.stringify({ method, path, body }));
  fs.writeFileSync(scriptPath, `const p = JSON.parse(require('fs').readFileSync('/tmp/aika_payload_${ts}.json', 'utf8'));
const api = require('${AIKA_AUTOMATION}/lib/api');
api.request(p.method, p.path, p.body)
  .then(r => console.log(JSON.stringify({status: r.status, body: r.body})))
  .catch(e => { console.error('ERR:', e.message); process.exit(1); });`);
  execSync(`scp ${SSH_OPTS} ${payloadPath} ${scriptPath} ${AIKA_HOST}:/tmp/`, { encoding: 'utf8' });
  const cmd = `ssh ${SSH_OPTS} ${AIKA_HOST} 'export PATH=/usr/local/bin:$PATH; node /tmp/aika_apicall_${ts}.js'`;
  const out = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  fs.unlinkSync(payloadPath);
  fs.unlinkSync(scriptPath);
  return JSON.parse(out.trim().split('\n').pop());
}

// Aika 側で desk-api (内部 API) call — lib/desk_api.js の JWT 経由
// path に "/front-alf" を含む場合は front-alf-desk-api.channel.io を使う
//
// 【重要・2026-08-16 修正】以前は Playwright で storage_state.json を読んで毎回ブラウザを起動していた。
// だが ローテーション後の cookie を書き戻さずに browser.close() していたため、
// 2 回目の呼び出しが失効済みの x-account-refresh を再提示 →
// ChannelTalk のリフレッシュトークン再利用検知が発火し **desk セッション全体が無効化** されていた。
// これが「認証情報が変更されたためログアウトしました」が繰り返し出ていた真因。
// (backup-all-workflows.js は 3 件ループするので、実行するたびに 2 件目で自壊していた)
//
// lib/desk_api.js の ensureFreshJwt() は /desk/account/touch で再発行した
// x-account / x-account-refresh を storage_state.json へ原子的に書き戻すため再利用検知は起きない。
// ブラウザ起動も不要になり 1 コールあたり約 15 秒 → 約 1 秒になる。
async function deskApiCall(method, path, body = null) {
  const fs = require('fs');
  const os = require('os');
  const host = path.includes('/front-alf') ? 'front-alf-desk-api.channel.io' : 'desk-api.channel.io';
  const script = `const api = require("${AIKA_AUTOMATION}/lib/desk_api");
(async () => {
  // 期限切れ間際なら touch で再発行し storage_state.json に書き戻す
  const jwt = await api.ensureFreshJwt();
  const m = ${JSON.stringify(method)};
  const p = ${JSON.stringify(path)};
  const b = ${body ? JSON.stringify(body) : 'null'};
  const headers = {
    'x-account': jwt,
    'Accept': 'application/json',
    'Origin': 'https://desk.channel.io',
    'Referer': 'https://desk.channel.io/',
    'Accept-Language': 'ja',
  };
  if (b) headers['Content-Type'] = 'application/json';
  const r = await fetch('https://' + ${JSON.stringify(host)} + '/desk' + p, {
    method: m,
    headers,
    body: b ? JSON.stringify(b) : undefined,
  });
  console.log(JSON.stringify({ status: r.status, body: await r.text() }));
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });`;
  const tmpPath = `${os.tmpdir()}/aika_desk_call_${Date.now()}.js`;
  fs.writeFileSync(tmpPath, script);
  execSync(`scp ${SSH_OPTS} ${tmpPath} ${AIKA_HOST}:/tmp/`, { encoding: 'utf8' });
  const remoteName = tmpPath.split('/').pop();
  const cmd = `ssh ${SSH_OPTS} ${AIKA_HOST} 'export PATH=/usr/local/bin:$PATH; node /tmp/${remoteName}'`;
  const out = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  fs.unlinkSync(tmpPath);
  const last = out.trim().split('\n').pop();
  const parsed = JSON.parse(last);
  if (typeof parsed.body === 'string') {
    try { parsed.body = JSON.parse(parsed.body); } catch {}
  }
  return parsed;
}

module.exports = { runOnAika, apiCall, deskApiCall, AIKA_HOST, AIKA_AUTOMATION };
