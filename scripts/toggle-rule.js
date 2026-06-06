#!/usr/bin/env node
// rule の state を pause/live 切替
// usage: toggle-rule.js <ruleId> pause|live
const { deskApiCall } = require('../lib/aika');
const backup = require('../lib/backup');
(async () => {
  const ruleId = process.argv[2];
  const action = process.argv[3]; // pause | live
  if (!ruleId || !['pause', 'live'].includes(action)) { console.error('usage: toggle-rule.js <ruleId> pause|live'); process.exit(1); }
  const cur = await deskApiCall('GET', '/channels/32867/front-alf/v2/rules');
  const rule = (cur.body.frontAlfRules || []).find(r => r.id === ruleId);
  if (!rule) { console.error('rule not found'); process.exit(1); }
  console.log('before:', rule.title, 'state=' + rule.state);
  const bk = backup.save('rule', ruleId, rule, { action: 'toggle-' + action });
  const res = await deskApiCall('PUT', `/channels/32867/front-alf/v2/rules/${ruleId}/${action}`, null);
  if (res.status < 200 || res.status >= 300) {
    console.error('toggle failed:', res.status, res.body);
    console.error('to restore: node scripts/restore.js ' + bk.filename);
    process.exit(1);
  }
  console.log('✅ rule', ruleId, '→', action);
  console.log('backup id:', bk.filename);
})().catch(e => { console.error(e.message); process.exit(1); });
