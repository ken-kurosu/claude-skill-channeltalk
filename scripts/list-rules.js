#!/usr/bin/env node
const { deskApiCall } = require('../lib/aika');
(async () => {
  const res = await deskApiCall('GET', '/channels/32867/front-alf/v2/rules');
  if (res.status !== 200) { console.error(res); process.exit(1); }
  const rules = res.body.frontAlfRules || [];
  console.log(`rules: ${rules.length}`);
  for (const r of rules) {
    console.log(` ${r.id} | ${r.state.padEnd(7)} | ${r.title} | len=${(r.instruction || '').length}`);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
