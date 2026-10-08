let adminKey = '';
const byId = id => document.getElementById(id);
async function request(action, extra = {}) {
  const r = await fetch('/api/admin', {
    method:'POST', headers:{Authorization:'Bearer ' + adminKey,'Content-Type':'application/json'},
    cache:'no-store',body:JSON.stringify({action,...extra})
  });
  let data;
  try { data = await r.json(); } catch { throw Error('Réponse de serveur invalide'); }
  if(!r.ok) throw Error(data.error || 'Accès refusé');
  return data;
}
function render(data) {
  if (!['open','closed'].includes(data.status)) throw Error('Scrutin non initialisé.');
  if (![data.turnout,data.eligible,data.oui,data.non].every(Number.isInteger))
    throw Error('Mise à jour Supabase requise pour afficher les résultats.');
  byId('dashboard').hidden = false;
  const open = data.status === 'open';
  byId('open-actions').hidden = !open;
  byId('provisional').hidden = !open;
  byId('status').textContent = open
    ? 'Scrutin ouvert — résultats provisoires.'
    : 'Scrutin clôturé — résultats définitifs.';
  for (const [field,val] of [['eligible',data.eligible],['turnout',data.turnout],
    ['yes-count',data.oui],['no-count',data.non]]) byId(field).textContent = val;
  byId('refresh').textContent = open ? 'Actualiser les résultats' : 'Rafraîchir le tableau de bord';
}
byId('login-form').addEventListener('submit',async ev=>{
  ev.preventDefault();adminKey = byId('secret').value;
  try {render(await request('status'));byId('login-form').hidden = true;byId('secret').value = '';}
  catch(e) { byId('status').textContent=e.message;adminKey=''; }
});
byId('refresh').addEventListener('click', async()=>{
  const button=byId('refresh'); button.disabled=true;
  try {render(await request('status'));}
  catch(e) {byId('status').textContent=e.message;}
  finally {button.disabled=false;}
});
byId('close').addEventListener('click',async()=>{
  if(!confirm('Voulez-vous clôturer définitivement le scrutin ? Aucun autre vote ne sera accepté.'))return;
  try {render(await request('close',{confirm:'FERMER'}));}
  catch(e) {byId('status').textContent=e.message;}
});
