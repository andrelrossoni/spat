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
| `supabase/schema.sql` | Tabelas, gatilho de autocadastro e regras de acesso (RLS) |
| `assets/` | Marcas Embrapa em PNG e ícone |
| `.github/workflows/pages.yml` | Publicação automática no GitHub Pages |

## Instalação (cerca de 20 minutos)

### 1. Banco de dados no Supabase
1. Crie uma conta em supabase.com e um projeto novo (região São Paulo).
2. Em **SQL Editor**, cole todo o conteúdo de `supabase/schema.sql` e execute.
3. Em **Authentication → Providers → Email**, mantenha o login por e-mail ativo e a confirmação de e-mail ligada.
4. Em **Authentication → URL Configuration**, informe em *Site URL* o endereço final do GitHub Pages
   (ex.: `https://ORGANIZACAO.github.io/gestao-spat/`).
5. Em **Project Settings → API**, copie a *Project URL* e a chave *anon public*.

### 2. Repositório no GitHub
1. Crie um repositório (ex.: `gestao-spat`) e envie todos os arquivos desta pasta, incluindo `.github/` e `.nojekyll`.
2. Edite `config.js` com a URL e a chave *anon* do passo anterior.
3. Em **Settings → Pages**, escolha *Source: GitHub Actions*.
4. Cada envio para a branch `main` publica o sistema. O endereço aparece na aba **Actions**.

### 3. Primeiro acesso
1. Abra o endereço publicado, clique em **Criar conta** e confirme o e-mail.
2. Preencha o cadastro. **O primeiro cadastro do sistema vira Supervisor (administrador) automaticamente.**
3. Divulgue o endereço. Cada pessoa cria a própria conta, preenche o cadastro e aguarda a validação
   em **Cadastros**.

## Segurança
- A chave *anon* é pública por desenho do Supabase. O que protege os dados são as regras de `schema.sql`:
  - ninguém escolhe o próprio perfil ou se aprova (gatilho `proteger_perfil`);
  - solicitantes leem e alteram apenas as próprias demandas;
  - membros, supervisor e chefias veem todas as demandas;
  - só o supervisor altera configurações, aprova cadastros e exclui demandas.
- Nunca coloque a chave *service_role* no repositório.
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
- O sistema não envia e-mails de andamento; as novidades aparecem marcadas ao abrir o sistema.
