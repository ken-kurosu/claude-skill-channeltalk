#!/usr/bin/env node
const { deskApiCall } = require('../lib/aika');
(async () => {
  for (const wfId of process.argv.slice(2).length ? process.argv.slice(2) : ['15229', '832569', '223791']) {
    const res = await deskApiCall('GET', `/channels/32867/workflows/${wfId}`);
    if (res.status !== 200) { console.log(wfId, '→', res.status); continue; }
    const wf = res.body.workflow || res.body;
    console.log(` ${wfId} | state=${wf.state.padEnd(7)} | rank=${wf.rank} | name=${wf.name}`);
    console.log(`        runMode: ${JSON.stringify(wf.trigger.runMode)}`);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
