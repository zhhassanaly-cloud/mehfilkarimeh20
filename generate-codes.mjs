#!/usr/bin/env node
// Run once on your own computer. Never upload private/ or commit it to GitHub.
import { randomBytes, randomInt, createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const count=Number(process.argv[2] || '5');
const site=(process.argv[3] || 'https://VOTRE-SITE.netlify.app').replace(/\/$/,'');
if (!Number.isInteger(count) || count<1 || count>50) {
  console.error('Nombre accepté : 1 à 50 (5 pour test, 50 pour scrutin).'); process.exit(1);
}
if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(site)) {
  console.error('Adresse attendue, par exemple https://mon-site.netlify.app'); process.exit(1);
}
const directory=resolve('private');
if (existsSync(directory)) {
  console.error('Le dossier private/ existe déjà. ARRÊT : ne remplacez pas des codes distribués.'); process.exit(1);
}
await mkdir(directory,{recursive:false,mode:0o700});
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const pepper=randomBytes(32).toString('hex');
const adminSecret=randomBytes(32).toString('base64url');
const used=new Set();
const codes=[];
while (codes.length<count) {
  const c=Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');
  if(!used.has(c)){used.add(c);codes.push(c);}
}
const digest=c=>createHmac('sha256',pepper).update(c).digest('hex');
const lines=codes.map(c=>`  ('${digest(c)}')`).join(',\n');
const sql=`-- TEST initialization; do not run twice. Keep this file PRIVATE.\nBEGIN;\n`+
  `INSERT INTO public.mk_election (id,status,eligible,oui,non) VALUES (1,'open',${count},0,0);\n`+
  `INSERT INTO public.mk_voter_codes (digest) VALUES\n${lines};\nCOMMIT;\n`;
const esc=x=>'"'+String(x).replaceAll('"','""')+'"';
const invitations=['code;message'];
for(const raw of codes){
  const code=raw.slice(0,3)+'-'+raw.slice(3);
  const msg=`Mehfil-e-Karima — Élection présidentielle : Mourtouzaly Abidhoussen. Lien : ${site} — Votre code personnel : ${code}. Code à usage unique. Ne le partagez pas.`;
  invitations.push(`${esc(code)};${esc(msg)}`);
}
await writeFile(resolve(directory,'codes-whatsapp.csv'),invitations.join('\n')+'\n',{mode:0o600});
await writeFile(resolve(directory,'initialiser-test.sql'),sql,{mode:0o600});
await writeFile(resolve(directory,'CODE_PEPPER.txt'),pepper+'\n',{mode:0o600});
await writeFile(resolve(directory,'ADMIN_SECRET.txt'),adminSecret+'\n',{mode:0o600});
console.log(`Généré ${count} codes uniques à 6 caractères dans private/ (À GARDER PRIVÉ).`);
console.log('Copiez le SQL du fichier private/initialiser-test.sql dans Supabase SQL Editor.');
console.log('Définissez CODE_PEPPER et ADMIN_SECRET dans Netlify Environment variables.');
console.log('N’envoyez jamais le fichier CSV dans un groupe WhatsApp.');
