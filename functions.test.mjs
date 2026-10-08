import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import vote from '../netlify/functions/vote.mjs';
import admin from '../netlify/functions/admin.mjs';

process.env.SUPABASE_URL='https://sample.supabase.co';
process.env.SUPABASE_SECRET_KEY='sb_secret_FAKE_FOR_TESTS';
process.env.CODE_PEPPER='correct-test-pepper';
process.env.ADMIN_SECRET='very-long-example-admin-password';
const target='https://election.netlify.app/api/vote';
const voteReq=(code,choice='oui')=>new Request(target,{
 method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,choice})});
const postAdmin=(key,body)=>new Request('https://election.netlify.app/api/admin',{
 method:'POST',headers:{'authorization':`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify(body)});
function stub(data) {
  const calls=[];
  globalThis.fetch=async (url,init)=>{
    calls.push({url,init});
    return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
  };
  return calls;
}

test('correct code is normalized, pepper-hashed and sent server-to-server', async()=>{
  const calls=stub('ok');
  const r=await vote(voteReq('k7m-4p9','oui'),{ip:'198.51.100.22'});
  assert.equal(r.status,200); assert.equal((await r.json()).ok,true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://sample.supabase.co/rest/v1/rpc/cast_ballot');
  assert.equal(calls[0].init.headers.apikey,'sb_secret_FAKE_FOR_TESTS');
  assert.equal(calls[0].init.body.includes('K7M4P9'),false);
  assert.equal(JSON.parse(calls[0].init.body).p_digest,createHmac('sha256','correct-test-pepper').update('K7M4P9').digest('hex'));
});

test('reused/invalid code is refused by backend result',async()=>{
  stub('invalid'); const r=await vote(voteReq('K7M-4P9'),{ip:'198.51.100.22'});
  assert.equal(r.status,409);
  assert.match((await r.json()).error,/invalide|utilisé/);
});

test('closed election and attempt limit are handled',async()=>{
  stub('closed');const r1=await vote(voteReq('K7M-4P9'),{ip:'203.0.113.45'});
  assert.equal(r1.status,409);
  stub('limited');const r2=await vote(voteReq('K7M-4P9'),{ip:'203.0.113.45'});
  assert.equal(r2.status,429);
});

test('admin secret is required for both report and closing',async()=>{
  const calls=stub({status:'open',turnout:2,eligible:5});
  const bad=await admin(postAdmin('incorrect',{action:'status'}));
  assert.equal(bad.status,401);assert.equal(calls.length,0);
  const good=await admin(postAdmin('very-long-example-admin-password',{action:'status'}));
  assert.equal(good.status,200);
  const report=await good.json();
  assert.deepEqual(report,{status:'open',turnout:2,eligible:5});
  const end=await admin(postAdmin('very-long-example-admin-password',{action:'close',confirm:'FERMER'}));
  assert.equal(end.status,200);
  assert.match(calls[1].url,/close_election$/);
});

test('only POST routes accepted and malformed codes do not reach database', async()=>{
  const calls=stub('ok');
  const method=await vote(new Request(target),{ip:'198.51.100.1'});
  assert.equal(method.status,405);
  const invalid=await vote(voteReq('INVALIDCODE'),{ip:'198.51.100.1'});
  assert.equal(invalid.status,400);
  assert.equal(calls.length,0);
});
