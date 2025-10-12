// Build latest.json from ThingSpeak (Node 18+)
import fs from 'node:fs/promises';

const WATER = { id: 3089969, key: process.env.THINGSPEAK_WATER_KEY };
const OUT   = { id: 3094234, key: process.env.THINGSPEAK_OUT_KEY };
const UV    = { id: 3043993, key: process.env.THINGSPEAK_UV_KEY };

function num(raw){
  if(raw == null) return NaN;
  const s = String(raw).trim().replace(',', '.').replace(/[^0-9.+\-eE]/g, '');
  const v = Number(s);
  return Number.isFinite(v) ? v : NaN;
}
async function lastField(channel, field){
  const u = new URL(`https://api.thingspeak.com/channels/${channel.id}/fields/${field}.json`);
  u.searchParams.set('results', '1');
  if(channel.key) u.searchParams.set('api_key', channel.key);
  const res = await fetch(u);
  if(!res.ok) throw new Error('HTTP '+res.status);
  const data = await res.json();
  const feeds = data.feeds || [];
  const rec = feeds[0];
  if(!rec) return { v:null, at:null };
  const v = num(rec[`field${field}`]);
  const at = rec.created_at || null;
  return { v: Number.isNaN(v) ? null : v, at };
}

async function main(){
  const out = {
    filple: {
      swim: await lastField(WATER, 1),
      kids: await lastField(WATER, 2),
      out:  await lastField(OUT, 1),
      uv:   await lastField(UV, 5),
    },
    natur: {
      swim: await lastField(WATER, 3),
      kids: await lastField(WATER, 3),
      out:  await lastField(OUT, 2),
      uv:   await lastField(UV, 5),
    }
  };
  await fs.writeFile('latest.json', JSON.stringify(out, null, 2));
  console.log('latest.json written');
}

main().catch(e=>{ console.error(e); process.exit(1); });