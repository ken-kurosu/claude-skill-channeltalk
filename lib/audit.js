// 操作 audit log (誰がいつ何をしたかを記録、Aika + ローカル両方)
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const AIKA_HOST = process.env.AIKA_HOST || 'kurosu@100.84.67.39';
const AIKA_AUDIT_LOG = '/Users/kurosu/channeltalk-skill-audit.log';

function ensureDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

// log を記録
// action: 'close-chat' / 'edit-rule' 等
// target: 対象 ID
// status: 'started' / 'success' / 'failed'
// extra: 追加情報 (backup-id 等)
function log(action, target, status, extra = {}) {
  ensureDir();
  const ts = new Date().toISOString();
  const operator = process.env.USER || process.env.LOGNAME || 'unknown';
  const entry = { ts, operator, action, target, status, ...extra };
  const line = JSON.stringify(entry);
  // 月別 log file
  const monthFile = path.join(LOG_DIR, `${ts.slice(0, 7)}.jsonl`);
  fs.appendFileSync(monthFile, line + '\n');
  // Aika にも append (best-effort)
  try {
    execSync(`ssh -o ConnectTimeout=5 -o BatchMode=yes ${AIKA_HOST} 'echo ${JSON.stringify(line)} >> ${AIKA_AUDIT_LOG}' 2>/dev/null`, { stdio: 'pipe' });
  } catch {}
}

module.exports = { log };
