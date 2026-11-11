# Sistema de Gestão do SPAT · Embrapa Agrossilvipastoril

Aplicação web do Setor de Prospecção e Avaliação de Tecnologias (SPAT) para registrar e acompanhar
solicitações de serviços (prospecção, CLPI, instrumentos contratuais, qualificação, avaliação de impacto),
com prazos em dias úteis, aprovações da chefia, cronograma Gantt para acompanhamento e planejamento, indicadores por dimensão,
exportação em Excel (com gráficos) e PowerPoint para a chefia, e autocadastro com validação.

Esta versão roda como site estático no **GitHub Pages** e guarda os dados no **Supabase**
(PostgreSQL com autenticação e regras de segurança por linha). Não há servidor próprio para manter.

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `index.html` | Página do sistema |
| `config.js` | Endereço e chave pública do Supabase |
| `js/catalogo.js` | Dimensões, serviços, etapas e prazos de referência |
| `js/app.js` | Telas e regras do sistema |
| `js/store-supabase.js` | Acesso aos dados (Supabase) |
| `js/export.js` | Geração da planilha .xlsx e da apresentação .pptx |
| `js/marca.js` | Marcas oficiais Embrapa (colorida, negativa, preta) incorporadas |
| `css/styles.css` | Identidade visual (cores Embrapa) |
| `supabase/schema.sql` | Tabelas, anexos, avisos, gatilhos e regras de acesso (RLS) |
| `supabase/email.sql` | Ativação do envio de e-mails e dos lembretes diários |
| `assets/` | Marcas Embrapa em PNG e ícone |
| `.github/workflows/pages.yml` | Publicação automática no GitHub Pages |

## Instalação (cerca de 20 minutos)

### 1. Banco de dados no Supabase
1. Crie uma conta em supabase.com e um projeto novo (região São Paulo).
2. Em **SQL Editor**, cole todo o conteúdo de `supabase/schema.sql` e execute.
3. Em **Authentication → Providers → Email**, mantenha o login por e-mail ativo e a confirmação de e-mail ligada.
4. Em **Authentication → URL Configuration**, informe em *Site URL* o endereço final do GitHub Pages
   (ex.: `https://ORGANIZACAO.github.io/gestao-spat/`).
5. Em **Settings → API Keys**, copie a *Project URL* e a chave **publicável** (`sb_publishable_...`).
   As chaves legadas *anon* estão sendo descontinuadas pelo Supabase até o fim de 2026.

### 2. Repositório no GitHub
1. Crie um repositório (ex.: `gestao-spat`) e envie todos os arquivos desta pasta, incluindo `.github/` e `.nojekyll`.
2. Edite `config.js` com a URL e a chave publicável do passo anterior.
3. Em **Settings → Pages**, escolha *Source: GitHub Actions*.
4. Cada envio para a branch `main` publica o sistema. O endereço aparece na aba **Actions**.

### 3. Primeiro acesso
1. Abra o endereço publicado, clique em **Criar conta** e confirme o e-mail.
2. Preencha o cadastro. **O primeiro cadastro do sistema vira Supervisor (administrador) automaticamente.**
3. Divulgue o endereço. Cada pessoa cria a própria conta, preenche o cadastro e aguarda a validação
   em **Cadastros**.

## Entregas, anexos e avisos

- **Entrega ao solicitante:** ao concluir, o responsável informa o processo SEI, um link clicável (Google Drive, SharePoint) e/ou arquivos, além de uma mensagem. O solicitante vê tudo em destaque na demanda e recebe o aviso.
- **Anexos:** qualquer pessoa com acesso à demanda pode anexar arquivos (até 50 MB, guardados no Supabase Storage, bucket `anexos`), adicionar links ou informar processos SEI.
- **Pendência com o solicitante:** "Aguardar solicitante" exige descrever o que falta. O solicitante é avisado; quando ele responde por mensagem ou anexo, o responsável é avisado.
- **Sino de notificações:** cada pessoa vê suas pendências (alocação, manifestação, aprovação, entrega) e as atualizações recentes. Na instalação própria, é possível ativar alertas do navegador.

## Notificações por e-mail (opcional, recomendado)

O `schema.sql` já registra cada aviso na tabela `notificacoes`. Para que eles também cheguem por e-mail:

1. Crie uma conta gratuita na **Brevo** (brevo.com). O plano gratuito permite 300 e-mails por dia.
2. Em **Senders, Domains & Dedicated IPs → Senders**, cadastre e confirme o e-mail remetente (ex.: o e-mail do SPAT).
3. Em **SMTP & API → API Keys**, gere uma chave de API.
4. No Supabase, abra o **SQL Editor**, cole o arquivo `supabase/email.sql`, substitua a chave e o remetente e clique em **Run**.
5. No sistema, em **Configurações → Notificações**, confira o endereço do sistema e clique em **Enviar e-mail de teste para mim**.

| Aviso | Quem recebe |
|---|---|
| Nova demanda sem responsável e resumo diário | Supervisores |
| Demanda atribuída | Responsável |
| Solicitação recebida | Solicitante |
| O SPAT aguarda sua manifestação e lembrete a cada 3 dias | Solicitante |
| O solicitante respondeu ou enviou mensagem | Responsável |
| Nova mensagem do SPAT | Solicitante |
| Aprovação pendente | Chefe de TT e Chefe-Geral |
| Entrega disponível, com SEI, links e arquivos | Solicitante |

Os lembretes diários rodam de segunda a sexta às 7h (horário de Cuiabá). E-mails para o domínio institucional podem cair no spam nos primeiros envios; peça aos usuários que marquem o remetente como confiável.

## Segurança
- A chave publicável é pública por desenho do Supabase. O que protege os dados são as regras de `schema.sql`:
  - ninguém escolhe o próprio perfil ou se aprova (gatilho `proteger_perfil`);
  - solicitantes leem e alteram apenas as próprias demandas;
  - membros, supervisor e chefias veem todas as demandas;
  - só o supervisor altera configurações, aprova cadastros e exclui demandas.
- Nunca coloque a chave secreta (`sb_secret_...`) ou *service_role* no repositório.
- Para uso institucional com dados sigilosos de PI e contratos, avalie com a área de TI da Embrapa
  a hospedagem em infraestrutura corporativa. O código não depende do Supabase além de `js/store-supabase.js`.

## Personalização
- **Serviços, etapas e prazos:** `js/catalogo.js`. Prazos e serviços oferecidos também podem ser ajustados
  pela tela **Configurações**, sem editar código.
- **Cores:** variáveis no início de `css/styles.css` (verde Pantone 356 e azul Pantone 287 da marca Embrapa).
- **Tipografia:** a família institucional Univers é usada quando instalada no computador; caso contrário,
  o sistema usa Inter.

## Limitações conhecidas
- Prazos em dias úteis não descontam feriados.
