#!/usr/bin/env node
// 全 ALF rule を一括バックアップ
// usage: backup-all-rules.js
const { deskApiCall } = require('../lib/aika');
const backup = require('../lib/backup');

(async () => {
  const res = await deskApiCall('GET', '/channels/32867/front-alf/v2/rules');
  if (res.status !== 200) { console.error('fetch failed:', res.status); process.exit(1); }
  const rules = res.body.frontAlfRules || [];
  console.log(`fetched ${rules.length} rules`);
  // 一括 backup
  const bk = backup.save('rule-snapshot', 'all', rules, { action: 'backup-all-rules', count: rules.length });
  console.log('snapshot saved:', bk.filename);
  // 各 rule 個別 backup も保存 (個別復元用)
  for (const r of rules) {
    backup.save('rule', r.id, r, { action: 'snapshot' });
  }
  console.log(`✅ ${rules.length} rules backed up`);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
