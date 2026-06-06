#!/usr/bin/env node
// workflow start/stop
// usage: toggle-workflow.js <wfId> activate|stop
const { deskApiCall } = require('../lib/aika');
const backup = require('../lib/backup');
(async () => {
  const wfId = process.argv[2];
  const action = process.argv[3]; // activate | stop
  if (!wfId || !['activate', 'stop'].includes(action)) { console.error('usage: toggle-workflow.js <wfId> activate|stop'); process.exit(1); }
  const cur = await deskApiCall('GET', `/channels/32867/workflows/${wfId}`);
  if (cur.status !== 200) { console.error(cur); process.exit(1); }
  const wf = cur.body.workflow || cur.body;
  console.log('before:', wf.name, 'state=' + wf.state);
  const bk = backup.save('workflow', wfId, wf, { action: 'toggle-' + action });
  const res = await deskApiCall('PUT', `/channels/32867/workflows/${wfId}/${action}`, null);
  if (res.status < 200 || res.status >= 300) {
    console.error('toggle failed:', res.status, res.body);
    console.error('to restore: node scripts/restore.js ' + bk.filename);
    process.exit(1);
  }
  console.log('✅ workflow', wfId, '→', action);
  console.log('backup id:', bk.filename);
})().catch(e => { console.error(e.message); process.exit(1); });
