import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const generator=resolve('scripts/generate-codes.mjs');

test('generator emits 50 distinct, readable one-use codes and only hashed DB digests',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'mk-v7-codes-'));
  execFileSync(process.execPath,[generator,'50','https://test-election.netlify.app'],{cwd:tmp});
  const csv=readFileSync(join(tmp,'private','codes-whatsapp.csv'),'utf8');
  const sql=readFileSync(join(tmp,'private','initialiser-test.sql'),'utf8');
  const codes=[...csv.matchAll(/"([A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3})"/g)].map(x=>x[1]);
  assert.equal(codes.length,50);
  assert.equal(new Set(codes).size,50);
  assert.equal((sql.match(/\('[a-f0-9]{64}'\)/g)||[]).length,50);
  assert.match(sql,/VALUES \(1,'open',50,0,0\)/);
  assert.doesNotMatch(sql,/test-election\.netlify\.app/);
  assert.ok(existsSync(join(tmp,'private','ADMIN_SECRET.txt')));
  assert.ok(existsSync(join(tmp,'private','CODE_PEPPER.txt')));
  assert.throws(()=>execFileSync(process.execPath,[generator,'5','https://test-election.netlify.app'],{cwd:tmp,stdio:'pipe'}));
});
