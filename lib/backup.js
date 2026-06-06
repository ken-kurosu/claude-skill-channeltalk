// バックアップ保存 / 一覧 / 復元
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

function ensureDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// 保存: target = "rule"/"workflow"/"chat" など、id = 対象ID
// data = 現状の JSON、meta = 操作概要
function save(target, id, data, meta = {}) {
  ensureDir();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${ts}_${target}_${id}.json`;
  const filepath = path.join(BACKUP_DIR, filename);
  const payload = { ts, target, id, meta, data };
  fs.writeFileSync(filepath, JSON.stringify(payload, null, 2));
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
function load(filename) {
  const fp = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(fp)) throw new Error('backup not found: ' + filename);
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

module.exports = { save, list, load, BACKUP_DIR };
