-- TEST election only. Run ONCE in a NEW Supabase project using SQL Editor.
-- Never run against an existing official election: this creates single-election tables.
create table if not exists public.mk_election (
    id integer primary key check (id = 1),
    status text not null default 'open' check (status in ('open','closed')),
    eligible integer not null check (eligible between 1 and 50),
    oui integer not null default 0 check (oui >= 0),
    non integer not null default 0 check (non >= 0),
    check (oui + non <= eligible)
);

-- No name, phone, plaintext code, vote selection or per-code vote time is kept.
create table if not exists public.mk_voter_codes (
    digest text primary key check (digest ~ '^[0-9a-f]{64}$'),
    redeemed boolean not null default false
);

-- Only keyed, rotating buckets are stored, not original IPs.
create table if not exists public.mk_rate_buckets (
    bucket text primary key check (bucket ~ '^[0-9a-f]{64}$'),
    attempts integer not null default 0
);

alter table public.mk_election enable row level security;
alter table public.mk_voter_codes enable row level security;
alter table public.mk_rate_buckets enable row level security;
revoke all on public.mk_election,public.mk_voter_codes,public.mk_rate_buckets from public, anon, authenticated;
grant select,insert,update on public.mk_election,public.mk_voter_codes,public.mk_rate_buckets to service_role;

-- The Netlify function invokes this once per ballot. PostgreSQL transactions and row
-- locks make check+redeem+increment all-or-nothing, including simultaneous submissions.
create or replace function public.cast_ballot(p_digest text, p_choice text, p_bucket text)
returns text
language plpgsql security invoker set search_path = ''
as $$
declare v_attempts integer;
declare v_open text;
declare v_redeemed text;
begin
  if p_choice not in ('oui','non') or
     p_digest is null or p_digest !~ '^[0-9a-f]{64}$' or
     p_bucket is null or p_bucket !~ '^[0-9a-f]{64}$' then
     return 'invalid';
  end if;

  insert into public.mk_rate_buckets(bucket,attempts) values (p_bucket,1)
    on conflict (bucket) do update set attempts = mk_rate_buckets.attempts + 1
    returning attempts into v_attempts;
  if v_attempts > 100 then return 'limited'; end if;

  select status into v_open from public.mk_election where id=1 for update;
  if v_open is null or v_open <> 'open' then return 'closed'; end if;

  update public.mk_voter_codes set redeemed=true
    where digest=p_digest and redeemed=false
    returning digest into v_redeemed;
  if v_redeemed is null then return 'invalid'; end if;

  if p_choice='oui' then
    update public.mk_election set oui=oui+1 where id=1;
  else
    update public.mk_election set non=non+1 where id=1;
  end if;
  return 'ok';
end;
$$;

-- Never disclose partial YES/NO totals while voting is open.
create or replace function public.election_report()
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare v_status text;
declare v_eligible integer;
declare v_oui integer;
declare v_non integer;
begin
  select status,eligible,oui,non into v_status,v_eligible,v_oui,v_non
    from public.mk_election where id=1;
  if v_status is null then return jsonb_build_object('status','uninitialized'); end if;
  if v_status='open' then
    return jsonb_build_object('status','open','eligible',v_eligible,'turnout',v_oui+v_non);
  end if;
  return jsonb_build_object('status','closed','eligible',v_eligible,
                            'turnout',v_oui+v_non,'oui',v_oui,'non',v_non);
end;
$$;

create or replace function public.close_election()
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
begin
  -- Takes the same row lock that cast_ballot acquires, so closure and voting serialize.
  update public.mk_election set status='closed' where id=1;
  return public.election_report();
end;
$$;

-- RPC is accessible only to the server-side secret key; never to browser keys.
revoke execute on function public.cast_ballot(text,text,text) from public,anon,authenticated;
revoke execute on function public.election_report() from public,anon,authenticated;
revoke execute on function public.close_election() from public,anon,authenticated;
grant execute on function public.cast_ballot(text,text,text) to service_role;
grant execute on function public.election_report() to service_role;
grant execute on function public.close_election() to service_role;
