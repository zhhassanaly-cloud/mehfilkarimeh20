# Mehfil-e-Karima — Version 7 (Netlify + Supabase)

**For TESTING only.** French-language presidential ballot, candidate **Mourtouzaly Abidhoussen**, original shrine graphic, personal 6-character code, OUI/NON, thank-you screen, and an admin-only results dashboard after closure.

This project is a custom prototype, **not an audited secret-ballot system**. It prevents reuse of a code atomically in PostgreSQL, but cannot guarantee secrecy against server/platform administrators, timing correlation, bugs or malicious operators. Do not use it for the real election of 50 members without independent technical and election-process review.

## Your first deployment — step by step

### A. Put the public website on Netlify

1. Create accounts on [GitHub](https://github.com/) and [Netlify](https://app.netlify.com/).
2. Unzip this package, and create a **new GitHub repository**. Upload the **contents** of this folder into the repository root (including `netlify.toml`, `public/`, `netlify/` and `supabase/`). Do **not** upload `private/` or any `.env` file. `private/` is gitignored, but verify nothing sensitive was added.
3. In Netlify choose **Add new project → Import an existing project → GitHub**, select your repository, then deploy. The `netlify.toml` already says: publish directory = `public`; Functions directory = `netlify/functions`; there is no build command.
4. Write down your new HTTPS `https://YOUR-NAME.netlify.app` URL. The welcome page should already open. Voting submissions will not work until you complete the database and secrets steps below.

### B. Set up your persistent Supabase database

5. Create a free project on [Supabase](https://supabase.com/). Keep your Supabase **database password** private.
6. In **SQL Editor**, paste the full content of `supabase/schema.sql`, then click **Run**. This creates the election tables and PostgreSQL functions. No votes or codes exist yet.
7. In **Project Settings → API Keys**, copy your **secret key** beginning `sb_secret_` (not the publishable key), and your **Project URL**, usually `https://YOURPROJECT.supabase.co`. Do **not** add either secret key to GitHub or the website JavaScript.

### C. Generate five dummy codes on your own computer

8. Install [Node.js LTS](https://nodejs.org/) on your computer (not on the website). Open a terminal inside the unzipped V7 folder and run:

   ```sh
   node scripts/generate-codes.mjs 5 https://YOUR-NAME.netlify.app
   ```

   **Generate 5 fake test credentials now, not 50 real credentials.** This creates a **private/** directory on your own computer containing:

   - `codes-whatsapp.csv`: test invitations and their short codes
   - `initialiser-test.sql`: database initialization using **hashed** code values
   - `CODE_PEPPER.txt`: a separate private code-hashing secret
   - `ADMIN_SECRET.txt`: password for `/admin.html`

   If you rerun this command while `private/` exists, it deliberately refuses, rather than overwrite already-generated codes.
9. In the Supabase **SQL Editor**, paste the contents of `private/initialiser-test.sql` and **Run**. Only the hashed versions of the five codes are stored in Supabase. **Do not paste or upload your CSV or secret files.**

### D. Connect Netlify Functions to Supabase

10. In **Netlify → Project configuration → Environment variables**, create these **four environment variables**, scoped to Functions or all scopes (never in `netlify.toml`):

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | `https://YOURPROJECT.supabase.co` |
   | `SUPABASE_SECRET_KEY` | Your Supabase **secret** key (`sb_secret_...`) |
   | `CODE_PEPPER` | Exact text from `private/CODE_PEPPER.txt` |
   | `ADMIN_SECRET` | Exact text from `private/ADMIN_SECRET.txt` |

11. **Redeploy** the Netlify site after setting the variables.
12. Visit your Netlify URL. Enter a test code from `codes-whatsapp.csv`, choose OUI or NON, review, and confirm. A second attempt using the same code should be rejected, including from a different browser.
13. Open `https://YOUR-NAME.netlify.app/admin.html` and enter the secret from `ADMIN_SECRET.txt`. During the election you can see turnout only, not totals. Click **Clôturer définitivement le scrutin** to close your dummy election. Then the final OUI/NON totals appear. Closure is irreversible in this test database.

**No real members should be invited during this test.** To start a fresh real election, use a **new, reviewed environment** and new independently issued credentials. Do not erase test data or reset an election database during an active vote.

## How the security works (and its limits)

- Six readable random characters (`ABC-7D9` style), excluding `I`, `O`, `0`, and `1`. Codes are created with a cryptographic random-number generator.
- One vote per credential, enforced on the server **in one PostgreSQL transaction** with locks. Netlify instances cannot independently bypass this check.
- The codes sent on WhatsApp exist **only in the local private CSV**. Supabase stores HMAC-SHA-256 digests, not raw codes. Never send the CSV to a WhatsApp group.
- Voter identities and WhatsApp numbers must remain with an **independent election officer**, in a separate protected register. They are not stored in the voting database.
- PostgreSQL stores a per-code **used** flag and only **aggregate** OUI/NON counts; no table intentionally stores the choice next to the code. Admin dashboard sees the totals only after closure.
- Supabase `anon`/`authenticated` table access and voting RPC execution are revoked; service key remains in Netlify Functions only. No browser-side database password or secret.
- A 15-minute, per-IP-based hashed attempt bucket provides **basic** guessing resistance (100 attempts per bucket). It does not stop distributed attacks or a stolen/forwarded code. A code identifies the possessor, not necessarily the authorized member.
- The Netlify/Supabase operators, logs, snapshots, timing and server-side code are still able to weaken anonymity or compromise outcomes; **this is not a cryptographically end-to-end-verifiable system**. For the actual election, use audited encrypted voting, independent trustees, credential distribution controls, a formal closing rule, and an incident/recovery plan.
- If a vote is committed but the browser loses connection before receiving the acknowledgment, trying the same code may display "used". This demonstration does not yet provide an anonymous receipt-verification protocol.
- Back up your database and protect GitHub and hosting accounts with MFA. On free plans, review quotas, project-inactivity pauses and hosting limits before inviting anyone.

## Project files

- `public/index.html` + `styles.css` + `shrine-original.png` — French voting interface, original shrine image
- `public/app.js` — client flow: welcome → code → OUI/NON → confirmation → merci
- `public/admin.html` + `admin.js` — result access and election closure
- `netlify/functions/vote.mjs` — validates code and sends hashed vote to Supabase RPC
- `netlify/functions/admin.mjs` — restricted election controls
- `supabase/schema.sql` — persistent tables, transaction-safe code consumption, tally functions and database permissions
- `scripts/generate-codes.mjs` — local generator for codes, SQL and private secrets
- `apercu-sans-serveur.html` — offline visual demo only (NO REAL VOTES SAVED)

## Automated tests

With Node.js 20 or later:

```sh
npm test
```

The tests mock Supabase so they cover the Node request handlers, error paths and code generator **but are not a live Supabase integration, stress or security audit**. Verify the database transaction behavior on the deployed test project before any real election.
