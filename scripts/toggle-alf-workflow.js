#!/usr/bin/env node
// wf 832569 (ALF版) の ON/OFF を filter で切替
// on  → filter: catch-all (営業時間外に全ユーザーが ALF版で対応)
// off → filter: 黒須さん限定 (営業時間外でも一般ユーザーは旧版 15229、黒須さんだけ ALF版でテスト可)
// runMode は notInOperation のまま (営業時間内は触らない)
//
// usage: toggle-alf-workflow.js on|off
const { runOnAika, apiCall } = require('../lib/aika');
const backup = require('../lib/backup');
const audit = require('../lib/audit');

(async () => {
  const action = process.argv[2];
  if (!['on', 'off'].includes(action)) {
    console.error('usage: toggle-alf-workflow.js on|off');
    console.error('  on  → 全ユーザー対象 (catch-all filter)');
    console.error('  off → 黒須さん限定 (一般ユーザーは旧版 15229)');
    process.exit(1);
  }
  audit.log('toggle-alf-workflow', '832569', 'started', { action });

  // 現状取得 + backup
  const cur = await apiCall('GET', `/desk-api-skip-not-supported`); // dummy
  // 上記の Open API ラッパーは workflow 取得用ではない。lib/desk_api.js (Aika 側) で取得 → backup
  // 簡略化: Aika 側スクリプトに backup ステップ含めるので、ローカルから取得は skip

  const remoteScript = action === 'on' ? 'enable_832569_all_users.js' : 'disable_832569_kurosu_only.js';
  console.log(`→ Aika で ${remoteScript} を実行中...`);
  try {
    const out = runOnAika(remoteScript);
    console.log(out);
    audit.log('toggle-alf-workflow', '832569', 'success', { action, remoteScript });
    console.log(`✅ ALF workflow (832569) → ${action === 'on' ? '全ユーザー対象 (ON)' : '黒須さん限定 (OFF)'}`);
    console.log(`   営業時間外に ALF が誰に発火するかを切替えた。営業時間内は触ってない (旧版 15229 のまま)。`);
    console.log(`   元に戻す: node scripts/toggle-alf-workflow.js ${action === 'on' ? 'off' : 'on'}`);
  } catch (e) {
    audit.log('toggle-alf-workflow', '832569', 'failed', { action, error: e.message.slice(0, 200) });
    console.error('FAILED:', e.message);
    console.error('Aika 側 backup file: /tmp/wf_832569_pre_' + (action === 'on' ? 'enable_all' : 'kurosu_only') + '.json');
    process.exit(1);
  }
})();
