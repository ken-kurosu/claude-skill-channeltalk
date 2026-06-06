#!/usr/bin/env node
const { deskApiCall } = require('../lib/aika');
const backup = require('../lib/backup');
(async () => {
  // 既知の workflow id (拡張する場合はここに追加)
  const wfIds = process.argv.slice(2).length ? process.argv.slice(2) : ['15229', '832569', '223791'];
  const all = [];
  for (const wfId of wfIds) {
    const res = await deskApiCall('GET', `/channels/32867/workflows/${wfId}`);
    if (res.status !== 200) { console.log(wfId, '→', res.status); continue; }
    const wf = res.body.workflow || res.body;
    all.push(wf);
    backup.save('workflow', wfId, wf, { action: 'snapshot' });
    console.log('backed up', wfId, wf.name, 'state=' + wf.state);
  }
  backup.save('workflow-snapshot', 'all', all, { action: 'backup-all-workflows', count: all.length, ids: wfIds });
  console.log(`✅ ${all.length} workflows backed up`);
})().catch(e => { console.error(e.message); process.exit(1); });
