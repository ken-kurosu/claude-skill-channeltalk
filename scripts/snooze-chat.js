#!/usr/bin/env node
// usage: snooze-chat.js <chatId> <hours>
const { apiCall } = require('../lib/aika');
const backup = require('../lib/backup');
(async () => {
  const cid = process.argv[2];
  const hours = Number(process.argv[3]);
  if (!cid || !hours) { console.error('usage: snooze-chat.js <chatId> <hours>'); process.exit(1); }
  const before = await apiCall('GET', `/user-chats/${cid}`);
  const cur = before.body.userChat || before.body;
  console.log('before:', { state: cur.state, tags: cur.tags });
  const bk = backup.save('chat-state', cid, cur, { action: 'snooze', hours, prevState: cur.state });
  const res = await apiCall('PUT', `/user-chats/${cid}/snooze?duration=PT${hours}H&botName=` + encodeURIComponent('アイカサ 自動案内'), null);
  if (res.status < 200 || res.status >= 300) {
    console.error('snooze failed:', res.status);
    console.error('to restore: node scripts/restore.js ' + bk.filename);
    process.exit(1);
  }
  console.log('✅ snoozed for', hours, 'hours');
  console.log('backup id:', bk.filename);
})().catch(e => { console.error(e.message); process.exit(1); });
