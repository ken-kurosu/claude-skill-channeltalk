#!/usr/bin/env node
// chat の状態 + 直近メッセージを確認
// usage: inspect-chat.js <chatId> [--messages N]
const { apiCall } = require('../lib/aika');

(async () => {
  const cid = process.argv[2];
  if (!cid) { console.error('usage: inspect-chat.js <chatId>'); process.exit(1); }
  const limit = process.argv.includes('--messages') ? Number(process.argv[process.argv.indexOf('--messages') + 1]) : 5;

  const c = await apiCall('GET', `/user-chats/${cid}`);
  const u = c.body.userChat || c.body;
  console.log('=== chat', cid, '===');
  console.log('state:', u.state);
  console.log('tags:', (u.tags || []).join(','));
  console.log('createdAt:', new Date(u.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));
  if (u.closedAt) console.log('closedAt:', new Date(u.closedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));

  const m = await apiCall('GET', `/user-chats/${cid}/messages?limit=${limit}&sortOrder=desc`);
  const msgs = (m.body.messages || []).reverse();
  console.log(`\n--- last ${msgs.length} messages ---`);
  for (const x of msgs) {
    const who = x.personType + (x.personId ? '[' + x.personId.slice(0, 12) + ']' : '');
    const opts = (x.options || []).join(',');
    console.log(' ', new Date(x.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
      who,
      opts ? `[${opts}]` : '',
      ':', (x.plainText || '').slice(0, 200).replace(/\n/g, ' / '));
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
