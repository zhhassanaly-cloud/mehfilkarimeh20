import {allowPost,authorized,configured,json,rpc} from '../lib/common.mjs';
export default async (request) => {
  if(!allowPost(request)) return json({error:'Méthode non autorisée.'},405);
  if(!configured()) return json({error:'Configuration manquante.'},503);
  if(!authorized(request)) return json({error:'Clé administrateur incorrecte.'},401);
  try {
    const body=await request.json();
    if (body?.action==='status') return json(await rpc('election_report'));
    if (body?.action==='close' && body?.confirm==='FERMER') return json(await rpc('close_election'));
    return json({error:'Action inconnue.'},400);
  } catch {return json({error:'Opération indisponible.'},503);}
};
export const config={path:'/api/admin'};
