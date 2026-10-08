import {allowPost, authorized, configured, json, rpc, codeHash, sanitizeCode} from '../lib/common.mjs';

// Admin-only, read-only lookup. Does not use the ballot RPC and never consumes a code.
async function checkCode(input) {
  const normalized = sanitizeCode(input);
  if (!/^[0-9]{6}$/.test(normalized)) return {result: 'invalid'};
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = (process.env.SUPABASE_SECRET_KEY || '').trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) throw new Error('Supabase URL invalid');
  const digest = codeHash(normalized);
  const lookup = new URL(url + '/rest/v1/mk_voter_codes');
  lookup.searchParams.set('select', 'redeemed');
  lookup.searchParams.set('digest', 'eq.' + digest);
  lookup.searchParams.set('limit', '1');
  const r = await fetch(lookup.toString(), {
    method: 'GET',
    headers: {apikey: key, Accept: 'application/json', 'Cache-Control': 'no-store'},
    signal: AbortSignal.timeout(15000)
  });
  if (!r.ok) {
    console.error('MK_DIAGNOSTIC: read-only code check returned HTTP ' + r.status);
    throw new Error('Code lookup failed');
  }
  const rows = await r.json();
  if (!Array.isArray(rows)) throw new Error('Code lookup invalid response');
  if (!rows.length) return {result: 'missing'};
  return {result: rows[0].redeemed === true ? 'used' : 'ready'};
}

export default async (request) => {
  if (!allowPost(request)) return json({error:'Méthode non autorisée.'},405);
  if (!configured()) return json({error:'Configuration manquante.'},503);
  if (!authorized(request)) return json({error:'Clé administrateur incorrecte.'},401);
  try {
    if (Number(request.headers.get('content-length') || 0) > 2048)
      return json({error:'Requête trop volumineuse.'},413);
    const body = await request.json();
    if (body?.action === 'status') return json(await rpc('election_report'));
    if (body?.action === 'close' && body?.confirm === 'FERMER') return json(await rpc('close_election'));
    if (body?.action === 'check_code') {
      if (typeof body.code !== 'string' || !/^[0-9]{6}$/.test(sanitizeCode(body.code)))
        return json({error:'Code à 6 chiffres requis.'},400);
      return json(await checkCode(body.code));
    }
    return json({error:'Action inconnue.'},400);
  } catch {
    return json({error:'Opération indisponible. Consultez les journaux Netlify.'},503);
  }
};
export const config = {path:'/api/admin'};
