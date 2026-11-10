-- =====================================================================
-- Sistema de Gestão do SPAT · Embrapa Agrossilvipastoril
-- Esquema do banco (Supabase / PostgreSQL) com segurança por linha (RLS)
-- Execute uma vez no SQL Editor do projeto Supabase.
-- =====================================================================

-- ---------- Tabelas ----------
create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text,
  matricula text,
  setor text,
  cargo text,
  ramal text,
  papel_solicitado text default 'solicitante',
  justificativa text,
  papel text check (papel in ('solicitante','membro','supervisor','chefe_tt','chefe_geral')),
  status text not null default 'pendente' check (status in ('pendente','ativo','recusado','inativo')),
  criado_em timestamptz not null default now()
);

create table if not exists public.demandas (
  id text primary key,
  dados jsonb not null,
  solicitante uuid not null references auth.users(id),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.config (
  id text primary key,
  dados jsonb not null
);

-- ---------- Funções auxiliares (executam com privilégio do dono) ----------
create or replace function public.papel_atual() returns text
language sql stable security definer set search_path = public as $$
  select papel from public.perfis where id = auth.uid() and status = 'ativo'
$$;

create or replace function public.is_ativo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.perfis where id = auth.uid() and status = 'ativo')
$$;

create or replace function public.is_supervisor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.papel_atual() = 'supervisor', false)
$$;

create or replace function public.ve_tudo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.papel_atual() in ('membro','supervisor','chefe_tt','chefe_geral'), false)
$$;

-- ---------- Proteção do autocadastro ----------
-- Quem se cadastra não escolhe o próprio papel nem a própria situação.
-- O primeiro cadastro do sistema vira Supervisor ativo (administrador inicial).
create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.perfis where papel = 'supervisor' and status = 'ativo') then
      new.papel := 'supervisor'; new.status := 'ativo';
    else
      new.papel := null; new.status := 'pendente';
    end if;
    new.criado_em := now();
  elsif not public.is_supervisor() then
    new.papel := old.papel;
    new.status := case when old.status = 'recusado' then 'pendente' else old.status end;
    new.criado_em := case when old.status = 'recusado' then now() else old.criado_em end;
  end if;
  return new;
end $$;

drop trigger if exists trg_proteger_perfil on public.perfis;
create trigger trg_proteger_perfil before insert or update on public.perfis
for each row execute function public.proteger_perfil();

-- ---------- RLS ----------
alter table public.perfis enable row level security;
alter table public.demandas enable row level security;
alter table public.config enable row level security;

drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select
  using (id = auth.uid() or public.is_ativo());
drop policy if exists perfis_inserir on public.perfis;
create policy perfis_inserir on public.perfis for insert
  with check (id = auth.uid());
drop policy if exists perfis_alterar on public.perfis;
create policy perfis_alterar on public.perfis for update
  using (id = auth.uid() or public.is_supervisor());
drop policy if exists perfis_excluir on public.perfis;
create policy perfis_excluir on public.perfis for delete
  using (public.is_supervisor());

drop policy if exists demandas_ler on public.demandas;
create policy demandas_ler on public.demandas for select
  using (public.ve_tudo() or (public.is_ativo() and solicitante = auth.uid()));
drop policy if exists demandas_inserir on public.demandas;
create policy demandas_inserir on public.demandas for insert
  with check (public.is_ativo() and (solicitante = auth.uid() or public.is_supervisor()));
drop policy if exists demandas_alterar on public.demandas;
create policy demandas_alterar on public.demandas for update
  using (public.ve_tudo() or (public.is_ativo() and solicitante = auth.uid()));
drop policy if exists demandas_excluir on public.demandas;
create policy demandas_excluir on public.demandas for delete
  using (public.is_supervisor());

drop policy if exists config_ler on public.config;
create policy config_ler on public.config for select
  using (auth.role() = 'authenticated');
drop policy if exists config_gravar on public.config;
create policy config_gravar on public.config for all
  using (public.is_supervisor()) with check (public.is_supervisor());

-- ---------- Tempo real ----------
do $$ begin
  begin alter publication supabase_realtime add table public.demandas; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.perfis;   exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.config;   exception when duplicate_object then null; end;
end $$;
