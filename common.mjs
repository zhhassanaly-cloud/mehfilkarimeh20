import { createHmac, timingSafeEqual } from 'node:crypto';

const NO_STORE = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options':'nosniff' };
export function json(payload, status=200){ return new Response(JSON.stringify(payload), {status,headers: NO_STORE}); }
export function allowPost(request) { return request.method === 'POST'; }
export function configured() {return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY && process.env.CODE_PEPPER && process.env.ADMIN_SECRET);}
export function sanitizeCode(value){
  return typeof value === 'string' ? value.toUpperCase().replace(/[^A-Z0-9]/g,'') : '';
}
export function codeHash(code) {
  return createHmac('sha256', process.env.CODE_PEPPER).update(code, 'utf8').digest('hex');
}
function validSecret(submitted) {
  if (typeof submitted !== 'string') return false;
  const expected = process.env.ADMIN_SECRET || '';
  const a=Buffer.from(submitted,'utf8'); const b=Buffer.from(expected,'utf8');
  return a.length>0 && a.length===b.length && timingSafeEqual(a,b);
}
export function authorized(request) {
  const auth=request.headers.get('authorization') || '';
  if(!auth.startsWith('Bearer ')) return false;
  return validSecret(auth.slice(7));
}
export function bucketHash(ip){
  // This limits ordinary guessing attempts. IP data is keyed and never stored in the database.
  // Netlify's edge-supplied header is used, not X-Forwarded-For from the client.
    const epoch = Math.floor(Date.now() / (15 * 60_000));
  return createHmac('sha256', process.env.CODE_PEPPER).update(`${ip}|${epoch}`).digest('hex');
}
export async function rpc(name, parameters={}) {
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url||'')) throw new Error('SUPABASE_URL mal configurée');
  if (!/^[a-z_]+$/.test(name)) throw new Error('Nom RPC invalide');
  const response=await fetch(`${url.replace(/\/$/,'')}/rest/v1/rpc/${name}`, {
    method:'POST',
    headers:{'apikey':key, 'Content-Type':'application/json','Accept':'application/json', 'Cache-Control':'no-store'},
    body:JSON.stringify(parameters),
    signal:AbortSignal.timeout(15000)
  });
  if(!response.ok) {
    // NEVER echo Supabase errors (could expose internal database details)
    throw new Error(`Erreur Supabase (${response.status})`);
  }
  return await response.json();
}
