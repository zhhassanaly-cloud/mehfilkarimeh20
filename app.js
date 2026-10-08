// Single-purpose French ballot UI. Actual one-code-one-vote enforcement lives on the server.
// For the standalone HTML preview only, __DEMO_MODE__ is replaced with true.
const DEMO_MODE = false;
const DEMO_LOCK = 'mehfil-karima-v5-demo-finished';
let screen = 'welcome';
let code = '';
let choice = null;
let finished = false;
let submitting = false;
let personalizedLink = false;
const $ = (q) => document.querySelector(q);
const $$ = (q) => [...document.querySelectorAll(q)];
const sequence = ['welcome','code','ballot','review','thank-you'];

function show(id) {
  if (finished) id = 'thank-you';
  screen = id;
  for (const section of $$('.screen')) section.classList.toggle('active', section.id === id);
  const position = sequence.indexOf(id);
  $$('#progress span').forEach((item,i) => item.classList.toggle('done', i <= Math.min(position,3)));
  if (id === 'code') $('#voting-code').focus();
  window.scrollTo?.({top:0,behavior:'instant'});
}
function normalizeCode(value) {
  return String(value || '').replace(/\D/g,'');
}
function message(element, text) { element.textContent=text; element.hidden=!text; }
function select(choiceValue) {
  choice = choiceValue;
  for (const item of $$('.choice')) item.setAttribute('aria-checked', String(item.dataset.choice === choiceValue));
  $('#review-button').disabled = false;
}
$$('[data-next]').forEach(button => button.addEventListener('click',()=>show(button.dataset.next)));
$$('[data-back]').forEach(button => button.addEventListener('click',()=>show(button.dataset.back)));
// Personalized invitations use a fragment (#code=...) rather than a query parameter.
// Fragments are not sent to Netlify in the HTTP request. Remove it from the address
// immediately after parsing; never store the credential in localStorage.
function loadPersonalInvitation() {
  const fragment = window.location.hash.slice(1);
  if (!fragment) return;
  let submitted = '';
  try { submitted = new URLSearchParams(fragment).get('code') || ''; } catch { /* ignore */ }
  try { window.history.replaceState(null, '', window.location.pathname); } catch { /* ignore */ }
  const normalized = normalizeCode(submitted);
  if (!/^\d{3}-?\d{3}$/.test(submitted) || normalized.length !== 6) return;
  code = normalized;
  personalizedLink = true;
  $('#voting-code').value = code.slice(0,3) + '-' + code.slice(3);
  const welcomeButton = $('#welcome [data-next]');
  welcomeButton.dataset.next = 'ballot';
  welcomeButton.innerHTML = 'Accéder à mon vote <span aria-hidden="true">→</span>';
  const label = $('#invitation-label');
  if (label) label.hidden = false;
}

$('#code-form').addEventListener('submit',ev=>{
  ev.preventDefault();
  const normalized = normalizeCode($('#voting-code').value);
  if(normalized.length !== 6) {message($('#code-error'),'Veuillez saisir le code personnel à 6 chiffres reçu sur WhatsApp.');return;}
  code=normalized;
  message($('#code-error'),'');
  show('ballot');
});
$('#voting-code').addEventListener('input',()=>{
  const input = $('#voting-code');
  const raw = normalizeCode(input.value).slice(0,6);
  input.value = raw.length > 3 ? raw.slice(0,3)+'-'+raw.slice(3) : raw;
  message($('#code-error'),'');
});
$$('[data-choice]').forEach(button=>button.addEventListener('click',()=>select(button.dataset.choice)));
$('#review-button').addEventListener('click',()=>{
  if (!choice) return;
  $('#review-choice').textContent = choice === 'oui'?'OUI':'NON';
  message($('#submit-error'),'');
  show('review');
});
$('#submit-vote').addEventListener('click',async()=>{
  if (submitting || finished || !choice || !code) return;
  submitting=true;
  $('#submit-vote').disabled=true;
  $('#submit-vote').textContent='Validation en cours…';
  message($('#submit-error'),'');
  try {
    if (DEMO_MODE) {
      if (window.localStorage.getItem(DEMO_LOCK)==='done') throw Error('Cet aperçu a déjà été terminé sur ce navigateur.');
      window.localStorage.setItem(DEMO_LOCK,'done');
      $('#thank-message').textContent='Votre simulation est terminée.';
      $('#thank-demo').hidden=false;
    } else {
      const response=await fetch('/api/vote',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({code:code,choice:choice}),cache:'no-store'
      });
      const data=await response.json();
      if (!response.ok) throw Error(data.error || 'Le vote n’a pas pu être enregistré.');
    }
    finished=true;
    code=''; choice=null;
    $('#voting-code').value='';
    show('thank-you');
  }catch(err){
    message($('#submit-error'),err.message || 'Erreur de connexion. Veuillez réessayer.');
  } finally {
    submitting=false;
    $('#submit-vote').disabled=finished;
    $('#submit-vote').innerHTML='Confirmer mon vote <span aria-hidden="true">✓</span>';
  }
});
if(DEMO_MODE){
  $('#demo-chip').hidden=false;
  if (window.localStorage.getItem(DEMO_LOCK)==='done'){
    finished=true;
    $('#thank-message').textContent='Cette simulation a déjà été terminée sur ce navigateur.';
    $('#thank-demo').hidden=false;
  }
}
loadPersonalInvitation();
show(finished?'thank-you':'welcome');
