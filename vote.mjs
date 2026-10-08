import {allowPost, bucketHash, codeHash, configured, json, rpc, sanitizeCode} from '../lib/common.mjs';

export default async (request, context) => {
  if (!allowPost(request)) return json({error:'Méthode non autorisée.'},405);
  if (!configured()) return json({error:'Le vote de test n’est pas encore configuré.'},503);
  let payload;
  try {
    if(Number(request.headers.get('content-length')||0)>1024) return json({error:'Requête trop volumineuse.'},413);
    payload=await request.json();
  } catch {return json({error:'Requête invalide.'},400);}
  const normalized=sanitizeCode(payload?.code);
  if (!/^[0-9]{6}$/.test(normalized) || !['oui','non'].includes(payload?.choice))
    return json({error:'Vérifiez votre code et votre choix.'},400);
  try {
    const result=await rpc('cast_ballot', {
      p_digest:codeHash(normalized), p_choice:payload.choice, p_bucket:bucketHash(context?.ip || 'unknown')
    });
    switch (result) {
      case 'ok': return json({ok:true});
      case 'closed': return json({error:'Ce scrutin est clôturé.'},409);
      case 'limited': return json({error:'Trop de tentatives. Réessayez dans 15 minutes.'},429);
      default: return json({error:'Ce code est invalide ou a déjà été utilisé.'},409);
    }
  } catch {
    return json({error:'Serveur temporairement indisponible. Aucun vote confirmé.'},503);
  }
};
export const config={path:'/api/vote'};
