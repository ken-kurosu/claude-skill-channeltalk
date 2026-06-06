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

// Aika 側で desk-api (内部 API) call — Playwright session 経由
// path に "/front-alf" を含む場合は front-alf-desk-api.channel.io を使う
async function deskApiCall(method, path, body = null) {
  const fs = require('fs');
  const os = require('os');
  const host = path.includes('/front-alf') ? 'front-alf-desk-api.channel.io' : 'desk-api.channel.io';
  const script = `const { chromium } = require("${AIKA_AUTOMATION}/node_modules/playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: "${AIKA_AUTOMATION}/storage_state.json" });
  const page = await ctx.newPage();
  let hdrs = null;
  page.on('request', r => { if (r.url().includes('desk-api') && !hdrs) hdrs = r.headers(); });
  await page.goto('https://desk.channel.io/#/channels/32867', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(8000);
  if (!hdrs) { console.error('no session'); process.exit(1); }
  const res = await page.evaluate(async ({h, p, m, b, host}) => {
    const opts = { method: m, headers: { ...h, 'Content-Type': 'application/json' }, credentials: 'include' };
    if (b) opts.body = JSON.stringify(b);
    const r = await fetch('https://' + host + '/desk' + p, opts);
    return { status: r.status, body: await r.text() };
  }, { h: hdrs, p: ${JSON.stringify(path)}, m: ${JSON.stringify(method)}, b: ${body ? JSON.stringify(body) : 'null'}, host: ${JSON.stringify(host)} });
  console.log(JSON.stringify(res));
  await browser.close();
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
