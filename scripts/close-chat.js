#!/usr/bin/env node
// chat を真 close (state=closed) する
// usage: node close-chat.js <chatId>
const { apiCall, deskApiCall } = require('../lib/aika');
const backup = require('../lib/backup');

(async () => {
  const cid = process.argv[2];
  if (!cid) { console.error('usage: close-chat.js <chatId>'); process.exit(1); }
  // 1. 現状取得 + backup
  const before = await apiCall('GET', `/user-chats/${cid}`);
  if (before.status !== 200) { console.error('chat fetch failed:', before.status); process.exit(1); }
  const cur = before.body.userChat || before.body;
  console.log('before:', { state: cur.state, tags: cur.tags });
  const bk = backup.save('chat-state', cid, cur, { action: 'close', prevState: cur.state });
  console.log('backup saved:', bk.filename);
  if (cur.state === 'closed') { console.log('already closed, skip'); return; }
  // 2. PUT /pcp で close
  const res = await deskApiCall('PUT', `/channels/32867/user-chats/${cid}/pcp`, { tags: [], action: 'close' });
  if (res.status < 200 || res.status >= 300) {
    console.error('close failed:', res.status, res.body);
    console.error('to restore: node scripts/restore.js ' + bk.filename);
    process.exit(1);
  }
  // 3. 確認
  const after = await apiCall('GET', `/user-chats/${cid}`);
  const u = after.body.userChat || after.body;
  console.log('after:', { state: u.state, closedAt: u.closedAt ? new Date(u.closedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-' });
  console.log('✅ closed (backup id:', bk.filename + ')');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
