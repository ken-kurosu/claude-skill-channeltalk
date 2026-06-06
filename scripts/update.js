#!/usr/bin/env node
// スキル本体を最新化 (git pull)
// SKILL.md の規約で操作前に必ず呼ばれる
const { execSync } = require('child_process');
const path = require('path');

const REPO_DIR = path.join(__dirname, '..');
try {
  const status = execSync('git fetch --quiet && git status -uno', { cwd: REPO_DIR, encoding: 'utf8' });
  if (/behind/.test(status)) {
    console.log('→ 新しいバージョンがあります、pull します...');
    const out = execSync('git pull --rebase --quiet', { cwd: REPO_DIR, encoding: 'utf8' });
    console.log('✅ 最新化完了');
  } else {
    console.log('✅ skill は最新です');
  }
  // 現在の commit hash + commit message
  const commit = execSync('git log -1 --format="%h %ci %s"', { cwd: REPO_DIR, encoding: 'utf8' }).trim();
  console.log('  現在の commit:', commit);
} catch (e) {
  console.error('⚠️ update 失敗:', e.message.slice(0, 200));
  process.exit(1);
}
