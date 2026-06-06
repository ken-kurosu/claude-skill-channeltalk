#!/usr/bin/env node
// usage: tag-chat.js <chatId> add|remove <tag>
const { apiCall } = require('../lib/aika');
const backup = require('../lib/backup');
(async () => {
  const [cid, op, tag] = process.argv.slice(2);
  if (!cid || !['add', 'remove'].includes(op) || !tag) { console.error('usage: tag-chat.js <chatId> add|remove <tag>'); process.exit(1); }
  const before = await apiCall('GET', `/user-chats/${cid}`);
  const cur = before.body.userChat || before.body;
  const oldTags = cur.tags || [];
  console.log('before tags:', oldTags.join(','));
  const newTags = op === 'add' ? Array.from(new Set([...oldTags, tag])) : oldTags.filter(t => t !== tag);
  const bk = backup.save('chat-state', cid, cur, { action: `tag-${op}`, tag, oldTags });
  const res = await apiCall('PATCH', `/user-chats/${cid}`, { tags: newTags });
  if (res.status < 200 || res.status >= 300) {
    console.error('tag update failed:', res.status);
    console.error('to restore: node scripts/restore.js ' + bk.filename);
    process.exit(1);
  }
  console.log('after tags:', newTags.join(','));
  console.log('✅ done, backup id:', bk.filename);
})().catch(e => { console.error(e.message); process.exit(1); });
