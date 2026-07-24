// バックアップ保存 / 一覧 / 復元
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

function ensureDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// 保存: target = "rule"/"workflow"/"chat" など、id = 対象ID
// data = 現状の JSON、meta = 操作概要
// ローカル + Aika に同時保存 (中央集約、メンバーマシン故障時の復旧用)
function save(target, id, data, meta = {}) {
  ensureDir();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${ts}_${target}_${id}.json`;
  const filepath = path.join(BACKUP_DIR, filename);
  const operator = process.env.USER || process.env.LOGNAME || 'unknown';
  const payload = { ts, target, id, operator, meta, data };
  fs.writeFileSync(filepath, JSON.stringify(payload, null, 2));
  // Aika にも同時保存 (中央集約)
  try {
    const { execSync } = require('child_process');
    const AIKA_HOST = process.env.AIKA_HOST || 'kurosu@100.84.67.39';
    const AIKA_BACKUP_DIR = '/Users/kurosu/channeltalk-skill-backups';
    execSync(`ssh -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=accept-new ${AIKA_HOST} 'mkdir -p ${AIKA_BACKUP_DIR}' 2>/dev/null`, { stdio: 'pipe' });
    execSync(`scp -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=accept-new -q '${filepath}' ${AIKA_HOST}:${AIKA_BACKUP_DIR}/`, { stdio: 'pipe' });
  } catch (e) {
    // Aika 同期失敗してもローカルは保存済なので、警告だけ出して継続
    console.error('⚠️  Aika へのバックアップ同期に失敗 (ローカルには保存済): ' + e.message.slice(0, 100));
  }
  return { filename, filepath };
}

// 一覧 (最新順)
function list(filter = {}) {
  ensureDir();
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort().reverse();
  return files
    .map(f => {
      try {
        const p = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, f), 'utf8'));
        return { filename: f, ts: p.ts, target: p.target, id: p.id, meta: p.meta };
      } catch { return null; }
    })
    .filter(Boolean)
    .filter(b => (!filter.target || b.target === filter.target) && (!filter.id || b.id === filter.id));
}

// 復元: filename 指定で過去 data を取得
// ローカルに無ければ Aika から自動 fetch
function load(filename) {
  const fp = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(fp)) {
    // Aika から復旧を試行
    try {
      const { execSync } = require('child_process');
      const AIKA_HOST = process.env.AIKA_HOST || 'kurosu@100.84.67.39';
      const AIKA_BACKUP_DIR = '/Users/kurosu/channeltalk-skill-backups';
      execSync(`scp -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=accept-new -q ${AIKA_HOST}:${AIKA_BACKUP_DIR}/${filename} '${fp}'`, { stdio: 'pipe' });
      console.log('  → Aika から backup を復元しました');
    } catch (e) {
      throw new Error('backup not found locally or on Aika: ' + filename);
    }
  }
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

// Aika 側にある全 backup を list
function listOnAika() {
  try {
    const { execSync } = require('child_process');
    const AIKA_HOST = process.env.AIKA_HOST || 'kurosu@100.84.67.39';
    const AIKA_BACKUP_DIR = '/Users/kurosu/channeltalk-skill-backups';
    const out = execSync(`ssh -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=accept-new ${AIKA_HOST} 'ls -t ${AIKA_BACKUP_DIR}/ 2>/dev/null | head -50'`, { encoding: 'utf8' });
    return out.trim().split('\n').filter(Boolean);
  } catch { return []; }
}

module.exports = { save, list, load, listOnAika, BACKUP_DIR };
