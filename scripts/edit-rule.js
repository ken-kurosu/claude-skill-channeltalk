#!/usr/bin/env node
// ALF rule の instruction を編集 (自動 backup)
// usage:
//   edit-rule.js <ruleId> --file <path>     # ファイルから instruction 取得
//   edit-rule.js <ruleId> --text "<内容>"   # 直接指定
//   edit-rule.js <ruleId> --append <path>   # 既存に追記
const { deskApiCall } = require('../lib/aika');
const backup = require('../lib/backup');
const fs = require('fs');

(async () => {
  const ruleId = process.argv[2];
  if (!ruleId) { console.error('usage: edit-rule.js <ruleId> --file|--text|--append <arg>'); process.exit(1); }
  // 現状取得 + backup
  const cur = await deskApiCall('GET', '/channels/32867/front-alf/v2/rules');
  const rule = (cur.body.frontAlfRules || []).find(r => r.id === ruleId);
  if (!rule) { console.error('rule not found:', ruleId); process.exit(1); }
  console.log('before:', { title: rule.title, len: rule.instruction.length, state: rule.state });
  const bk = backup.save('rule', ruleId, rule, { action: 'edit', oldLen: rule.instruction.length });
  console.log('backup saved:', bk.filename);

  let newInstruction;
  if (process.argv.includes('--file')) {
    newInstruction = fs.readFileSync(process.argv[process.argv.indexOf('--file') + 1], 'utf8');
  } else if (process.argv.includes('--text')) {
    newInstruction = process.argv[process.argv.indexOf('--text') + 1];
  } else if (process.argv.includes('--append')) {
    const appendText = fs.readFileSync(process.argv[process.argv.indexOf('--append') + 1], 'utf8');
    newInstruction = rule.instruction + '\n\n' + appendText;
  } else {
    console.error('需 --file|--text|--append');
    console.error('to restore: node scripts/restore.js ' + bk.filename);
    process.exit(1);
  }

  if (newInstruction.length > 2000) {
    console.error(`⚠️ instruction が 2000字を超えています (${newInstruction.length}字)。rule 上限は 2000字。`);
    console.error('to restore (no-op needed): node scripts/restore.js ' + bk.filename);
    process.exit(1);
  }

  const body = { title: rule.title, trigger: rule.trigger, instruction: newInstruction, filter: rule.filter || {}, state: rule.state };
  const res = await deskApiCall('PUT', `/channels/32867/front-alf/v2/rules/${ruleId}`, body);
  if (res.status < 200 || res.status >= 300) {
    console.error('PUT failed:', res.status, res.body);
    console.error('to restore: node scripts/restore.js ' + bk.filename);
    process.exit(1);
  }
  console.log(`✅ edited (${rule.instruction.length} → ${newInstruction.length} chars)`);
  console.log('backup id:', bk.filename);
  console.log('to undo: node scripts/restore.js ' + bk.filename);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
