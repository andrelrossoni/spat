/* ===== Catálogo de serviços do SPAT, organizado por dimensão de atuação =====
   sla = prazo de referência em dias úteis (o supervisor ajusta no app)
   etapas: texto simples ou {n, aprov:true} quando depende da chefia
   fimManual: a última etapa é trabalho (ex.: assinatura) e a conclusão é registrada manualmente
   ativos: pede a lista de ativos (com modo avaliação/monitoramento quando modo:true)
   interna: serviço normalmente planejado pelo próprio SPAT
   ind: nome da entrega contada nos indicadores */
const DIMS = [
  {id:"int",n:"1",nome:"Inteligência e prospecção tecnológica",curto:"Inteligência",desc:"Prospecção, buscas de anterioridade, estudos de mercado e vigilância tecnológica que orientam a programação de P&D e as decisões de transferência."},
  {id:"pi",n:"2",nome:"Propriedade intelectual (CLPI)",curto:"Propriedade intelectual",desc:"Pareceres do Comitê Local de Propriedade Intelectual, proteção de ativos e análises de liberdade de operação."},
  {id:"ctr",n:"3",nome:"Instrumentos contratuais e parcerias",curto:"Instrumentos contratuais",desc:"ACT, ACTF, NDA, MTA, licenciamento, prestação de serviços, cotitularidade e termos aditivos."},
  {id:"tt",n:"4",nome:"Qualificação e transferência de tecnologia",curto:"Qualificação e TT",desc:"Qualificação de ativos, valoração, planos de negócio e ações de transferência ao mercado."},
  {id:"imp",n:"5",nome:"Avaliação e monitoramento de impactos",curto:"Impactos",desc:"Ciclos de avaliação de impacto, monitoramento de adoção e estudos de impacto sob demanda."},
  {id:"apo",n:"·",nome:"Orientação e apoio técnico",curto:"Apoio",desc:"Atendimentos transversais que não se enquadram em um serviço específico."}
];
const E_CTR = ["Recebida","Análise do plano de trabalho","Negociação com o parceiro","Análise jurídica",{n:"Aprovação da chefia",aprov:true},"Assinatura e registro"];
const TIPOS = {
  /* 1. Inteligência */
  prospeccao:{dim:"int",nome:"Relatório de prospecção tecnológica",sigla:"PRO",sla:30,ind:"Relatórios de prospecção entregues",desc:"Bibliometria, patentes, grupos de pesquisa e mercado sobre um campo tecnológico.",
    etapas:["Recebida","Triagem e definição de escopo","Plano de busca","Coleta de dados","Análise e redação","Revisão","Entregue"]},
  anterioridade:{dim:"int",nome:"Busca de anterioridade",sigla:"BAN",sla:15,ind:"Buscas de anterioridade concluídas",desc:"Estado da técnica em bases de patentes e literatura antes de proteger ou publicar.",
    etapas:["Recebida","Estratégia de busca","Busca em bases de patentes e literatura","Relatório de anterioridade","Entregue"]},
  mercado:{dim:"int",nome:"Estudo de mercado e inteligência competitiva",sigla:"MER",sla:30,ind:"Estudos de mercado entregues",desc:"Tamanho de mercado, concorrentes, potenciais parceiros e licenciados.",
    etapas:["Recebida","Definição de escopo","Levantamento de dados","Análise","Revisão","Entregue"]},
  vigilancia:{dim:"int",nome:"Boletim de vigilância tecnológica",sigla:"VIG",sla:20,ind:"Boletins de vigilância publicados",interna:true,desc:"Monitoramento periódico de um tema estratégico da Unidade.",
    etapas:["Recebida","Tema e fontes","Coleta","Redação do boletim","Publicado"]},
  /* 2. Propriedade intelectual */
  clpi:{dim:"pi",nome:"Parecer do CLPI",sigla:"CLP",sla:20,ind:"Pareceres do CLPI emitidos",desc:"Análise de proteção da propriedade intelectual pelo Comitê Local de PI.",
    etapas:["Recebida","Análise de admissibilidade","Relatoria","Deliberação em reunião do CLPI","Parecer emitido"]},
  patente:{dim:"pi",nome:"Pedido de patente",sigla:"PAT",sla:40,ind:"Pedidos de patente depositados",desc:"Da comunicação de invenção ao depósito no INPI.",
    etapas:["Comunicação de invenção recebida","Parecer do CLPI","Redação do pedido","Revisão com inventores",{n:"Autorização da chefia",aprov:true},"Depositado no INPI"]},
  cultivar:{dim:"pi",nome:"Proteção de cultivar",sigla:"CUL",sla:40,ind:"Pedidos de proteção de cultivar",desc:"Preparação e protocolo do pedido de proteção ou registro de cultivar.",
    etapas:["Recebida","Conferência da documentação e DHE","Preparação do pedido",{n:"Autorização da chefia",aprov:true},"Protocolado no MAPA"]},
  software:{dim:"pi",nome:"Registro de software ou marca",sigla:"SOF",sla:20,ind:"Registros de software ou marca",desc:"Registro de programa de computador ou de marca no INPI.",
    etapas:["Recebida","Análise e documentação","Preparação do pedido","Protocolado no INPI"]},
  fto:{dim:"pi",nome:"Análise de liberdade de operação (FTO)",sigla:"FTO",sla:25,ind:"Análises de FTO entregues",desc:"Risco de infração a direitos de terceiros antes de lançar ou licenciar.",
    etapas:["Recebida","Definição do escopo","Busca de documentos vigentes","Análise de risco","Entregue"]},
  publicacao:{dim:"pi",nome:"Análise prévia à publicação",sigla:"PUB",sla:7,ind:"Análises prévias à publicação",desc:"Verifica se há conteúdo protegível antes de artigo, evento ou dia de campo.",
    etapas:["Recebida","Análise de conteúdo protegível","Liberado ou com recomendações"]},
  /* 3. Instrumentos contratuais */
  act:{dim:"ctr",nome:"ACT · Acordo de Cooperação Técnica",sigla:"ACT",sla:45,ind:"ACT formalizados",fimManual:true,parceiro:true,desc:"Cooperação técnica sem repasse financeiro entre os partícipes.",etapas:E_CTR},
  actf:{dim:"ctr",nome:"ACTF · ACT com aporte financeiro",sigla:"ATF",sla:60,ind:"ACTF formalizados",fimManual:true,parceiro:true,desc:"Cooperação com aporte de recursos do parceiro, com ou sem fundação de apoio.",
    etapas:["Recebida","Análise do plano de trabalho","Análise orçamentária e da fundação de apoio","Negociação com o parceiro","Análise jurídica",{n:"Aprovação da chefia",aprov:true},"Assinatura e registro"]},
  nda:{dim:"ctr",nome:"NDA · Acordo de confidencialidade",sigla:"NDA",sla:10,ind:"NDA firmados",fimManual:true,parceiro:true,desc:"Sigilo para troca de informações antes de uma parceria.",
    etapas:["Recebida","Análise da minuta","Ajustes com o parceiro","Assinatura e registro"]},
  mta:{dim:"ctr",nome:"MTA · Acordo de transferência de material",sigla:"MTA",sla:20,ind:"MTA firmados",fimManual:true,parceiro:true,desc:"Envio ou recebimento de material biológico ou genético.",
    etapas:["Recebida","Análise técnica e de PI","Análise jurídica","Assinatura e registro"]},
  licenciamento:{dim:"ctr",nome:"Contrato de licenciamento",sigla:"LIC",sla:60,ind:"Contratos de licenciamento firmados",fimManual:true,parceiro:true,desc:"Licença de uso ou exploração de tecnologia, cultivar ou software.",
    etapas:["Recebida","Valoração e modelo de licenciamento","Oferta pública ou negociação","Análise jurídica",{n:"Aprovação da chefia",aprov:true},"Assinatura e registro"]},
  servicos:{dim:"ctr",nome:"Contrato de prestação de serviços técnicos",sigla:"PST",sla:30,ind:"Contratos de serviços técnicos",fimManual:true,parceiro:true,desc:"Serviços técnicos especializados prestados pela Unidade a terceiros.",
    etapas:["Recebida","Proposta técnica e orçamento","Aceite do contratante","Análise jurídica",{n:"Aprovação da chefia",aprov:true},"Assinatura e registro"]},
  cotitularidade:{dim:"ctr",nome:"Contrato de cotitularidade",sigla:"COT",sla:45,ind:"Contratos de cotitularidade",fimManual:true,parceiro:true,desc:"Divisão de titularidade e de direitos sobre ativo desenvolvido em parceria.",
    etapas:["Recebida","Definição de quotas e responsabilidades","Negociação com o parceiro","Análise jurídica",{n:"Aprovação da chefia",aprov:true},"Assinatura e registro"]},
  aditivo:{dim:"ctr",nome:"Termo aditivo",sigla:"ADT",sla:25,ind:"Termos aditivos formalizados",fimManual:true,parceiro:true,desc:"Prorrogação, ajuste de escopo, valores ou equipe de instrumento vigente.",
    etapas:["Recebida","Análise da justificativa","Análise jurídica",{n:"Aprovação da chefia",aprov:true},"Assinatura e registro"]},
  /* 4. Qualificação e TT */
  qualificacao:{dim:"tt",nome:"Qualificação de tecnologia",sigla:"QLF",sla:45,ind:"Ativos qualificados",desc:"Diagnóstico de maturidade (TRL/MRL), mercado e proposta de qualificação do ativo.",
    etapas:["Recebida","Diagnóstico de maturidade","Avaliação de mercado e adoção","Proposta de qualificação",{n:"Validação pela chefia de TT",aprov:true},"Concluída"]},
  valoracao:{dim:"tt",nome:"Valoração de tecnologia",sigla:"VAL",sla:30,ind:"Valorações concluídas",desc:"Estimativa de valor para licenciamento, aporte ou negociação.",
    etapas:["Recebida","Coleta de dados técnicos e de mercado","Cálculo e cenários","Relatório de valoração","Entregue"]},
  plano_negocio:{dim:"tt",nome:"Plano de negócios ou de marketing do ativo",sigla:"PNE",sla:40,ind:"Planos de negócio ou marketing",desc:"Modelo de negócio, canais e estratégia de chegada ao mercado.",
    etapas:["Recebida","Diagnóstico do ativo","Análise de mercado","Modelo de negócio e canais","Revisão","Entregue"]},
  lancamento:{dim:"tt",nome:"Lançamento ou ação de transferência",sigla:"LAN",sla:30,ind:"Lançamentos e ações de TT realizados",parceiro:true,desc:"Lançamento de tecnologia, dia de campo ou vitrine com parceiros.",
    etapas:["Recebida","Planejamento","Materiais e parceiros","Realização","Concluída"]},
  portfolio:{dim:"tt",nome:"Registro de ativo no portfólio",sigla:"REG",sla:10,ind:"Ativos registrados ou atualizados",desc:"Inclusão ou atualização do ativo nas bases institucionais.",
    etapas:["Recebida","Conferência das informações","Registrado"]},
  /* 5. Impactos */
  impacto:{dim:"imp",nome:"Ciclo de avaliação de impacto",sigla:"AVI",sla:90,ind:"Relatórios de impacto publicados",interna:true,ativos:true,modo:true,desc:"Avaliação ou monitoramento de impactos econômicos, sociais e ambientais de ativos.",
    etapas:["Planejamento e seleção de ativos","Coleta de dados","Análise","Relatório de impacto",{n:"Validação pela chefia",aprov:true},"Publicado"]},
  adocao:{dim:"imp",nome:"Monitoramento de adoção",sigla:"MAD",sla:60,ind:"Monitoramentos de adoção concluídos",interna:true,ativos:true,desc:"Acompanha a adoção de tecnologias por produtores e parceiros.",
    etapas:["Planejamento","Coleta de dados de adoção","Análise","Relatório","Concluído"]},
  estudo_impacto:{dim:"imp",nome:"Estudo de impacto sob demanda",sigla:"EIM",sla:45,ind:"Estudos de impacto entregues",ativos:true,desc:"Estudo de caso de impacto pedido por pesquisador, projeto ou chefia.",
    etapas:["Recebida","Escopo e ativos","Coleta de dados","Análise","Relatório","Entregue"]},
  /* Transversal */
  apoio:{dim:"apo",nome:"Orientação ou apoio técnico",sigla:"APO",sla:10,ind:"Atendimentos concluídos",desc:"Orientação, nota técnica ou demanda que não se enquadra nos demais serviços.",
    etapas:["Recebida","Em atendimento","Concluída"]}
};
const ROLES = {solicitante:"Solicitante",membro:"Membro do SPAT",supervisor:"Supervisor do SPAT (administrador)",chefe_tt:"Chefe de Transferência de Tecnologia",chefe_geral:"Chefe-Geral"};
const ROLES_CURTO = {solicitante:"Solicitante",membro:"Membro do SPAT",supervisor:"Supervisor",chefe_tt:"Chefe de TT",chefe_geral:"Chefe-Geral"};
