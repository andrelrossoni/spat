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

-- =====================================================================
-- ANEXOS (arquivos de entrega e documentos) · Supabase Storage
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('anexos', 'anexos', false, 52428800)
on conflict (id) do update set file_size_limit = excluded.file_size_limit, public = false;

create or replace function public.pode_ver_demanda(did text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.ve_tudo()
      or exists (select 1 from public.demandas where id = did and solicitante = auth.uid() and public.is_ativo())
$$;

drop policy if exists spat_anexos_ler on storage.objects;
create policy spat_anexos_ler on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and public.pode_ver_demanda((storage.foldername(name))[1]));
drop policy if exists spat_anexos_enviar on storage.objects;
create policy spat_anexos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and public.pode_ver_demanda((storage.foldername(name))[1]));
drop policy if exists spat_anexos_excluir on storage.objects;
create policy spat_anexos_excluir on storage.objects for delete to authenticated
  using (bucket_id = 'anexos' and (public.is_supervisor() or owner_id = auth.uid()::text));

-- =====================================================================
-- NOTIFICAÇÕES POR E-MAIL
-- Registra cada aviso na tabela notificacoes e, se o serviço de e-mail
-- estiver configurado (ver supabase/email.sql), envia o e-mail via Brevo.
-- Nada aqui impede o salvamento de uma demanda: erros viram apenas avisos no log.
-- =====================================================================
create extension if not exists pg_net;

create table if not exists public.notificacoes (
  id bigserial primary key,
  para uuid not null references auth.users(id) on delete cascade,
  demanda_id text,
  tipo text not null,
  assunto text not null,
  criada_em timestamptz not null default now(),
  email text,
  email_situacao text
);
alter table public.notificacoes enable row level security;
drop policy if exists notif_ler on public.notificacoes;
create policy notif_ler on public.notificacoes for select using (para = auth.uid() or public.is_supervisor());

create or replace function public.spat_uuid(t text) returns uuid language plpgsql immutable as $$
begin return t::uuid; exception when others then return null; end $$;

