-- =====================================================================
-- Ativação das notificações por e-mail · Sistema de Gestão do SPAT
-- Execute DEPOIS do schema.sql. Antes, substitua os dois valores entre aspas.
-- =====================================================================

-- 1. Chave de API da Brevo (brevo.com > SMTP & API > API Keys > Generate a new API key)
select vault.create_secret('COLE-AQUI-A-CHAVE-DA-BREVO', 'spat_brevo_api_key');

-- 2. Remetente: e-mail verificado na Brevo (Senders, Domains & Dedicated IPs > Senders)
select vault.create_secret('spat.remetente@exemplo.com', 'spat_email_remetente');

-- 3. Lembretes diários, de segunda a sexta às 7h de Cuiabá (11h UTC):
--    - solicitante com pendência há 2 dias ou mais (repetido a cada 3 dias)
--    - resumo para os supervisores das demandas sem responsável
create extension if not exists pg_cron;
select cron.unschedule('spat-lembretes') where exists (select 1 from cron.job where jobname = 'spat-lembretes');
select cron.schedule('spat-lembretes', '0 11 * * 1-5', 'select public.spat_lembretes()');

-- ---------------------------------------------------------------------
-- Para TROCAR a chave ou o remetente depois:
--   select vault.update_secret((select id from vault.secrets where name = 'spat_brevo_api_key'), 'NOVA-CHAVE');
--   select vault.update_secret((select id from vault.secrets where name = 'spat_email_remetente'), 'novo@remetente');
-- Para conferir os últimos envios (resposta da Brevo):
--   select status_code, content, created from net._http_response order by created desc limit 10;
-- Para ver os avisos registrados:
--   select criada_em, tipo, assunto, email, email_situacao from public.notificacoes order by id desc limit 20;
