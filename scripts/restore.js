#!/usr/bin/env node
// バックアップから復元する
// usage:
//   restore.js <backup-filename>    # 指定 backup を復元
//   restore.js --list                # 直近のバックアップ一覧
const { apiCall, deskApiCall } = require('../lib/aika');
const backup = require('../lib/backup');

async function restoreChatState(data, _id) {
  const cid = data.id || data.userChat?.id;
  // chat の reopen は別 endpoint。snoozed/closed → opened に戻すには action='open' を試す
  console.log('restoring chat', cid, 'to state:', data.state);
  if (data.state === 'opened') {
    const res = await deskApiCall('PUT', `/channels/32867/user-chats/${cid}/pcp`, { tags: data.tags || [], action: 'open' });
    console.log('reopen result:', res.status);
  } else if (data.state === 'snoozed') {
    // snoozedAt の差分で時間計算 (簡略化: 1h)
    const res = await apiCall('PUT', `/user-chats/${cid}/snooze?duration=PT1H&botName=` + encodeURIComponent('アイカサ 自動案内'), null);
    console.log('snooze result:', res.status);
  }
  // タグ復元
  if (Array.isArray(data.tags)) {
    const tagRes = await apiCall('PATCH', `/user-chats/${cid}`, { tags: data.tags });
    console.log('tag restore:', tagRes.status);
  }
}

async function restoreRule(data, _id) {
  const ruleId = data.id;
  console.log('restoring rule', ruleId, 'title:', data.title);
  const body = {
    title: data.title,
    trigger: data.trigger,
    instruction: data.instruction,
    filter: data.filter || {},
    state: data.state
  };
  const res = await deskApiCall('PUT', `/channels/32867/front-alf/v2/rules/${ruleId}`, body);
  console.log('restore PUT result:', res.status);
  // state も復元 (live/paused)
  if (data.state === 'live' || data.state === 'paused') {
    const stateRes = await deskApiCall('PUT', `/channels/32867/front-alf/v2/rules/${ruleId}/${data.state}`, null);
    console.log('state restore:', stateRes.status);
  }
}

async function restoreWorkflow(data, _id) {
  console.log('⚠️  workflow 復元は state (active/stopped) のみ自動可能。trigger 等の復元は手動で switch_*.js 系を使用してください');
  const wfId = data.id;
  if (data.state === 'active') {
    await deskApiCall('PUT', `/channels/32867/workflows/${wfId}/activate`, null);
    console.log('activated');
  } else if (data.state === 'stopped') {
    await deskApiCall('PUT', `/channels/32867/workflows/${wfId}/stop`, null);
    console.log('stopped');
  }
}

(async () => {
  const arg = process.argv[2];
  if (!arg || arg === '--list') {
    const list = backup.list();
    console.log('backups (newest first):');
    for (const b of list.slice(0, 30)) console.log(' ', b.filename, '|', b.target, b.id, '|', b.meta?.action || '');
    return;
  }
  const b = backup.load(arg);
  console.log('=== restoring ===');
  console.log('ts:', b.ts, 'target:', b.target, 'id:', b.id, 'meta:', b.meta);
  switch (b.target) {
    case 'chat-state': await restoreChatState(b.data, b.id); break;
    case 'rule': await restoreRule(b.data, b.id); break;
    case 'workflow': await restoreWorkflow(b.data, b.id); break;
    default: console.error('unknown target:', b.target); process.exit(1);
  }
  console.log('✅ restore 完了');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
