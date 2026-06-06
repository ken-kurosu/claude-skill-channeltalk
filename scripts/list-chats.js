#!/usr/bin/env node
// chat 検索
// usage:
//   list-chats.js                       # opened 直近 24h
//   list-chats.js --state opened|snoozed|closed
//   list-chats.js --hours 48            # 48時間以内
//   list-chats.js --tag ALF_介入
const { apiCall } = require('../lib/aika');

(async () => {
  const args = process.argv.slice(2);
  const stateIdx = args.indexOf('--state');
  const hoursIdx = args.indexOf('--hours');
  const tagIdx = args.indexOf('--tag');
  const state = stateIdx > -1 ? args[stateIdx + 1] : 'opened';
  const hours = hoursIdx > -1 ? Number(args[hoursIdx + 1]) : 24;
  const tag = tagIdx > -1 ? args[tagIdx + 1] : null;
  const since = Date.now() - hours * 3600 * 1000;

  const res = await apiCall('GET', `/user-chats?state=${state}&limit=500`);
  let list = res.body.userChats || [];
  list = list.filter(c => c.createdAt >= since);
  if (tag) list = list.filter(c => (c.tags || []).includes(tag));
  list.sort((a, b) => b.createdAt - a.createdAt);
  console.log(`chats (state=${state}, hours=${hours}${tag ? ', tag=' + tag : ''}): ${list.length}`);
  for (const c of list.slice(0, 50)) {
    const d = new Date(c.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    console.log(` ${c.id.slice(0, 16)} | ${d} | tags=${(c.tags || []).filter(t => !t.startsWith('04_自動')).slice(0, 4).join(',')}`);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
