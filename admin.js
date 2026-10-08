let adminKey='';
const byId=id=>document.getElementById(id);
async function request(action, extra={}){
  const r=await fetch('/api/admin',{
    method:'POST', headers:{Authorization:'Bearer '+adminKey, 'Content-Type':'application/json'},
    cache:'no-store', body:JSON.stringify({action,...extra})
  });
  let data;try{data=await r.json();}catch{throw Error('Réponse de serveur invalide');}
  if(!r.ok)throw Error(data.error||'Accès refusé');
  return data;
}
function render(data){
  byId('dashboard').hidden=false;
  byId('awaiting').hidden=data.status!=='open';
  byId('closed').hidden=data.status!=='closed';
  byId('status').textContent=data.status==='open'?'Scrutin ouvert. Résultats masqués.':'Scrutin clôturé. Résultats définitifs.';
  if(data.status==='closed'){
    byId('eligible').textContent=data.eligible;
    byId('turnout').textContent=data.turnout;
    byId('yes-count').textContent=data.oui;
    byId('no-count').textContent=data.non;
  }
}
byId('login-form').addEventListener('submit',async ev=>{
  ev.preventDefault();adminKey=byId('secret').value;
  try {render(await request('status'));byId('login-form').hidden=true;byId('secret').value='';}
  catch(e){byId('status').textContent=e.message;adminKey='';}
});
byId('close').addEventListener('click',async()=>{
  if(!confirm('Voulez-vous clôturer définitivement le scrutin ? Aucun autre vote ne sera accepté.'))return;
  try{render(await request('close',{confirm:'FERMER'}));}
  catch(e){byId('status').textContent=e.message;}
});