create or replace function public.spat_esc(t text) returns text language sql immutable as $$
  select replace(replace(replace(replace(coalesce(t,''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;')
$$;

create or replace function public.spat_nome(u uuid) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select nome from public.perfis where id = u), 'Usuário')
$$;

create or replace function public.spat_segredo(n text) returns text
language sql stable security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = n limit 1
$$;
revoke all on function public.spat_segredo(text) from public, anon, authenticated;

create or replace function public.spat_avisar(p_para uuid, p_did text, p_tipo text, p_assunto text, p_html text)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text; v_chave text; v_rem text; v_url text; v_link text; v_corpo text; v_sit text := 'e-mail não configurado';
begin
  if p_para is null then return; end if;
  select email into v_email from auth.users where id = p_para;
  v_chave := public.spat_segredo('spat_brevo_api_key');
  v_rem   := public.spat_segredo('spat_email_remetente');
  select dados->>'url' into v_url from public.config where id = 'sistema';
  if v_email is not null and v_chave is not null and v_rem is not null then
    v_link := case when v_url is null then null when p_did is null then v_url else v_url || '#d-' || p_did end;
    v_corpo := '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#17233B;max-width:620px">'
      || '<div style="border-bottom:4px solid #00783E;padding:10px 0 12px;margin-bottom:18px"><b style="color:#29428C;font-size:17px">Sistema de Gestão do SPAT</b><br>'
      || '<span style="color:#566377;font-size:13px">Embrapa Agrossilvipastoril · Setor de Prospecção e Avaliação de Tecnologias</span></div>'
      || p_html
      || case when v_link is not null then '<p style="margin:26px 0"><a href="' || public.spat_esc(v_link) || '" style="background:#00783E;color:#ffffff;padding:12px 22px;border-radius:5px;text-decoration:none;font-weight:bold">Abrir no sistema</a></p>' else '' end
      || '<p style="color:#566377;font-size:12px;border-top:1px solid #D8E0DE;padding-top:10px;margin-top:24px">Mensagem automática. Para responder, use a área de mensagens da demanda no sistema.</p></div>';
    perform net.http_post(
      url := 'https://api.brevo.com/v3/smtp/email',
      body := jsonb_build_object(
        'sender', jsonb_build_object('name', 'SPAT · Embrapa Agrossilvipastoril', 'email', v_rem),
        'to', jsonb_build_array(jsonb_build_object('email', v_email)),
        'subject', p_assunto,
        'htmlContent', v_corpo),
      headers := jsonb_build_object('api-key', v_chave, 'Content-Type', 'application/json', 'accept', 'application/json'));
    v_sit := 'enviado para a fila';
  end if;
  insert into public.notificacoes(para, demanda_id, tipo, assunto, email, email_situacao)
  values (p_para, p_did, p_tipo, p_assunto, v_email, v_sit);
exception when others then
  raise warning 'spat_avisar falhou: %', sqlerrm;
end $$;
revoke all on function public.spat_avisar(uuid, text, text, text, text) from public, anon, authenticated;

create or replace function public.spat_notificar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d jsonb := new.dados; o jsonb;
  v_cod text; v_cab text; v_sol uuid := new.solicitante; v_resp uuid; v_ator uuid := auth.uid();
  r record; a jsonb; h jsonb; v_por uuid; v_itens text := ''; v_url text; n_old int; n_new int; i int;
begin
  begin
    if coalesce(d->>'exemplo', 'false') = 'true' then return new; end if;
    v_cod  := coalesce(d->>'cod', new.id);
    v_resp := public.spat_uuid(d->>'responsavel');
    v_cab  := '<p style="margin:0 0 4px;color:#566377;font-size:13px">' || public.spat_esc(v_cod) || '</p>'
           || '<h2 style="margin:0 0 14px;font-size:19px;color:#17233B">' || public.spat_esc(d->>'titulo') || '</h2>';

    if tg_op = 'INSERT' then
      if d->>'status' = 'aberta' and v_resp is null then
        for r in select id from public.perfis where papel = 'supervisor' and status = 'ativo' and id is distinct from v_ator loop
          perform public.spat_avisar(r.id, new.id, 'alocacao', 'Nova demanda aguardando responsável: ' || v_cod,
            v_cab || '<p>Nova demanda registrada por <b>' || public.spat_esc(public.spat_nome(v_sol)) || '</b>. Ela aguarda a definição de quem vai conduzi-la.</p>');
        end loop;
      end if;
      if coalesce(d->>'origem', '') <> 'interna' and d->>'status' <> 'planejada' then
        perform public.spat_avisar(v_sol, new.id, 'recebida', 'Solicitação recebida pelo SPAT: ' || v_cod,
          v_cab || '<p>Recebemos sua solicitação. A entrega está prevista para <b>'
          || to_char((d->>'prazo')::timestamptz at time zone 'America/Cuiaba', 'DD/MM/YYYY')
          || '</b>. Você receberá um aviso sempre que o SPAT precisar de algo ou quando o trabalho estiver pronto.</p>');
      end if;
      return new;
    end if;

    o := old.dados;

    -- ação planejada que começou sem responsável
    if d->>'status' = 'aberta' and o->>'status' = 'planejada' and v_resp is null then
      for r in select id from public.perfis where papel = 'supervisor' and status = 'ativo' loop
        perform public.spat_avisar(r.id, new.id, 'alocacao', 'Ação iniciada sem responsável: ' || v_cod,
          v_cab || '<p>Esta ação planejada foi iniciada e ainda não tem responsável.</p>');
      end loop;
    end if;

    -- responsável definido
    if v_resp is not null and v_resp is distinct from public.spat_uuid(o->>'responsavel') and v_resp is distinct from v_ator then
      perform public.spat_avisar(v_resp, new.id, 'atribuida', 'Demanda atribuída a você: ' || v_cod,
        v_cab || '<p>Você é o responsável por esta demanda. Previsão de entrega: <b>'
        || to_char((d->>'prazo')::timestamptz at time zone 'America/Cuiaba', 'DD/MM/YYYY') || '</b>.</p>');
    end if;

    -- pendência com o solicitante
    if d->>'status' = 'aguardando' and coalesce(o->>'status', '') <> 'aguardando' and v_sol is distinct from v_ator and coalesce(d->>'origem', '') <> 'interna' then
      perform public.spat_avisar(v_sol, new.id, 'pendencia', 'O SPAT aguarda sua manifestação: ' || v_cod,
        v_cab || '<p>A equipe do SPAT precisa de uma informação sua para continuar:</p>'
        || '<div style="border-left:4px solid #C9820F;background:#FBF0DC;padding:10px 14px;margin:0 0 12px">'
        || replace(public.spat_esc(d->>'pendencia'), E'\n', '<br>') || '</div>'
        || '<p>O prazo fica suspenso até a sua resposta. Responda pela área de mensagens da demanda ou anexe o documento pedido.</p>');
    end if;

    -- solicitante respondeu
    if coalesce(d->>'respondido', 'false') = 'true' and coalesce(o->>'respondido', 'false') <> 'true' then
      if v_resp is not null then
        perform public.spat_avisar(v_resp, new.id, 'resposta', 'O solicitante respondeu: ' || v_cod,
          v_cab || '<p><b>' || public.spat_esc(public.spat_nome(v_sol)) || '</b> respondeu à pendência. Confira e retome o atendimento.</p>');
      else
        for r in select id from public.perfis where papel = 'supervisor' and status = 'ativo' loop
          perform public.spat_avisar(r.id, new.id, 'resposta', 'O solicitante respondeu: ' || v_cod,
            v_cab || '<p>O solicitante respondeu à pendência. A demanda ainda não tem responsável.</p>');
        end loop;
      end if;
    end if;

    -- aprovação da chefia
    if coalesce(d->>'aguardaChefia', 'false') = 'true' and coalesce(o->>'aguardaChefia', 'false') <> 'true' then
      for r in select id from public.perfis where papel in ('chefe_tt', 'chefe_geral') and status = 'ativo' loop
        perform public.spat_avisar(r.id, new.id, 'aprovacao', 'Aprovação pendente: ' || v_cod,
          v_cab || '<p>Esta demanda chegou à etapa de aprovação da chefia e aguarda sua decisão no sistema.</p>');
      end loop;
    end if;

    -- entrega concluída
    if d->>'status' = 'concluida' and coalesce(o->>'status', '') <> 'concluida' and v_sol is distinct from v_ator then
      for a in select x from jsonb_array_elements(coalesce(d->'anexos', '[]'::jsonb)) as t(x) loop
        if coalesce(a->>'entrega', 'false') = 'true' then
          if a->>'tipo' = 'sei' then
            v_itens := v_itens || '<li>Processo SEI nº <b>' || public.spat_esc(a->>'sei') || '</b></li>';
          elsif a->>'tipo' = 'link' and (a->>'url') ~* '^https?://' then
            v_itens := v_itens || '<li><a href="' || public.spat_esc(a->>'url') || '">' || public.spat_esc(coalesce(nullif(a->>'nome', ''), a->>'url')) || '</a></li>';
          elsif a->>'tipo' = 'arquivo' then
            v_itens := v_itens || '<li>Arquivo ' || public.spat_esc(a->>'nome') || ' (disponível para download no sistema)</li>';
          end if;
        end if;
      end loop;
      perform public.spat_avisar(v_sol, new.id, 'entrega', 'Entrega disponível: ' || v_cod,
        v_cab || '<p>O trabalho solicitado ao SPAT está pronto.</p>'
        || case when coalesce(d->'entrega'->>'obs', '') <> '' then '<div style="background:#F2F5F4;padding:10px 14px;margin:0 0 12px">' || replace(public.spat_esc(d->'entrega'->>'obs'), E'\n', '<br>') || '</div>' else '' end
        || case when v_itens <> '' then '<p style="margin-bottom:4px"><b>Entrega:</b></p><ul style="margin-top:0">' || v_itens || '</ul>' else '' end);
    end if;

    -- novas mensagens (as automáticas já estão nos avisos acima)
    n_old := jsonb_array_length(coalesce(o->'historico', '[]'::jsonb));
    n_new := jsonb_array_length(coalesce(d->'historico', '[]'::jsonb));
    if n_new > n_old then
      for i in n_old .. n_new - 1 loop
        h := d->'historico'->i;
        if h->>'tipo' = 'comentario' and coalesce(h->>'interna', 'false') <> 'true' and coalesce(h->>'auto', 'false') <> 'true' then
          v_por := public.spat_uuid(h->>'por');
          if v_por = v_sol and v_resp is not null and v_resp is distinct from v_por then
            perform public.spat_avisar(v_resp, new.id, 'mensagem', 'Nova mensagem do solicitante: ' || v_cod,
              v_cab || '<p><b>' || public.spat_esc(public.spat_nome(v_por)) || '</b> escreveu:</p><div style="background:#F2F5F4;padding:10px 14px">' || replace(public.spat_esc(h->>'t'), E'\n', '<br>') || '</div>');
          elsif v_por is distinct from v_sol and coalesce(d->>'origem', '') <> 'interna' then
            perform public.spat_avisar(v_sol, new.id, 'mensagem', 'Nova mensagem do SPAT: ' || v_cod,
              v_cab || '<p><b>' || public.spat_esc(public.spat_nome(v_por)) || '</b> escreveu:</p><div style="background:#F2F5F4;padding:10px 14px">' || replace(public.spat_esc(h->>'t'), E'\n', '<br>') || '</div>');
          end if;
        end if;
      end loop;
    end if;
  exception when others then
    raise warning 'spat_notificar falhou: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists trg_spat_notificar on public.demandas;
create trigger trg_spat_notificar after insert or update on public.demandas
for each row execute function public.spat_notificar();

-- Lembretes diários (agendados em supabase/email.sql)
create or replace function public.spat_lembretes() returns void
language plpgsql security definer set search_path = public as $$
declare r record; s record; v_dias int; v_lista text := ''; n int := 0;
begin
  for r in select id, solicitante, dados from public.demandas
           where dados->>'status' = 'aguardando' and coalesce(dados->>'respondido', 'false') <> 'true'
             and coalesce(dados->>'exemplo', 'false') <> 'true' and dados->>'pausadoEm' is not null loop
    v_dias := current_date - ((r.dados->>'pausadoEm')::timestamptz at time zone 'America/Cuiaba')::date;
    if v_dias >= 2 and v_dias % 3 = 2 then
      perform public.spat_avisar(r.solicitante, r.id, 'lembrete', 'Lembrete: o SPAT aguarda sua manifestação · ' || coalesce(r.dados->>'cod', r.id),
        '<h2 style="margin:0 0 14px;font-size:19px">' || public.spat_esc(r.dados->>'titulo') || '</h2><p>Há ' || v_dias || ' dias o SPAT aguarda sua resposta para continuar:</p>'
        || '<div style="border-left:4px solid #C9820F;background:#FBF0DC;padding:10px 14px">' || replace(public.spat_esc(r.dados->>'pendencia'), E'\n', '<br>') || '</div>');
    end if;
  end loop;
  for r in select id, dados from public.demandas
           where dados->>'status' = 'aberta' and coalesce(dados->>'responsavel', '') = '' and coalesce(dados->>'exemplo', 'false') <> 'true'
           order by dados->>'criadoEm' loop
    n := n + 1;
    v_lista := v_lista || '<li><b>' || public.spat_esc(r.dados->>'cod') || '</b> · ' || public.spat_esc(r.dados->>'titulo') || '</li>';
  end loop;
  if n > 0 then
    for s in select id from public.perfis where papel = 'supervisor' and status = 'ativo' loop
      perform public.spat_avisar(s.id, null, 'resumo', 'Resumo do dia: ' || n || ' demanda(s) aguardando responsável',
        '<p>Estas demandas ainda não têm responsável:</p><ul>' || v_lista || '</ul>');
    end loop;
  end if;
end $$;
revoke all on function public.spat_lembretes() from public, anon, authenticated;

-- Teste de e-mail (botão em Configurações, apenas supervisor)
create or replace function public.spat_teste_email() returns text
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if not public.is_supervisor() then raise exception 'Apenas o supervisor pode testar o e-mail.'; end if;
  if public.spat_segredo('spat_brevo_api_key') is null or public.spat_segredo('spat_email_remetente') is null then
    return 'E-mail ainda não configurado: execute o supabase/email.sql com a chave da Brevo e o remetente.';
  end if;
  select email into v_email from auth.users where id = auth.uid();
  perform public.spat_avisar(auth.uid(), null, 'teste', 'Teste de e-mail do Sistema SPAT',
    '<p>Se você recebeu esta mensagem, as notificações por e-mail do Sistema SPAT estão funcionando.</p>');
  return 'E-mail de teste enviado para ' || v_email || '. Confira também a caixa de spam.';
end $$;
revoke all on function public.spat_nome(uuid) from public, anon, authenticated;
