/* ===== Gestão SPAT — núcleo da aplicação (independe da base de dados; usa window.Store) ===== */
const S = {me:null,info:{},perfis:{},cfg:{},demandas:[],loaded:false,stale:false,viewAs:null,prof:{},
  filtro:{q:"",dim:"",tipo:"",status:"ativas",resp:""},draft:null,readOnly:false,ano:new Date().getFullYear(),per:"ano",gj:{meses:6,desloc:0,dim:"",resp:"",concl:false},lastRoute:null,noKeep:false,authTab:"entrar"};
let seen = {}; try{seen=JSON.parse(localStorage.getItem("spat-seen")||"{}")}catch(e){}
const saveSeen=()=>{try{localStorage.setItem("spat-seen",JSON.stringify(seen))}catch(e){}};
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $ = id => document.getElementById(id);
const toast = t => {const el=$("toast");el.textContent=t;el.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>el.hidden=true,2800)};
const dimDe = k => DIMS.find(d=>d.id===TIPOS[k].dim);
const etN = e => typeof e==="string"?e:e.n;
const etAprov = e => typeof e==="object" && !!e.aprov;

/* ---------- Datas em dias úteis ---------- */
const hoje = () => {const d=new Date();d.setHours(0,0,0,0);return d};
const dia = v => {const d=new Date(v);d.setHours(0,0,0,0);return d};
function addDU(from,n){const x=dia(from);let c=0;while(c<n){x.setDate(x.getDate()+1);const w=x.getDay();if(w&&w!==6)c++}return x}
function du(a,b){a=dia(a);b=dia(b);if(+a===+b)return 0;const s=a<b?1:-1;let c=0;const x=new Date(a);while(+x!==+b){x.setDate(x.getDate()+s);const w=x.getDay();if(w&&w!==6)c+=s}return c}
const fmt = v => v? new Date(v).toLocaleDateString("pt-BR"):"—";
const fmtH = v => v? new Date(v).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"";

/* ---------- Perfis e permissões ---------- */
const meuPerfil = () => S.me && S.perfis[S.me.id];
function realRole(){ if(!S.me) return null; if(S.me.isOwner) return "supervisor"; const p=meuPerfil(); return p&&p.status==="ativo"?p.papel:null }
const role = () => S.viewAs || realRole();
const isTeam = () => ["membro","supervisor"].includes(role());
const isSup = () => role()==="supervisor";
const isChefe = () => ["chefe_tt","chefe_geral"].includes(role());
const seesAll = () => !!role() && role()!=="solicitante";
const slaDe = t => +((S.cfg.sla?.map||{})[t] || TIPOS[t].sla);
const servicoAtivo = t => !((S.cfg.servicos?.off)||[]).includes(t);
const visiveis = () => S.demandas.filter(d=> seesAll() || d.solicitante===S.me?.id);
const equipeIds = () => {const ids=Object.entries(S.perfis).filter(([,p])=>p.status==="ativo"&&["membro","supervisor"].includes(p.papel)).map(([i])=>i);if(S.me?.isOwner&&!ids.includes(S.me.id))ids.unshift(S.me.id);return ids};
const nome = id => !id?"—":(S.perfis[id]?.nome || S.prof[id]?.nome || (id===S.me?.id?"Você":"Pessoa não identificada"));
const iniciais = id => nome(id).split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join("").toUpperCase();
function avatarHtml(id){const a=S.prof[id]?.avatar;return a?`<img src="${esc(a)}" alt="">`:`<span class="av">${esc(iniciais(id))}</span>`}

function situacao(d){
  if(d.status==="concluida") return {k:"ok",t:"Concluída"};
  if(d.status==="cancelada") return {k:"mut",t:"Cancelada"};
  if(d.status==="aguardando") return d.respondido?{k:"warn",t:"Solicitante respondeu"}:{k:"info",t:"Aguardando solicitante"};
  if(d.status==="planejada") return dia(d.inicio)<=hoje()?{k:"warn",t:`Iniciar (previsto ${fmt(d.inicio)})`}:{k:"mut",t:`Planejada · início ${fmt(d.inicio)}`};
  const rest = du(hoje(), d.prazo);
  if(rest<0) return {k:"bad",t:`Atrasada ${-rest} d.u.`};
  if(rest<=Math.max(3,Math.round(slaDe(d.tipo)*.2))) return {k:"warn",t:rest===0?"Vence hoje":`Vence em ${rest} d.u.`};
  return {k:"ok",t:`${rest} d.u. restantes`};
}
const etapaAtual = d => etN(TIPOS[d.tipo].etapas[d.etapa]);
const progresso = d => d.status==="concluida"?100:Math.round(d.etapa/(TIPOS[d.tipo].etapas.length-1)*100);
function novidade(d){const h=d.historico||[];const last=h[h.length-1];if(!last||last.por===S.me?.id)return false;if(last.interna&&role()==="solicitante")return false;return !seen[d.id] || seen[d.id] < last.em}
const ativaD = d => ["aberta","aguardando"].includes(d.status);
const atrasadaD = d => d.status==="aberta" && du(hoje(),d.prazo)<0;
const MESES=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MESES_L=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const PERIODOS=[["ano","Ano completo"],["s1","1º semestre"],["s2","2º semestre"],["t1","1º trimestre"],["t2","2º trimestre"],["t3","3º trimestre"],["t4","4º trimestre"],...MESES_L.map((m,i)=>["m"+i,m[0].toUpperCase()+m.slice(1)])];
function periodo(){const a=S.ano,p=S.per;let i=0,f=11;
  if(p==="s1")f=5;else if(p==="s2")i=6;else if(p[0]==="t"){const q=+p[1]-1;i=q*3;f=i+2}else if(p[0]==="m"){i=f=+p.slice(1)}
  const rot=(PERIODOS.find(x=>x[0]===p)||["","Ano"])[1];
  return {ano:a,i,f,ini:new Date(a,i,1),fim:new Date(a,f+1,1),rotulo:p==="ano"?`Ano de ${a}`:`${rot} de ${a}`}}
const dentro=(v,P)=>{if(!v)return false;const t=new Date(v);return t>=P.ini&&t<P.fim};
const inicioD = d => d.inicio||d.criadoEm;
/* item de cronograma: início, previsão, executado (pela proporção de etapas), atraso */
function ganttItem(d){
  const ini=dia(inicioD(d)), prev0=dia(d.prazo), h=hoje(); const conc=d.status==="concluida"; const plan=d.status==="planejada";
  const prev=prev0<ini?ini:prev0;
  let feito=ini;
  if(conc) feito=dia(d.concluidaEm||d.prazo);
  else if(!plan){const fr=progresso(d)/100;feito=new Date(+ini+(Math.max(+prev,+ini+864e5)-+ini)*fr)}
  let atraso=null;
  if(conc&&d.concluidaEm&&dia(d.concluidaEm)>prev) atraso=dia(d.concluidaEm);
  else if(!conc&&!plan&&h>prev) atraso=h;
  return {d,id:d.id,cod:d.cod,titulo:d.titulo,dim:dimDe(d.tipo).curto,dimId:TIPOS[d.tipo].dim,respId:d.responsavel,resp:nome(d.responsavel),ini,prev,feitoAte:feito,atrasoAte:atraso,planejada:plan,concluida:conc,fim:atraso&&atraso>prev?atraso:prev};
}

/* ---------- Navegação ---------- */
const rota = () => location.hash.slice(1) || "inicio";
function nav(){
  const r=rota(); const items=[];
  if(role()){
    const v=visiveis(); const at=v.filter(ativaD).length;
    items.push(["inicio","Início"]);
    items.push(["#","Solicitar"],["nova","Nova solicitação"],["servicos","Catálogo de serviços"]);
    items.push(["#","Acompanhar"],["demandas",seesAll()?"Demandas":"Minhas solicitações",at]);
    if(seesAll()) items.push(["cronograma","Cronograma"]);
    if(seesAll()) items.push(["#","Gestão"],["indicadores","Indicadores"],["impactos","Carteira de impactos"]);
    if(isSup()){const pend=Object.values(S.perfis).filter(p=>p.status==="pendente").length;items.push(["cadastros","Cadastros",pend||null],["config","Configurações"])}
  }
  $("nav").innerHTML=items.map(([h,t,c])=>h==="#"?`<div class="grp">${t}</div>`:`<a href="#${h}" class="${r===h||(h==="demandas"&&r.startsWith("d-"))?"on":""}">${t}${c!=null?`<span class="cnt">${c}</span>`:""}</a>`).join("");
  const rr=realRole();
  $("who").innerHTML = S.me?`<div class="row">${avatarHtml(S.me.id).replace('class="av"','class="av" style="background:rgba(255,255,255,.2);color:inherit;width:30px;height:30px;border-radius:50%;display:grid;place-items:center"')}<span class="nm">${esc(nome(S.me.id))}<br><span style="opacity:.75">${rr?ROLES_CURTO[rr]:"Cadastro pendente"}</span></span></div>`+
   (rr==="supervisor"?`<label class="lbl nm" style="color:inherit;opacity:.7" for="viewas">Ver como</label><select id="viewas" aria-label="Ver como">${Object.entries(ROLES_CURTO).map(([k,t])=>`<option value="${k}" ${role()===k?"selected":""}>${t}</option>`).join("")}</select>`:"")+
   (Store.auth?`<button id="sair">Sair</button>`:""):"";
  const va=$("viewas"); if(va) va.onchange=()=>{S.viewAs = va.value==="supervisor"?null:va.value; render()};
  if($("sair")) $("sair").onclick=()=>Store.auth.sair();
  // assinatura
  const logo=S.cfg.marca?.logo||(window.MARCA&&MARCA.cor)||Store.logoPadrao;
  $("assin").innerHTML = logo?`<img src="${esc(logo)}" alt="Embrapa" onerror="this.outerHTML='<span class=&quot;sem-logo&quot;>Embrapa</span>'"><span class="fio"></span><span class="unid">Agrossilvipastoril</span>`:`<span class="sem-logo">Embrapa</span><span class="fio"></span><span class="unid">Agrossilvipastoril</span>`;
}

/* ---------- Componentes ---------- */
function linha(d){
  const s=situacao(d); const T=TIPOS[d.tipo];
  return `<a class="r" href="#d-${esc(d.id)}">
    <div class="c1 mono">${esc(d.cod)}</div>
    <div style="min-width:0"><div class="t">${novidade(d)?'<span class="dot" title="Atualização nova"></span>':""}${esc(d.titulo)}${d.exemplo?' <span class="tag">exemplo</span>':""}${d.status==="concluida"&&(d.anexos||[]).some(a=>a.entrega)?' <span class="tag ent">entrega</span>':""}</div>
      <div class="s">${esc(T.nome)} · ${esc(etapaAtual(d))}${d.origem==="interna"?" · ação interna":""}</div></div>
    <div class="c3 s">${esc(nome(d.responsavel))}</div>
    <div class="c4"><div class="s mono">${fmt(d.prazo)}</div><div class="bar"><i style="width:${progresso(d)}%"></i></div></div>
    <div><span class="pill ${s.k}">${s.t}</span></div></a>`;
}
const cabecalho = () => `<div class="r hd lbl"><div>Código</div><div>Demanda · etapa</div><div>Responsável</div><div>Previsão</div><div>Situação</div></div>`;
function cartao(d){
  const s=situacao(d);
  return `<a class="card" href="#d-${esc(d.id)}"><div class="top"><span class="tag">${esc(d.cod)}</span><span class="pill ${s.k}">${s.t}</span></div>
   <h3>${novidade(d)?'<span class="dot" style="margin-right:6px"></span>':""}${esc(d.titulo)}</h3>
   <div class="muted" style="font-size:.84rem">${esc(TIPOS[d.tipo].nome)}</div>
   <div style="font-size:.85rem">Etapa atual: <b>${esc(etapaAtual(d))}</b></div>
   <div class="bar"><i style="width:${progresso(d)}%"></i></div>
   <div class="muted" style="font-size:.82rem;display:flex;justify-content:space-between"><span>Entrega prevista</span><span class="mono">${fmt(d.prazo)}</span></div></a>`;
}
const vazio = (t,p,acao) => `<div class="empty"><h3>${t}</h3>${p?`<p>${p}</p>`:""}${acao||""}</div>`;
const painelLista = (t,lista,vt,vp,extra) => `<div class="panel flush"><div class="sec-t"><h2>${t}</h2><span class="muted">${extra??lista.length}</span></div>${lista.length?lista.map(linha).join(""):vazio(vt,vp)}</div>`;

/* ---------- Telas: acesso ---------- */
function telaLogin(){
  const t=S.authTab;
  return `<div class="gate"><div><h1>Sistema de Gestão do SPAT</h1><p class="muted" style="margin:6px 0 0">Setor de Prospecção e Avaliação de Tecnologias da Embrapa Agrossilvipastoril. Entre com seu e-mail ou crie uma conta para solicitar serviços.</p></div>
  <div class="panel" style="display:flex;flex-direction:column;gap:14px">
   <div class="tabs"><button type="button" data-tab="entrar" class="${t==="entrar"?"on":""}">Entrar</button><button type="button" data-tab="criar" class="${t==="criar"?"on":""}">Criar conta</button><button type="button" data-tab="senha" class="${t==="senha"?"on":""}">Esqueci a senha</button></div>
   <form id="fauth" style="display:flex;flex-direction:column;gap:12px">
    <div class="fld"><label for="a-email">E-mail</label><input id="a-email" type="email" required autocomplete="email" placeholder="nome.sobrenome@embrapa.br"></div>
    ${t!=="senha"?`<div class="fld"><label for="a-senha">Senha</label><input id="a-senha" type="password" required minlength="8" autocomplete="${t==="criar"?"new-password":"current-password"}">${t==="criar"?"<small>Mínimo de 8 caracteres. Depois de confirmar o e-mail, você preenche o cadastro e aguarda a validação do supervisor.</small>":""}</div>`:""}
    <button class="btn pri" style="align-self:flex-start">${t==="entrar"?"Entrar":t==="criar"?"Criar conta":"Enviar link de redefinição"}</button>
   </form></div></div>`;
}
function telaCadastro(){
  const p=meuPerfil();
  if(!S.editCad){
  if(p&&p.status==="pendente") return `<div class="gate"><h1>Cadastro em validação</h1><div class="panel" style="display:flex;flex-direction:column;gap:10px"><p style="margin:0">Recebemos seu cadastro como <b>${esc(ROLES[p.papelSolicitado]||"Solicitante")}</b>. O supervisor do SPAT vai validar o acesso. Esta página se atualiza sozinha quando o cadastro for aprovado.</p><dl class="kv"><dt>Nome</dt><dd>${esc(p.nome)}</dd><dt>Setor</dt><dd>${esc(p.setor||"—")}</dd><dt>Enviado em</dt><dd>${fmtH(p.criadoEm)}</dd></dl><button class="btn sm" id="editcad" style="align-self:flex-start">Corrigir dados do cadastro</button></div></div>`;
  if(p&&p.status==="recusado") return `<div class="gate"><h1>Cadastro não aprovado</h1><div class="panel"><p style="margin:0 0 12px">O supervisor do SPAT não aprovou este cadastro${p.motivo?`: ${esc(p.motivo)}`:""}. Corrija os dados e envie novamente, ou procure o SPAT.</p><button class="btn" id="editcad">Revisar e reenviar</button></div></div>`;
  if(p&&p.status==="inativo") return `<div class="gate"><h1>Acesso desativado</h1><div class="panel"><p style="margin:0">Seu acesso ao sistema foi desativado pelo supervisor do SPAT. Procure o setor para reativá-lo.</p></div></div>`;
  }
  const v=p||{}; const email=v.email||S.me?.email||"";
  return `<div class="gate"><div><h1>Cadastro no Sistema SPAT</h1><p class="muted" style="margin:6px 0 0">Preencha seus dados. O supervisor do SPAT valida o cadastro e libera o perfil de acesso.</p></div>
  ${S.readOnly?`<div class="banner">Seu acesso a esta página é somente leitura. Peça ao SPAT acesso de Colaborador para se cadastrar.</div>`:""}
  <form class="panel form" id="fcad">
    <div class="fld full"><label for="c-nome">Nome completo</label><input id="c-nome" required value="${esc(v.nome||S.me?.nome||"")}"></div>
    <div class="fld"><label for="c-email">E-mail institucional</label><input id="c-email" type="email" required value="${esc(email)}"></div>
    <div class="fld"><label for="c-mat">Matrícula (empregados Embrapa)</label><input id="c-mat" value="${esc(v.matricula||"")}"></div>
    <div class="fld"><label for="c-setor">Unidade, setor ou instituição</label><input id="c-setor" required value="${esc(v.setor||"")}" placeholder="Ex.: Núcleo de Pesquisa em Sistemas Integrados"></div>
    <div class="fld"><label for="c-cargo">Cargo ou função</label><input id="c-cargo" value="${esc(v.cargo||"")}" placeholder="Ex.: Pesquisador A"></div>
    <div class="fld"><label for="c-ramal">Telefone ou ramal</label><input id="c-ramal" value="${esc(v.ramal||"")}"></div>
    <div class="fld"><label for="c-papel">Perfil solicitado</label><select id="c-papel">${Object.entries(ROLES).map(([k,t])=>`<option value="${k}" ${(v.papelSolicitado||"solicitante")===k?"selected":""}>${t}</option>`).join("")}</select></div>
    <div class="fld full"><label for="c-just">Justificativa (obrigatória para perfis da equipe e da chefia)</label><textarea id="c-just" style="min-height:70px">${esc(v.justificativa||"")}</textarea></div>
    <div class="fld full" style="flex-direction:row;justify-content:flex-end"><button class="btn pri" ${S.readOnly?"disabled":""}>Enviar cadastro</button></div>
  </form></div>`;
}

/* ---------- Telas: início ---------- */
function telaInicio(){
  const v=visiveis();
  if(!seesAll()){
    const ab=v.filter(ativaD), fe=v.filter(d=>d.status==="concluida").slice(0,6);
    return `<div class="head"><div><h1>Minhas solicitações ao SPAT</h1><p>Acompanhe cada pedido, a etapa em que está e quando deve ficar pronto.</p></div><a class="btn pri" href="#nova">Nova solicitação</a></div>
      ${bannerPendencias()}
      ${ab.length?`<div class="cards">${ab.map(cartao).join("")}</div>`:`<div class="panel">${vazio("Nenhuma solicitação em andamento","Peça um relatório de prospecção, um parecer do CLPI, um instrumento contratual ou outro serviço. Você vê o prazo estimado antes de enviar.",'<a class="btn pri" href="#nova">Fazer uma solicitação</a>')}</div>`}
      ${fe.length?`<div class="panel flush"><div class="sec-t"><h2>Concluídas recentemente</h2></div>${fe.map(linha).join("")}</div>`:""}`;
  }
  const at=v.filter(ativaD), atr=at.filter(atrasadaD);
  const vence=at.filter(d=>{if(d.status!=="aberta")return false;const r=du(hoje(),d.prazo);return r>=0&&r<=5});
  const ano=new Date().getFullYear();
  const concl=v.filter(d=>d.status==="concluida"&&d.concluidaEm&&new Date(d.concluidaEm).getFullYear()===ano);
  const noPrazo=concl.length?Math.round(concl.filter(d=>dia(d.concluidaEm)<=dia(d.prazo)).length/concl.length*100):null;
  const ord=l=>l.slice().sort((a,b)=>a.prazo<b.prazo?-1:1);
  const blocos=[];
  if(isTeam()) blocos.push(painelLista("Minha fila",ord(at.filter(d=>d.responsavel===S.me.id)),"Nada atribuído a você","Assuma uma demanda da fila sem responsável ou peça ao supervisor que distribua."));
  if(isSup()) blocos.push(painelLista("Na fila, sem responsável",at.filter(d=>!d.responsavel),"Fila vazia","Toda demanda aberta já tem responsável."));
  if(isChefe()||isSup()) blocos.push(painelLista("Aguardando aprovação da chefia",at.filter(d=>d.status==="aberta"&&etAprov(TIPOS[d.tipo].etapas[d.etapa])),"Nenhuma aprovação pendente","Instrumentos contratuais, pedidos de proteção, qualificações e avaliações de impacto aparecem aqui ao chegar à etapa de aprovação."));
  if(isChefe()) blocos.push(painelLista("Atrasadas",atr,"Nenhuma demanda atrasada",""));
  const pend=Object.values(S.perfis).filter(p=>p.status==="pendente").length;
  const porDim=DIMS.map(d=>[d,at.filter(x=>TIPOS[x.tipo].dim===d.id).length]); const mx=Math.max(1,...porDim.map(x=>x[1]));
  return `<div class="head"><div><h1>Painel do SPAT</h1><p>${ROLES[role()]} · ${new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}</p></div><a class="btn pri" href="#nova">Nova solicitação</a></div>
   ${bannerPendencias()}
   ${isSup()&&pend?`<div class="banner"><b>${pend}</b> cadastro(s) aguardando validação. <a href="#cadastros">Validar agora</a></div>`:""}
   ${S.demandas.length===0?`<div class="note">A base ainda está vazia. As demandas aparecem aqui quando alguém fizer a primeira solicitação.${isSup()?' Para testar o fluxo, insira demandas de exemplo em <a href="#config">Configurações</a>.':""}</div>`:""}
   <div class="kpis">
     <button class="kpi" data-go="ativas"><b>${at.length}</b><span>Em andamento</span></button>
     <button class="kpi ${atr.length?"bad":""}" data-go="atrasadas"><b>${atr.length}</b><span>Atrasadas</span></button>
     <button class="kpi ${vence.length?"warn":""}" data-go="vencendo"><b>${vence.length}</b><span>Vencem em até 5 dias úteis</span></button>
     <a class="kpi" href="#indicadores" style="text-decoration:none;color:inherit"><b>${concl.length}</b><span>Concluídas em ${ano}${noPrazo!=null?` · ${noPrazo}% no prazo`:""}</span></a>
   </div>
   <div class="grid2"><div class="col">${blocos.join("")||painelLista("Em andamento",ord(at).slice(0,12),"Nenhuma demanda em andamento","")}</div>
   <div class="panel"><div class="sec-t"><h2>Carteira por dimensão</h2><span class="lbl">em andamento</span></div>
     <div class="typebars">${porDim.map(([d,n])=>`<div class="tb"><span>${esc(d.curto)}</span><div class="bar"><i style="width:${n/mx*100}%"></i></div><span class="n">${n}</span></div>`).join("")}</div>
     <p class="note" style="margin:16px 0 0">Prazos em dias úteis (d.u.), sem considerar feriados.</p></div></div>`;
}

/* ---------- Catálogo ---------- */
function catalogo(link){
  return DIMS.map(d=>{const ts=Object.entries(TIPOS).filter(([k,t])=>t.dim===d.id&&servicoAtivo(k)&&(isTeam()||!t.interna));if(!ts.length)return "";
    return `<section class="dimblk"><div class="dimhd"><span class="num">${d.n}</span><h2>${esc(d.nome)}</h2><p>${esc(d.desc)}</p></div>
    <div class="types">${ts.map(([k,t])=>link?`<a class="type" href="#nova" data-tipo="${k}"><b>${esc(t.nome)}</b><small>${esc(t.desc)}</small><span class="sla">≈ ${slaDe(k)} dias úteis · ${t.etapas.length} etapas</span></a>`
      :`<button type="button" class="type ${S.draft?.tipo===k?"on":""}" data-pick="${k}"><b>${esc(t.nome)}</b><small>${esc(t.desc)}</small><span class="sla">≈ ${slaDe(k)} dias úteis</span></button>`).join("")}</div></section>`}).join("");
}
function telaServicos(){
  return `<div class="head"><div><h1>Catálogo de serviços</h1><p>Serviços do SPAT organizados pelas dimensões de atuação do setor, com o prazo de referência de cada um.</p></div><a class="btn pri" href="#nova">Nova solicitação</a></div>${catalogo(true)}`;
}

/* ---------- Lista ---------- */
function telaLista(){
  const f=S.filtro; const v=visiveis();
  const l=v.filter(d=>{
    if(f.dim&&TIPOS[d.tipo].dim!==f.dim)return false;
    if(f.tipo&&d.tipo!==f.tipo)return false;
    if(f.resp==="eu"&&d.responsavel!==S.me.id)return false;
    if(f.resp==="sem"&&d.responsavel)return false;
    if(f.resp&&!["eu","sem"].includes(f.resp)&&d.responsavel!==f.resp)return false;
    const r=d.status==="aberta"?du(hoje(),d.prazo):null;
    if(f.status==="ativas"&&!ativaD(d))return false;
    if(f.status==="atrasadas"&&!(r!=null&&r<0))return false;
    if(f.status==="vencendo"&&!(r!=null&&r>=0&&r<=5))return false;
    if(["aguardando","planejada","concluida","cancelada"].includes(f.status)&&d.status!==f.status)return false;
    if(f.q){const q=f.q.toLowerCase();if(!(`${d.cod} ${d.titulo} ${d.descricao} ${d.unidade||""} ${d.parceiro||""} ${nome(d.solicitante)}`.toLowerCase().includes(q)))return false}
    return true;
  }).sort((a,b)=>(a.status==="aberta"?0:1)-(b.status==="aberta"?0:1)||(a.prazo<b.prazo?-1:1));
  const tiposF=Object.entries(TIPOS).filter(([,t])=>!f.dim||t.dim===f.dim);
  return `<div class="head"><div><h1>${seesAll()?"Demandas do SPAT":"Minhas solicitações"}</h1><p>${l.length} de ${v.length} registros</p></div><div style="display:flex;gap:8px;flex-wrap:wrap">${seesAll()?`<button class="btn" id="csv">Exportar CSV</button>`:""}<a class="btn pri" href="#nova">Nova solicitação</a></div></div>
  <div class="filters">
    <input id="fq" type="search" placeholder="Buscar por código, título, parceiro, unidade ou solicitante" value="${esc(f.q)}" aria-label="Buscar">
    <select id="fd" aria-label="Dimensão"><option value="">Todas as dimensões</option>${DIMS.map(d=>`<option value="${d.id}" ${f.dim===d.id?"selected":""}>${esc(d.curto)}</option>`).join("")}</select>
    <select id="ft" aria-label="Serviço"><option value="">Todos os serviços</option>${tiposF.map(([k,t])=>`<option value="${k}" ${f.tipo===k?"selected":""}>${esc(t.nome)}</option>`).join("")}</select>
    <select id="fs" aria-label="Situação">${[["ativas","Em andamento"],["atrasadas","Atrasadas"],["vencendo","Vencem em 5 d.u."],["aguardando","Aguardando solicitante"],["planejada","Planejadas (não iniciadas)"],["concluida","Concluídas"],["cancelada","Canceladas"],["todas","Todas"]].map(([k,t])=>`<option value="${k}" ${f.status===k?"selected":""}>${t}</option>`).join("")}</select>
    ${seesAll()?`<select id="fr" aria-label="Responsável"><option value="">Qualquer responsável</option>${isTeam()?`<option value="eu" ${f.resp==="eu"?"selected":""}>Comigo</option>`:""}<option value="sem" ${f.resp==="sem"?"selected":""}>Sem responsável</option>${equipeIds().map(id=>`<option value="${esc(id)}" ${f.resp===id?"selected":""}>${esc(nome(id))}</option>`).join("")}</select>`:""}
  </div>
  <div class="panel flush">${l.length?cabecalho()+l.map(linha).join(""):vazio(v.length?"Nenhuma demanda com esses filtros":"Nenhuma demanda registrada",v.length?"Ajuste a busca ou a situação selecionada.":"Quando houver solicitações, elas aparecem aqui ordenadas pelo prazo.",v.length?"":'<a class="btn pri" href="#nova">Nova solicitação</a>')}</div>`;
}

/* ---------- Nova solicitação ---------- */
function novoDraft(){const p=meuPerfil()||{};return S.draft||(S.draft={tipo:"",titulo:"",descricao:"",unidade:p.setor||"",contato:[p.email,p.ramal].filter(Boolean).join(" · "),parceiro:"",urgencia:"normal",links:"",origem:"solicitacao",ativos:[{nome:"",modo:"avaliacao"}]})}
function telaNova(){
  const D=novoDraft(); const T=D.tipo&&TIPOS[D.tipo];
  const sla=T?slaDe(D.tipo):null; const iniD=D.inicio?new Date(D.inicio+"T12:00:00"):hoje(); const prev=sla?(D.fim?new Date(D.fim+"T12:00:00"):addDU(iniD,sla)):null;
  const isoDia=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const lblDesc={prospeccao:"Objetivo, perguntas e escopo (tema, palavras-chave, período, países)",clpi:"Ativo a analisar, inventores e situação de divulgação",patente:"Descrição da invenção, inventores e situação de divulgação",publicacao:"Título do trabalho, evento ou veículo e data prevista de divulgação"}[D.tipo]
    || (T&&T.dim==="ctr"?"Objeto, vigência, valores, equipe e justificativa":"Descrição");
  return `<div class="head"><div><h1>Nova solicitação</h1><p>Escolha o serviço. O prazo estimado aparece antes do envio e fica registrado na demanda.</p></div></div>
  ${S.readOnly?`<div class="banner">Seu acesso a esta página é somente leitura. Peça ao SPAT acesso de Colaborador para enviar solicitações.</div>`:""}
  ${T?`<div class="panel" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><span class="dimtag">${esc(dimDe(D.tipo).curto)}</span> <b style="margin-left:6px">${esc(T.nome)}</b><div class="muted" style="font-size:.85rem">${esc(T.desc)}</div></div><button type="button" class="btn sm" id="trocar">Trocar serviço</button></div>`:catalogo(false)}
  ${T?`<form class="panel" id="fnova" style="display:flex;flex-direction:column;gap:16px">
    <div class="form">
      ${isTeam()?`<div class="fld full"><label for="n-origem">Origem</label><select id="n-origem"><option value="solicitacao" ${D.origem==="solicitacao"?"selected":""}>Solicitação de outro setor ou pessoa</option><option value="interna" ${D.origem==="interna"?"selected":""}>Ação interna do SPAT (planejada pelo setor)</option></select></div>`:""}
      <div class="fld full"><label for="n-titulo">Título</label><input id="n-titulo" required maxlength="140" value="${esc(D.titulo)}" placeholder="${T.dim==="ctr"?"Ex.: ACT com a Cooperativa X para validação de tecnologia":T.dim==="imp"?"Ex.: Avaliação de impacto 2027 — ativos ILPF":"Descreva a demanda em uma linha"}"></div>
      ${T.parceiro?`<div class="fld full"><label for="n-parc">Parceiro ou instituição envolvida</label><input id="n-parc" value="${esc(D.parceiro)}" placeholder="Razão social ou nome da instituição"></div>`:""}
      <div class="fld full"><label for="n-desc">${lblDesc}</label><textarea id="n-desc" required>${esc(D.descricao)}</textarea></div>
      <div class="fld"><label for="n-unid">Unidade, setor ou projeto</label><input id="n-unid" value="${esc(D.unidade)}"></div>
      <div class="fld"><label for="n-cont">Contato (ramal ou e-mail)</label><input id="n-cont" value="${esc(D.contato)}"></div>
      <div class="fld"><label for="n-urg">Urgência</label><select id="n-urg"><option value="normal" ${D.urgencia==="normal"?"selected":""}>Normal</option><option value="alta" ${D.urgencia==="alta"?"selected":""}>Alta (prazo externo, edital ou reunião)</option></select></div>
      ${isTeam()?`<div class="fld full" style="border-top:1px solid var(--line);padding-top:12px"><label>Planejamento</label><small>Use datas futuras para planejar ações. Se o início for posterior a hoje, a ação fica como Planejada e aparece no Cronograma.</small></div>
      <div class="fld"><label for="n-ini">Início previsto</label><input type="date" id="n-ini" value="${D.inicio||isoDia(hoje())}"></div>
      <div class="fld"><label for="n-fim">Término previsto</label><input type="date" id="n-fim" value="${D.fim||isoDia(prev)}"><small>Sugestão pelo prazo de referência: ${fmt(addDU(iniD,sla))}</small></div>`:""}
      <div class="fld"><label for="n-links">Links para documentos (opcional)</label><input id="n-links" value="${esc(D.links)}" placeholder="SEI, Drive ou SharePoint"></div>
      ${T.ativos?`<div class="fld full"><label>Ativos ${T.modo?"a avaliar ou monitorar":"envolvidos"}</label><div class="assets">${D.ativos.map((a,i)=>`<div class="asset" ${T.modo?"":'style="grid-template-columns:minmax(0,1fr) auto"'}><input id="a-n-${i}" aria-label="Nome do ativo" placeholder="Nome do ativo (tecnologia, prática, cultivar…)" value="${esc(a.nome)}">${T.modo?`<select id="a-m-${i}" aria-label="Modo"><option value="avaliacao" ${a.modo==="avaliacao"?"selected":""}>Avaliação</option><option value="monitoramento" ${a.modo==="monitoramento"?"selected":""}>Monitoramento</option></select>`:""}<button type="button" class="btn sm" data-rmasset="${i}">Remover</button></div>`).join("")}<button type="button" class="btn sm" id="addasset" style="align-self:flex-start">Adicionar ativo</button></div></div>`:""}
    </div>
    <div class="est"><div><div class="lbl">Prazo estimado</div><b>${du(iniD,prev)} dias úteis</b></div>${iniD>hoje()?`<div><div class="lbl">Início previsto</div><b class="mono" style="font-size:1.05rem">${fmt(iniD)}</b></div>`:""}<div><div class="lbl">Entrega prevista</div><b class="mono" style="font-size:1.05rem">${prev.toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"})}</b></div>
      <div class="muted" style="font-size:.85rem;flex:1;min-width:200px">Etapas: ${T.etapas.map(etN).map(esc).join(" → ")}</div></div>
    <div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn" id="ncancel">Limpar</button><button class="btn pri" id="nsend" ${S.readOnly?"disabled":""}>Enviar solicitação</button></div>
  </form>`:""}`;
}

/* ---------- Anexos, links e processos SEI ---------- */
const ehUrl=u=>/^https?:\/\/[^\s]+$/i.test(u||"");
function origemLink(u){try{const h=new URL(u).hostname;if(/drive\.google|docs\.google/.test(h))return "Google Drive";if(/sharepoint|onedrive|office/.test(h))return "SharePoint / OneDrive";if(/(^|\.)sei\.|\/sei/.test(h))return "SEI";return h.replace(/^www\./,"")}catch(e){return "Link"}}
const tamanho=b=>b==null?"":b<1024*1024?Math.max(1,Math.round(b/1024))+" KB":(b/1048576).toFixed(1).replace(".",",")+" MB";
const extensao=n=>((n||"").split(".").pop()||"").slice(0,4).toUpperCase();
function itemAnexo(a,i,d){
  const por=`${esc(nome(a.por))} · ${fmtH(a.em)}`;
  const rm=(isSup()||a.por===S.me.id)&&!S.readOnly?`<button class="btn sm" data-rmanexo="${i}" title="Remover">Remover</button>`:"";
  if(a.tipo==="sei") return `<div class="anx"><span class="atag sei">SEI</span><div class="ai"><b>Processo SEI nº <span class="mono">${esc(a.sei)}</span></b><small>${a.nome?esc(a.nome)+" · ":""}${por}</small></div><button class="btn sm" data-copiar="${esc(a.sei)}">Copiar número</button>${rm}</div>`;
  if(a.tipo==="link") return `<div class="anx"><span class="atag lnk">LINK</span><div class="ai"><a href="${esc(a.url)}" target="_blank" rel="noopener"><b>${esc(a.nome||origemLink(a.url))}</b></a><small>${esc(origemLink(a.url))} · ${por}</small></div><a class="btn sm" href="${esc(a.url)}" target="_blank" rel="noopener">Abrir</a>${rm}</div>`;
  return `<div class="anx"><span class="atag">${esc(extensao(a.nome)||"ARQ")}</span><div class="ai"><b>${esc(a.nome)}</b><small>${tamanho(a.tam)} · ${por}</small></div><button class="btn sm" data-baixar="${i}">Baixar</button>${rm}</div>`;
}
function painelAnexos(d){
  const L=(d.anexos||[]).map((a,i)=>({a,i}));
  const ent=L.filter(x=>x.a.entrega), out=L.filter(x=>!x.a.entrega);
  const modo=S.axModo;
  const add=S.readOnly||d.status==="cancelada"?"":`<div class="anx-add">
    <div class="row"><label class="btn sm" for="ax-file" ${Store.podeAnexar?"":'hidden'}>Anexar arquivo</label><input type="file" id="ax-file" multiple hidden ${Store.tiposAnexo?`accept="${Store.tiposAnexo}"`:""}><button class="btn sm" data-axmodo="link">Adicionar link</button><button class="btn sm" data-axmodo="sei">Informar processo SEI</button></div>
    ${modo==="link"?`<div class="row"><input id="ax-url" class="inp" type="url" placeholder="https://drive.google.com/…" style="flex:2 1 260px"><input id="ax-rot" class="inp" placeholder="Descrição (opcional)" style="flex:1 1 160px"><button class="btn sm pri" data-act="ax-link">Adicionar</button></div>`:""}
    ${modo==="sei"?`<div class="row"><input id="ax-sei" class="inp mono" placeholder="00000.000000/0000-00" style="flex:1 1 200px"><input id="ax-seirot" class="inp" placeholder="Assunto (opcional)" style="flex:2 1 200px"><button class="btn sm pri" data-act="ax-sei">Adicionar</button></div>`:""}
    <small class="muted">${esc(Store.notaAnexo||"")}${isTeam()?" Itens marcados como entrega aparecem em destaque para o solicitante.":""}</small>
    ${isTeam()&&d.solicitante!==S.me.id?`<label style="font-size:.85rem"><input type="checkbox" id="ax-ent"> Marcar como entrega ao solicitante</label>`:""}
  </div>`;
  return `<div class="panel"><div class="sec-t"><h2>Anexos e links</h2><span class="muted">${L.length}</span></div>
    ${ent.length&&d.status!=="concluida"?`<div class="lbl" style="margin:4px 0 6px">Entrega</div>${ent.map(x=>itemAnexo(x.a,x.i,d)).join("")}<div class="lbl" style="margin:12px 0 6px">Outros</div>`:""}
    ${out.map(x=>itemAnexo(x.a,x.i,d)).join("")||(ent.length?(d.status==="concluida"?`<p class="muted" style="margin:0 0 10px;font-size:.88rem">Os itens da entrega estão no quadro verde acima.</p>`:""):`<p class="muted" style="margin:0 0 10px;font-size:.88rem">Nenhum arquivo, link ou processo SEI ainda.</p>`)}
    ${add}</div>`;
}
function painelEntrega(d){
  const ent=(d.anexos||[]).map((a,i)=>({a,i})).filter(x=>x.a.entrega);
  if(d.status!=="concluida"||(!ent.length&&!d.entrega)) return "";
  return `<div class="panel ok-panel"><div class="sec-t"><h2>${d.solicitante===S.me.id?"Seu trabalho está pronto":"Entrega ao solicitante"}</h2><span class="muted">${d.entrega?fmtH(d.entrega.em):fmt(d.concluidaEm)}</span></div>
    ${d.entrega?.obs?`<div class="x" style="white-space:pre-wrap;margin-bottom:10px">${esc(d.entrega.obs)}</div>`:""}
    ${ent.map(x=>itemAnexo(x.a,x.i,d)).join("")||`<p class="muted" style="margin:0">Entrega registrada sem anexo.</p>`}</div>`;
}
function formEntrega(d,T){
  const sei=(d.anexos||[]).find(a=>a.tipo==="sei");
  return `<form class="panel form-entrega" id="fentrega"><div class="sec-t"><h2>${T.fimManual?"Registrar assinatura e entregar":"Concluir e entregar"}</h2></div>
   <p class="muted" style="margin:0 0 12px;font-size:.9rem">${d.origem==="interna"?"Registre o resultado desta ação interna.":"O solicitante recebe o aviso com o que você informar aqui."} Informe pelo menos um: processo SEI, link ou arquivo.</p>
   <div class="form">
    <div class="fld"><label for="e-sei">Processo SEI</label><input id="e-sei" class="mono" placeholder="00000.000000/0000-00" value="${esc(sei?.sei||"")}"></div>
    <div class="fld"><label for="e-arq">Arquivos</label><input id="e-arq" type="file" multiple ${Store.podeAnexar?"":"disabled"} ${Store.tiposAnexo?`accept="${Store.tiposAnexo}"`:""}><small>${esc(Store.notaAnexo||"")}</small></div>
    <div class="fld"><label for="e-link">Link (Google Drive, SharePoint…)</label><input id="e-link" type="url" placeholder="https://drive.google.com/…"></div>
    <div class="fld"><label for="e-linkrot">Descrição do link</label><input id="e-linkrot" placeholder="Ex.: Pasta com o relatório final"></div>
    <div class="fld full"><label for="e-msg">Mensagem ao solicitante</label><textarea id="e-msg" style="min-height:80px" placeholder="Resumo do que foi entregue e próximos passos"></textarea></div>
    <label class="fld full" style="flex-direction:row;gap:8px;align-items:center;font-size:.88rem"><input type="checkbox" id="e-sem"> Concluir sem anexo (o resultado está descrito na mensagem)</label>
   </div>
   <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button type="button" class="btn" data-act="fechar-form">Cancelar</button><button class="btn pri" id="e-ok">Concluir e avisar o solicitante</button></div></form>`;
}
function formPausa(){
  return `<div class="acts"><label class="lbl" for="p-txt">O que o solicitante precisa enviar ou decidir?</label><textarea id="p-txt" class="inp" style="min-height:90px" placeholder="Ex.: Enviar o plano de trabalho assinado pelo parceiro"></textarea>
   <div class="row"><button class="btn sm" data-act="fechar-form">Cancelar</button><button class="btn sm pri" data-act="pausar2">Suspender prazo e avisar</button></div></div>`;
}

/* ---------- Central de avisos ---------- */
const lidoKey=()=>`spat-lido-${S.me?.id}`;
function lido(){try{const v=localStorage.getItem(lidoKey());if(v)return v}catch(e){}return S.lidoMem||new Date(Date.now()-7*864e5).toISOString()}
const vistasKey=()=>`spat-vistas-${S.me?.id}`;
function vistas(){try{const v=localStorage.getItem(vistasKey());if(v)return new Set(JSON.parse(v))}catch(e){}return new Set(S.vistasMem||[])}
function marcarLido(){const A0=avisos();let v=new Date().toISOString();A0.nov.forEach(x=>{if(x.h.em>v)v=x.h.em});S.lidoMem=v;try{localStorage.setItem(lidoKey(),v)}catch(e){}
  const chaves=A0.pend.map(p=>p.chave);S.vistasMem=chaves;try{localStorage.setItem(vistasKey(),JSON.stringify(chaves))}catch(e){}}
function avisos(){
  const pend=[],nov=[]; if(!S.me||!role()) return {pend,nov,novos:0};
  const me=S.me.id, sol=role()==="solicitante";
  const V=vistas(); const P=(d,t,k)=>{const chave=d.id+"|"+t;pend.push({d,t,k,chave,vista:V.has(chave)})};
  for(const d of visiveis()){
    if(d.status==="cancelada") continue;
    if(d.solicitante===me&&d.origem!=="interna"&&d.status==="aguardando"&&!d.respondido) P(d,"Aguardando sua manifestação","warn");
    if(d.solicitante===me&&d.status==="concluida"&&(d.anexos||[]).some(a=>a.entrega)&&!(seen[d.id]&&seen[d.id]>=(d.entrega?.em||d.concluidaEm))) P(d,"Entrega disponível","ok");
    if(isSup()&&d.status==="aberta"&&!d.responsavel) P(d,"Aguardando alocação de responsável","bad");
    if(isTeam()&&d.status==="aguardando"&&d.respondido&&(d.responsavel===me||(!d.responsavel&&isSup()))) P(d,"Solicitante respondeu à pendência","warn");
    if(isChefe()&&d.status==="aberta"&&etAprov(TIPOS[d.tipo].etapas[d.etapa])) P(d,"Aguarda sua aprovação","info");
    if(isTeam()&&d.status==="planejada"&&(d.responsavel===me||(!d.responsavel&&isSup()))&&dia(inicioD(d))<=hoje()) P(d,"Ação planejada: hora de iniciar","info");
    if(isTeam()&&d.responsavel===me&&atrasadaD(d)) P(d,"Prazo vencido","bad");
    const rel=d.solicitante===me||d.responsavel===me||(isSup()&&!d.responsavel);
    if(!rel) continue;
    for(const h of (d.historico||[])){ if(h.por===me) continue; if(h.interna&&sol) continue; nov.push({d,h}); }
  }
  nov.sort((a,b)=>a.h.em<b.h.em?1:-1);
  const L=lido(); const novos=nov.filter(n=>n.h.em>L).length+pend.filter(p=>!p.vista).length;
  return {pend,nov:nov.slice(0,25),novos,L};
}
function renderSino(){
  const b=$("sino"); if(!b) return;
  if(!S.me||!role()){b.hidden=true;return}
  const A=avisos(); const n=A.novos; b.hidden=false;
  b.querySelector(".badge").textContent=n>99?"99+":String(n); b.querySelector(".badge").hidden=!n;
  b.setAttribute("aria-label",`Notificações: ${n}`);
  try{document.title=(n?`(${n}) `:"")+"Gestão SPAT"}catch(e){}
  // alerta do navegador para itens novos (instalação própria)
  const chaves=new Set([...A.pend.map(p=>p.d.id+p.t),...A.nov.filter(x=>x.h.em>A.L).map(x=>x.d.id+x.h.em)]);
  if(S.chavesAviso&&Store.mode==="supabase"&&"Notification" in window&&Notification.permission==="granted"){
    const novas=[...A.pend.filter(p=>!S.chavesAviso.has(p.d.id+p.t)).map(p=>[p.t,p.d.titulo]),...A.nov.filter(x=>x.h.em>A.L&&!S.chavesAviso.has(x.d.id+x.h.em)).map(x=>[x.h.t,x.d.titulo])];
    novas.slice(0,3).forEach(([t,c])=>{try{new Notification("SPAT: "+t.slice(0,80),{body:c})}catch(e){}});
  }
  S.chavesAviso=chaves;
  const pn=$("notif"); if(pn&&!pn.hidden) pn.innerHTML=painelAvisos(A);
}
function painelAvisos(A){
  const pend=A.pend.map(p=>`<a class="nt-i${p.vista?"":" novo"}" href="#d-${esc(p.d.id)}"><span class="pill ${p.k}">${esc(p.t)}</span><b>${esc(p.d.titulo)}</b><small class="mono">${esc(p.d.cod)}</small></a>`).join("");
  const nov=A.nov.map(x=>`<a class="nt-i ${x.h.em>A.L?"novo":""}" href="#d-${esc(x.d.id)}"><b>${esc(x.d.titulo)}</b><span class="nt-t">${esc((x.h.tipo==="comentario"?nome(x.h.por)+": ":"")+x.h.t).slice(0,160)}</span><small>${fmtH(x.h.em)}</small></a>`).join("");
  const alerta=Store.mode==="supabase"&&"Notification" in window&&Notification.permission==="default"?`<button class="btn sm" id="nt-alerta">Ativar alertas no navegador</button>`:"";
  return `<div class="nt-h"><b>Notificações</b><button class="btn sm" id="nt-lidas" ${A.novos?"":"disabled"}>${A.novos?"Marcar como lidas":"Tudo lido"}</button></div>
   <div class="nt-sec">Pendências <span>${A.pend.length}</span></div>${pend?pend+`<p class="nt-v" style="padding-top:6px">As pendências ficam na lista até serem resolvidas.</p>`:`<p class="nt-v">Nenhuma pendência com você.</p>`}
   <div class="nt-sec">Atualizações</div>${nov||`<p class="nt-v">Sem atualizações recentes.</p>`}
   <div class="nt-f">${alerta}<small>${Store.emailDisponivel?"Os avisos principais também chegam por e-mail, quando configurado pelo SPAT.":"Os avisos aparecem aqui sempre que você abrir o sistema."}</small></div>`;
}
function abrirAvisos(){
  const pn=$("notif"), b=$("sino"); if(!pn) return;
  if(!pn.hidden){pn.hidden=true;b.setAttribute("aria-expanded","false");return}
  pn.innerHTML=painelAvisos(avisos()); pn.hidden=false; b.setAttribute("aria-expanded","true");
  pn.onclick=e=>{const a=e.target.closest("a.nt-i");if(a){pn.hidden=true;b.setAttribute("aria-expanded","false")}
    if(e.target.id==="nt-lidas"){marcarLido();renderSino();render();toast("Notificações marcadas como lidas")}
    if(e.target.id==="nt-alerta"){Notification.requestPermission().then(()=>{pn.innerHTML=painelAvisos(avisos())})}};
}
function bannerPendencias(){
  const A=avisos(); if(!A.pend.length) return "";
  const g={}; A.pend.forEach(p=>{(g[p.t]=g[p.t]||[]).push(p)});
  return `<div class="avisos">${Object.entries(g).map(([t,l])=>{const k=l[0].k;const alvo=l.length===1?`#d-${esc(l[0].d.id)}`:"";
    return `<div class="aviso ${k}"><b>${l.length}</b><span>${esc(t)}${l.length===1?`: ${esc(l[0].d.titulo)}`:""}</span>${alvo?`<a class="btn sm" href="${alvo}">Abrir</a>`:`<button class="btn sm" data-pendgo="${esc(t)}">Ver ${l.length}</button>`}</div>`}).join("")}</div>`;
}

/* ---------- Detalhe ---------- */
function linkify(t){return esc(t).replace(/(https?:\/\/[^\s,;]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>')}
function telaDetalhe(id){
  const d=S.demandas.find(x=>x.id===id);
  if(!d) return S.loaded?vazio("Demanda não encontrada","Ela pode ter sido removida ou você não tem acesso a ela.",'<a class="btn" href="#demandas">Voltar às demandas</a>'):vazio("Carregando…","");
  if(!seesAll()&&d.solicitante!==S.me.id) return vazio("Sem acesso a esta demanda","Solicitantes veem apenas os próprios pedidos.",'<a class="btn" href="#inicio">Voltar</a>');
  const T=TIPOS[d.tipo]; const s=situacao(d); const et=T.etapas; const ativa=ativaD(d);
  const cur=et[d.etapa], prox=et[d.etapa+1];
  const direto = ativa && d.status==="aberta" && isTeam() && !T.fimManual && d.etapa===et.length-2 && !etAprov(cur);
  const podeAvancar = ativa && d.status==="aberta" && prox!==undefined && !direto && (etAprov(cur)? isChefe() : isTeam());
  const podeConcluir = (ativa && d.status==="aberta" && prox===undefined && isTeam()) || direto;
  const hist=(d.historico||[]).filter(h=>!(h.interna&&role()==="solicitante"));
  const decorrido=d.status==="planejada"?0:du(inicioD(d), d.concluidaEm||hoje());
  const stepsHtml=et.map((e,i)=>{const done=d.status==="concluida"||i<d.etapa;const c=!done&&i===d.etapa&&d.status!=="cancelada";const dt=(d.etapasDatas||[])[i];
    return `<li class="step ${done?"done":c?"cur":"todo"}"><span class="c">${done?"✓":i+1}</span><div><div class="n">${esc(etN(e))}${etAprov(e)?' <span class="tag">chefia</span>':""}</div><div class="d">${dt?(c?"desde ":"")+fmt(dt):c?"etapa atual":""}</div></div></li>`}).join("");
  const acoes=[];
  const planj=d.status==="planejada";
  if(isTeam()&&planj) acoes.push(`<button class="btn pri" data-act="iniciar">Iniciar agora</button><div class="row"><input type="date" id="d-ini" value="${String(d.inicio).slice(0,10)}" aria-label="Novo início previsto"><button class="btn sm" data-act="inicio">Ajustar início</button></div>`);
  if(isTeam()&&(ativa||planj)) acoes.push(`<div class="row"><select id="d-resp" aria-label="Responsável"><option value="">Sem responsável</option>${equipeIds().map(i=>`<option value="${esc(i)}" ${d.responsavel===i?"selected":""}>${esc(nome(i))}</option>`).join("")}</select>${d.responsavel!==S.me.id?`<button class="btn sm" data-act="assumir">Assumir</button>`:""}</div>`);
  if(podeAvancar) acoes.push(`<button class="btn pri" data-act="avancar">${etAprov(cur)?"Aprovar e seguir":"Avançar"} para: ${esc(etN(prox))}</button>`);
  else if(ativa&&d.status==="aberta"&&etAprov(cur)&&!isChefe()&&prox!==undefined) acoes.push(`<div class="note">Esta etapa depende da aprovação do Chefe de TT ou do Chefe-Geral.</div>`);
  if(podeConcluir&&S.form!=="entrega") acoes.push(`<button class="btn pri" data-act="concluir">${T.fimManual?"Registrar assinatura e entregar":"Concluir e entregar"}</button>`);
  if(isTeam()&&ativa){
    acoes.push(`<div class="row">${d.etapa>0&&d.status==="aberta"?`<button class="btn sm" data-act="voltar">Voltar etapa</button>`:""}${d.status==="aguardando"?`<button class="btn sm${d.respondido?" pri":""}" data-act="retomar">Retomar atendimento</button>`:S.form==="pausa"?"":`<button class="btn sm" data-act="pausar" title="Suspende a contagem do prazo e avisa o solicitante">Aguardar solicitante</button>`}</div>`);
    if(S.form==="pausa"&&d.status==="aberta") acoes.push(formPausa());
  }
  if(isTeam()&&(ativa||planj)) acoes.push(`<div class="row"><input type="date" id="d-prazo" value="${String(d.prazo).slice(0,10)}" aria-label="Nova data prevista"><button class="btn sm" data-act="prazo">${planj?"Ajustar término":"Ajustar prazo"}</button></div>`);
  if((ativa||planj)&&(isSup()||(d.solicitante===S.me.id&&d.etapa===0))) acoes.push(`<button class="btn sm danger" data-act="cancelar" style="align-self:flex-start">Cancelar demanda</button><div id="confcancel"></div>`);
  if(!ativa&&isSup()) acoes.push(`<button class="btn sm" data-act="reabrir" style="align-self:flex-start">Reabrir</button>`);
  return `<div><a href="#demandas" class="muted" style="font-size:.88rem">← ${seesAll()?"Demandas":"Minhas solicitações"}</a></div>
  <div class="head"><div style="min-width:0"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px"><span class="tag">${esc(d.cod)}</span><span class="dimtag">${esc(dimDe(d.tipo).curto)}</span><span class="pill ${s.k}">${s.t}</span>${d.urgencia==="alta"?'<span class="pill bad">Urgência alta</span>':""}${d.origem==="interna"?'<span class="pill mut">Ação interna</span>':""}${d.exemplo?'<span class="tag">exemplo</span>':""}</div><h1>${esc(d.titulo)}</h1><p>${esc(T.nome)} · etapa ${Math.min(d.etapa+1,et.length)} de ${et.length}: <b style="color:var(--ink)">${esc(etapaAtual(d))}</b></p></div></div>
  ${d.status==="aguardando"?`<div class="aviso-dem ${d.respondido?"ok":"warn"}"><b>${d.respondido?"O solicitante respondeu à pendência":d.solicitante===S.me.id?"O SPAT aguarda sua manifestação":"Aguardando o solicitante"}</b>${d.pendencia?`<div class="x">${esc(d.pendencia)}</div>`:""}<small>${d.respondido?(isTeam()?"Confira a resposta no histórico e retome o atendimento.":"A equipe foi avisada e vai retomar o atendimento."):d.solicitante===S.me.id?"Responda pela caixa de mensagem ou anexe o documento pedido. O prazo está suspenso e a equipe é avisada quando você responder.":`Prazo suspenso desde ${fmt(d.pausadoEm)}.`}</small></div>`:""}
  ${S.form==="entrega"&&podeConcluir?formEntrega(d,T):""}
  ${painelEntrega(d)}
  <div class="det">
    <div class="col">
      <div class="panel"><div class="lbl" style="margin-bottom:8px">Descrição</div><div style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(d.descricao)}</div>${d.links?`<div style="margin-top:10px;font-size:.88rem;overflow-wrap:anywhere"><span class="muted">Documentos:</span> ${linkify(d.links)}</div>`:""}</div>
      ${(d.ativos||[]).length?`<div class="panel"><div class="sec-t"><h2>Ativos</h2><span class="muted">${d.ativos.length}</span></div><div class="scroll"><table class="mini"><thead><tr><th>Ativo</th>${T.modo?"<th>Modo</th>":""}</tr></thead><tbody>${d.ativos.map(a=>`<tr><td>${esc(a.nome)}</td>${T.modo?`<td>${a.modo==="monitoramento"?"Monitoramento":"Avaliação"}</td>`:""}</tr>`).join("")}</tbody></table></div></div>`:""}
      ${painelAnexos(d)}
      <div class="panel"><div class="sec-t"><h2>Histórico e mensagens</h2><span class="muted">${hist.length}</span></div>
        <div class="tl">${hist.slice().reverse().map(h=>h.tipo==="comentario"?`<div class="ev ${h.interna?"int":""}">${avatarHtml(h.por)}<div class="b"><div class="m"><b style="color:var(--ink)">${esc(nome(h.por))}</b><span>${fmtH(h.em)}</span>${h.interna?"<span>nota interna</span>":""}</div><div class="x">${esc(h.t)}</div></div></div>`:`<div class="ev sys"><span></span><div class="b"><div class="m"><span>${fmtH(h.em)}</span><span>${esc(nome(h.por))}</span></div><div>${esc(h.t)}</div></div></div>`).join("")}</div>
        ${S.readOnly?"":`<div class="comp"><label class="lbl" for="d-msg">${role()==="solicitante"?"Mensagem para a equipe do SPAT":"Nova mensagem"}</label><textarea id="d-msg" placeholder="${role()==="solicitante"?"Envie dúvidas, documentos ou informações complementares":"Escreva para o solicitante ou registre uma nota"}"></textarea>
          <div class="row">${isTeam()||isChefe()?`<label><input type="checkbox" id="d-int"> Nota interna (o solicitante não vê)</label>`:"<span></span>"}<button class="btn pri" data-act="comentar">Enviar</button></div></div>`}
      </div>
    </div>
    <div class="col">
      <div class="panel"><dl class="kv">
        <dt>Solicitante</dt><dd>${esc(nome(d.solicitante))}</dd>
        <dt>Unidade</dt><dd>${esc(d.unidade||"—")}</dd>
        <dt>Contato</dt><dd>${esc(d.contato||"—")}</dd>
        ${d.parceiro?`<dt>Parceiro</dt><dd>${esc(d.parceiro)}</dd>`:""}
        <dt>Responsável</dt><dd>${esc(nome(d.responsavel))}</dd>
        <dt>Aberta em</dt><dd class="mono">${fmt(d.criadoEm)}</dd>${d.inicio&&fmt(d.inicio)!==fmt(d.criadoEm)?`<dt>Início</dt><dd class="mono">${fmt(d.inicio)}</dd>`:""}
        <dt>Previsão</dt><dd class="mono">${fmt(d.prazo)}</dd>
        ${d.concluidaEm?`<dt>Concluída em</dt><dd class="mono">${fmt(d.concluidaEm)}</dd>`:""}
        <dt>Decorrido</dt><dd>${decorrido} de ${slaDe(d.tipo)} d.u. de referência</dd>
      </dl><div class="bar" style="margin-top:12px"><i style="width:${progresso(d)}%"></i></div></div>
      ${acoes.length?`<div class="panel acts"><div class="lbl">Ações</div>${acoes.join("")}</div>`:""}
      <div class="panel"><div class="lbl" style="margin-bottom:12px">Etapas</div><ol class="steps">${stepsHtml}</ol></div>
    </div>
  </div>`;
}

/* ---------- Indicadores por dimensão ---------- */
function baseRel(){return S.demandas.filter(d=>!d.exemplo||S.incluiEx)}
function calcDim(dimId,P,base){
  const l=base.filter(d=>TIPOS[d.tipo].dim===dimId&&d.status!=="cancelada");
  const rec=l.filter(d=>d.status!=="planejada"&&dentro(inicioD(d),P));
  const con=l.filter(d=>d.status==="concluida"&&dentro(d.concluidaEm,P));
  const conAno=l.filter(d=>d.status==="concluida"&&d.concluidaEm&&new Date(d.concluidaEm).getFullYear()===P.ano).length;
  const and=l.filter(ativaD);
  const prazo=con.length?Math.round(con.filter(d=>dia(d.concluidaEm)<=dia(d.prazo)).length/con.length*100):null;
  const tempo=con.length?Math.round(con.reduce((a,d)=>a+du(inicioD(d),d.concluidaEm),0)/con.length):null;
  const tipos=Object.entries(TIPOS).filter(([,t])=>t.dim===dimId).map(([k,t])=>({k,t,rec:rec.filter(d=>d.tipo===k).length,con:con.filter(d=>d.tipo===k).length,and:and.filter(d=>d.tipo===k).length}));
  const meta=+(((S.cfg.metas?.map||{})[P.ano]||{})[dimId])||0;
  return {rec,con,and,prazo,tempo,tipos,atr:and.filter(atrasadaD).length,conAno,meta};
}
function dadosRelatorio(){
  const P=periodo(), base=baseRel();
  const dims=DIMS.map(d=>({d,...calcDim(d.id,P,base)}));
  const conAll=dims.flatMap(x=>x.con);
  const tot={rec:dims.reduce((a,x)=>a+x.rec.length,0),con:conAll.length,and:dims.reduce((a,x)=>a+x.and.length,0),atr:dims.reduce((a,x)=>a+x.atr,0),
    prazo:conAll.length?Math.round(conAll.filter(d=>dia(d.concluidaEm)<=dia(d.prazo)).length/conAll.length*100):null,
    tempo:conAll.length?Math.round(conAll.reduce((a,d)=>a+du(inicioD(d),d.concluidaEm),0)/conAll.length):null};
  const servicos=dims.flatMap(x=>x.tipos.map(t=>({dim:x.d.curto,nome:t.t.nome,ind:t.t.ind,rec:t.rec,con:t.con,and:t.and,sla:slaDe(t.k)})));
  const mensal=[];for(let m=P.i;m<=P.f;m++){const Q={ini:new Date(P.ano,m,1),fim:new Date(P.ano,m+1,1)};mensal.push({rotulo:`${MESES[m]}/${String(P.ano).slice(2)}`,rec:base.filter(d=>d.status!=="cancelada"&&d.status!=="planejada"&&dentro(inicioD(d),Q)).length,con:base.filter(d=>d.status==="concluida"&&dentro(d.concluidaEm,Q)).length})}
  const lin=d=>{const s=situacao(d);return {cod:d.cod,dim:dimDe(d.tipo).curto,servico:TIPOS[d.tipo].nome,titulo:d.titulo,origem:d.origem==="interna"?"Ação interna":"Solicitação",solicitante:nome(d.solicitante),unidade:d.unidade||"",parceiro:d.parceiro||"",responsavel:nome(d.responsavel),situacao:s.t,sitK:s.k,etapa:etapaAtual(d),criadoEm:inicioD(d),prazo:d.prazo,concluidaEm:d.concluidaEm||null,du:du(inicioD(d),d.concluidaEm||hoje())}};
  const lista=base.filter(d=>d.status!=="cancelada"&&(dentro(inicioD(d),P)||dentro(d.concluidaEm,P)||ativaD(d)||d.status==="planejada")).sort((a,b)=>inicioD(a)<inicioD(b)?-1:1).map(lin);
  const ativos=base.filter(z=>TIPOS[z.tipo].dim==="imp"&&z.status!=="cancelada"&&(ativaD(z)||z.status==="planejada"||dentro(z.concluidaEm,P))).flatMap(z=>(z.ativos||[]).map(a=>({nome:a.nome,modo:a.modo==="monitoramento"?"Monitoramento":"Avaliação",ciclo:z.titulo,cod:z.cod,etapa:etapaAtual(z),situacao:situacao(z).t,prazo:z.prazo,prazoTxt:fmt(z.prazo)})));
  const atrasadas=base.filter(atrasadaD).sort((a,b)=>a.prazo<b.prazo?-1:1).map(lin);
  const chefia=base.filter(d=>d.status==="aberta"&&etAprov(TIPOS[d.tipo].etapas[d.etapa])).map(lin);
  const top=dims.filter(x=>x.d.id!=="apo").slice().sort((a,b)=>b.con.length-a.con.length)[0];
  const destaque=tot.con?`${tot.con} entrega(s) concluída(s) no período, com destaque para ${top.d.curto.toLowerCase()} (${top.con.length}).${tot.atr?` ${tot.atr} demanda(s) em atraso hoje.`:" Nenhuma demanda em atraso hoje."}`:`Nenhuma entrega concluída no período.${tot.and?` ${tot.and} demanda(s) em andamento.`:""}`;
  return {per:P,geradoEm:new Date().toLocaleDateString("pt-BR"),dims,tot,servicos,mensal,lista,ativos,atrasadas,chefia,destaque,gantt:ganttDados(P.ini,P.fim,base,P.rotulo)};
}
function ganttDados(ini,fim,base,rotulo){
  const itens=base.filter(d=>d.status!=="cancelada").map(ganttItem).filter(it=>it.ini<fim&&it.fim>=ini).sort((a,b)=>DIMS.findIndex(x=>x.id===a.dimId)-DIMS.findIndex(x=>x.id===b.dimId)||a.ini-b.ini);
  const semanas=[];const w=new Date(ini);w.setDate(w.getDate()-((w.getDay()+6)%7));const h=hoje();
  while(w<fim){const a=new Date(w),b=new Date(w);b.setDate(b.getDate()+7);semanas.push({ini:a,fim:b,rotulo:`${String(a.getDate()).padStart(2,"0")}/${String(a.getMonth()+1).padStart(2,"0")}`,hoje:h>=a&&h<b});w.setDate(w.getDate()+7)}
  const meses=[];const m=new Date(ini.getFullYear(),ini.getMonth(),1);while(m<fim){const a=new Date(m),b=new Date(m.getFullYear(),m.getMonth()+1,1);meses.push({ini:a,fim:b>fim?fim:b,rotulo:`${MESES[a.getMonth()]}/${String(a.getFullYear()).slice(2)}`});m.setMonth(m.getMonth()+1)}
  return {ini,fim,rotulo,itens,semanas,meses,hojeDentro:h>=ini&&h<fim};
}
function telaIndicadores(){
  if(!seesAll()) return vazio("Área da equipe e da chefia","");
  const Rr=dadosRelatorio(); const P=Rr.per; const T=Rr.tot;
  const anos=[...new Set(S.demandas.map(d=>new Date(inicioD(d)).getFullYear()).concat([new Date().getFullYear()]))].sort((a,b)=>b-a);
  const blocos=Rr.dims.map(x=>{const d=x.d;let extra="";
    if(d.id==="imp"){const av=Rr.ativos.filter(a=>a.modo==="Avaliação").length;extra=`<div class="met azul"><b>${av}</b><span>Ativos em avaliação</span></div><div class="met azul"><b>${Rr.ativos.length-av}</b><span>Ativos em monitoramento</span></div>`}
    return `<section class="panel ind"><div class="dimhd"><span class="num">${d.n}</span><h2>${esc(d.nome)}</h2></div>
     <div class="mets"><div class="met"><b>${x.rec.length}</b><span>Recebidas no período</span></div><div class="met"><b>${x.con.length}</b><span>Entregas concluídas</span></div><div class="met"><b>${x.and.length}</b><span>Em andamento hoje${x.atr?` · ${x.atr} atrasada(s)`:""}</span></div><div class="met"><b>${x.prazo==null?"—":x.prazo+"%"}</b><span>Concluídas no prazo</span></div><div class="met"><b>${x.tempo==null?"—":x.tempo}</b><span>Tempo médio (d.u.)</span></div>${extra}</div>
     ${x.meta?`<div class="meta"><span>Meta ${P.ano}: <b>${x.conAno} de ${x.meta}</b> entregas no ano</span><div class="bar"><i style="width:${Math.min(100,x.conAno/x.meta*100)}%"></i></div><span class="mono">${Math.round(x.conAno/x.meta*100)}%</span></div>`:""}
     <div class="scroll"><table class="mini"><thead><tr><th>Indicador de entrega</th><th style="text-align:right">Recebidas</th><th style="text-align:right">Concluídas</th><th style="text-align:right">Em andamento</th></tr></thead><tbody>${x.tipos.map(y=>`<tr><td>${esc(y.t.ind)}</td><td class="n">${y.rec}</td><td class="n">${y.con}</td><td class="n">${y.and}</td></tr>`).join("")}</tbody></table></div></section>`}).join("");
  return `<div class="head"><div><h1>Indicadores do SPAT</h1><p>${esc(P.rotulo)} · entregas e desempenho por dimensão de atuação</p></div></div>
   <div class="panel" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between">
    <div class="filters"><select id="iano" class="inp" aria-label="Ano">${anos.map(a=>`<option ${a===S.ano?"selected":""}>${a}</option>`).join("")}</select><select id="iper" class="inp" aria-label="Período">${PERIODOS.map(([k,t])=>`<option value="${k}" ${S.per===k?"selected":""}>${t}</option>`).join("")}</select>${S.demandas.some(d=>d.exemplo)?`<label style="font-size:.85rem"><input type="checkbox" id="iex" ${S.incluiEx?"checked":""}> Incluir exemplos</label>`:""}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" id="xlsx">Exportar Excel</button><button class="btn pri" id="pptx">Gerar apresentação</button><button class="btn" id="csv">CSV</button></div></div>
   <div class="kpis"><div class="kpi"><b>${T.rec}</b><span>Recebidas no período</span></div><div class="kpi"><b>${T.con}</b><span>Concluídas no período${T.prazo!=null?` · ${T.prazo}% no prazo`:""}</span></div><div class="kpi"><b>${T.and}</b><span>Em andamento hoje</span></div><div class="kpi ${T.atr?"bad":""}"><b>${T.atr}</b><span>Atrasadas hoje</span></div></div>
   ${blocos}
   <p class="note">Recebidas pela data de início e concluídas pela data de conclusão dentro do período; em andamento e atrasadas na posição de hoje; canceladas e ações apenas planejadas não entram. O Excel traz resumo, entregas por serviço, evolução mensal, cronograma, lista de demandas e carteira de impactos, com gráficos. A apresentação traz capa, visão geral, evolução, um slide por dimensão, cronograma, impactos e pontos de atenção.${isSup()?' Metas anuais por dimensão: <a href="#config">Configurações</a>.':""}</p>`;
}

/* ---------- Cronograma (Gantt) ---------- */
function telaCronograma(){
  if(!seesAll()) return vazio("Área da equipe e da chefia","");
  const g=S.gj; const h=hoje();
  const ini=new Date(h.getFullYear(),h.getMonth()-1+g.desloc,1), fim=new Date(ini.getFullYear(),ini.getMonth()+g.meses,1);
  const base=S.demandas.filter(d=>(g.concl||d.status!=="concluida")&&(!g.dim||TIPOS[d.tipo].dim===g.dim)&&(!g.resp||(g.resp==="sem"?!d.responsavel:d.responsavel===g.resp)));
  const G=ganttDados(ini,fim,base,"");
  const span=+fim-+ini, pos=d=>Math.max(0,Math.min(100,(+d-+ini)/span*100));
  const mesesHtml=G.meses.map(m=>`<span style="left:${pos(m.ini)}%;width:${pos(m.fim)-pos(m.ini)}%">${m.rotulo}</span>`).join("");
  const grades=G.meses.slice(1).map(m=>`<i class="gm" style="left:${pos(m.ini)}%"></i>`).join("")+(G.hojeDentro?`<i class="gh" style="left:${pos(h)}%"></i>`:"");
  let dimAtual=null; const linhas=[];
  for(const it of G.itens){
    if(it.dimId!==dimAtual){dimAtual=it.dimId;const D=DIMS.find(x=>x.id===dimAtual);linhas.push(`<div class="g-grp"><span>${esc(D.n==="·"?"":D.n+". ")}${esc(D.nome)}</span></div>`)}
    const a=pos(it.ini), b=pos(it.prev), f=pos(it.feitoAte), r=it.atrasoAte?pos(it.atrasoAte):null;
    const tip=`${it.cod} · ${it.titulo}\nInício ${fmt(it.ini)} · Previsão ${fmt(it.prev)}${it.concluida?` · Concluída ${fmt(it.d.concluidaEm)}`:""}\nEtapa: ${etapaAtual(it.d)} · ${situacao(it.d).t}`;
    linhas.push(`<a class="g-row" href="#d-${esc(it.id)}" title="${esc(tip)}"><div class="g-lbl"><span class="mono">${esc(it.cod)}</span><b>${esc(it.titulo)}</b><small>${esc(it.resp)} · ${esc(situacao(it.d).t)}</small></div>
      <div class="g-trk">${grades}${b>a?`<i class="gb ${it.planejada?"fut":"plan"}" style="left:${a}%;width:${b-a}%"></i>`:""}${!it.planejada&&f>a?`<i class="gb feito" style="left:${a}%;width:${f-a}%"></i>`:""}${r!=null&&r>b?`<i class="gb atr" style="left:${b}%;width:${r-b}%"></i>`:""}${it.concluida?`<i class="gmk" style="left:${pos(it.feitoAte)}%"></i>`:""}</div></a>`);
  }
  const rotJ=`${G.meses[0].rotulo} a ${G.meses.at(-1).rotulo}`;
  return `<div class="head"><div><h1>Cronograma</h1><p>Acompanhamento e planejamento das ações do SPAT · ${rotJ}</p></div>${isTeam()?`<a class="btn pri" href="#nova" id="planejar">Planejar ação</a>`:""}</div>
  <div class="filters">
    <select id="gmeses" class="inp" aria-label="Janela">${[[3,"3 meses"],[6,"6 meses"],[12,"12 meses"]].map(([v,t])=>`<option value="${v}" ${g.meses===v?"selected":""}>${t}</option>`).join("")}</select>
    <button class="btn sm" id="gant" aria-label="Período anterior">◀</button><button class="btn sm" id="ghoje">Hoje</button><button class="btn sm" id="gprox" aria-label="Próximo período">▶</button>
    <select id="gdim" class="inp" aria-label="Dimensão"><option value="">Todas as dimensões</option>${DIMS.map(d=>`<option value="${d.id}" ${g.dim===d.id?"selected":""}>${esc(d.curto)}</option>`).join("")}</select>
    <select id="gresp" class="inp" aria-label="Responsável"><option value="">Qualquer responsável</option><option value="sem" ${g.resp==="sem"?"selected":""}>Sem responsável</option>${equipeIds().map(id=>`<option value="${esc(id)}" ${g.resp===id?"selected":""}>${esc(nome(id))}</option>`).join("")}</select>
    <label style="font-size:.85rem"><input type="checkbox" id="gconcl" ${g.concl?"checked":""}> Mostrar concluídas</label>
  </div>
  <div class="panel flush gantt"><div class="g-in">
    <div class="g-row g-head"><div class="g-lbl"><span class="lbl">Ação</span></div><div class="g-trk g-meses">${mesesHtml}${G.hojeDentro?`<em style="left:${pos(h)}%">hoje</em>`:""}</div></div>
    ${linhas.length?linhas.join(""):`<div style="padding:30px 16px">${vazio("Nenhuma ação nesta janela","Mude a janela de tempo ou os filtros. A equipe pode planejar ações futuras pelo botão Planejar ação.")}</div>`}
  </div></div>
  <div class="g-leg"><span><i class="gb feito"></i>Executado (proporção de etapas)</span><span><i class="gb plan"></i>Planejado até a previsão</span><span><i class="gb fut"></i>Ação planejada, não iniciada</span><span><i class="gb atr"></i>Atraso</span><span><i class="gmk" style="position:static;display:inline-block"></i>Conclusão</span></div>`;
}
/* ---------- Carteira de impactos ---------- */
function telaImpactos(){
  const l=visiveis().filter(d=>TIPOS[d.tipo].dim==="imp"&&d.status!=="cancelada");
  const ativos=l.flatMap(d=>(d.ativos||[]).map(a=>({...a,d})));
  const av=ativos.filter(a=>a.modo!=="monitoramento").length;
  return `<div class="head"><div><h1>Carteira de impactos</h1><p>Ciclos de avaliação, monitoramentos de adoção e os ativos acompanhados pelo SPAT.</p></div>${isTeam()?`<a class="btn pri" href="#nova" data-tipo="impacto">Planejar ciclo de avaliação</a>`:""}</div>
  <div class="kpis"><div class="kpi"><b>${l.filter(ativaD).length}</b><span>Ciclos e estudos em andamento</span></div><div class="kpi"><b>${ativos.length}</b><span>Ativos na carteira</span></div><div class="kpi"><b>${av}</b><span>Em avaliação</span></div><div class="kpi"><b>${ativos.length-av}</b><span>Em monitoramento</span></div></div>
  <div class="panel flush">${ativos.length?`<div class="scroll"><table class="mini"><thead><tr><th>Ativo</th><th>Modo</th><th>Ciclo ou estudo</th><th>Etapa</th><th>Previsão</th></tr></thead><tbody>${ativos.map(a=>`<tr><td><b>${esc(a.nome)}</b></td><td>${a.modo==="monitoramento"?'<span class="pill info">Monitoramento</span>':'<span class="pill ok">Avaliação</span>'}</td><td><a href="#d-${esc(a.d.id)}">${esc(a.d.titulo)}</a></td><td>${esc(etapaAtual(a.d))}</td><td class="mono">${fmt(a.d.prazo)}</td></tr>`).join("")}</tbody></table></div>`:vazio("Nenhum ativo na carteira de impactos","Planeje um ciclo de avaliação e indique quais ativos serão avaliados ou monitorados.",isTeam()?'<a class="btn pri" href="#nova" data-tipo="impacto">Planejar ciclo</a>':"")}</div>`;
}

/* ---------- Cadastros (supervisor) ---------- */
function telaCadastros(){
  if(!isSup()) return vazio("Área do supervisor","");
  const ps=Object.entries(S.perfis);
  const pend=ps.filter(([,p])=>p.status==="pendente"), at=ps.filter(([,p])=>p.status==="ativo"), outros=ps.filter(([,p])=>["recusado","inativo"].includes(p.status));
  const sel=(id,v)=>`<select data-papel="${esc(id)}" class="inp" aria-label="Perfil">${Object.entries(ROLES_CURTO).map(([k,t])=>`<option value="${k}" ${v===k?"selected":""}>${t}</option>`).join("")}</select>`;
  return `<div class="head"><div><h1>Cadastros</h1><p>Valide os autocadastros e ajuste o perfil de acesso de cada pessoa.</p></div></div>
  <div class="panel flush"><div class="sec-t"><h2>Aguardando validação</h2><span class="muted">${pend.length}</span></div>
   ${pend.length?`<div class="scroll"><table class="mini"><thead><tr><th>Pessoa</th><th>Setor e função</th><th>Justificativa</th><th>Perfil a conceder</th><th></th></tr></thead><tbody>${pend.map(([id,p])=>`<tr><td><b>${esc(p.nome)}</b><br><span class="muted">${esc(p.email||"")}${p.matricula?` · mat. ${esc(p.matricula)}`:""}</span><br><span class="muted mono">${fmt(p.criadoEm)}</span></td><td>${esc(p.setor||"—")}<br><span class="muted">${esc(p.cargo||"")}${p.ramal?` · ${esc(p.ramal)}`:""}</span></td><td style="max-width:240px">${esc(p.justificativa||"—")}</td><td>${sel(id,p.papelSolicitado||"solicitante")}</td><td style="white-space:nowrap"><button class="btn sm pri" data-aprovar="${esc(id)}">Aprovar</button> <button class="btn sm danger" data-recusar="${esc(id)}">Recusar</button></td></tr>`).join("")}</tbody></table></div>`:vazio("Nenhum cadastro pendente","Quem acessar o sistema pela primeira vez preenche o cadastro e aparece aqui.")}</div>
  <div class="panel flush"><div class="sec-t"><h2>Usuários ativos</h2><span class="muted">${at.length}</span></div>
   ${at.length?`<div class="scroll"><table class="mini"><thead><tr><th>Pessoa</th><th>Setor</th><th>Perfil</th><th></th></tr></thead><tbody>${at.map(([id,p])=>`<tr><td><b>${esc(p.nome)}</b><br><span class="muted">${esc(p.email||"")}</span></td><td>${esc(p.setor||"—")}</td><td>${sel(id,p.papel)}</td><td><button class="btn sm" data-desativar="${esc(id)}">Desativar</button></td></tr>`).join("")}</tbody></table></div>`:vazio("Nenhum usuário ativo","")}</div>
  ${outros.length?`<div class="panel flush"><div class="sec-t"><h2>Recusados ou desativados</h2><span class="muted">${outros.length}</span></div><div class="scroll"><table class="mini"><tbody>${outros.map(([id,p])=>`<tr><td><b>${esc(p.nome)}</b><br><span class="muted">${esc(p.email||"")}</span></td><td>${p.status==="recusado"?"Recusado":"Desativado"}</td><td><button class="btn sm" data-reativar="${esc(id)}">Reativar</button></td></tr>`).join("")}</tbody></table></div></div>`:""}
  <p class="note">${Store.mode==="claude"?"No claude.ai, cada pessoa também precisa de acesso de Colaborador à página (menu Compartilhar) para se cadastrar e enviar solicitações. Supervisores precisam de acesso de Editor.":"O primeiro usuário cadastrado torna-se Supervisor automaticamente. Os demais aguardam validação."}</p>`;
}

/* ---------- Configurações (supervisor) ---------- */
function telaConfig(){
  if(!isSup()) return vazio("Área do supervisor","");
  const ano=S.ano; const metas=(S.cfg.metas?.map||{})[ano]||{}; const off=S.cfg.servicos?.off||[];
  const marca=S.cfg.marca||{};
  const ex=S.demandas.filter(d=>d.exemplo).length;
  return `<div class="head"><div><h1>Configurações</h1><p>Prazos de referência, serviços oferecidos, metas por dimensão e identidade visual.</p></div></div>
  <div class="grid2"><form class="panel" id="fsla"><div class="sec-t"><h2>Serviços e prazos</h2><span class="lbl">dias úteis · oferecido</span></div>
   ${DIMS.map(d=>`<div class="lbl" style="margin:14px 0 6px;color:var(--ok)">${esc(d.curto)}</div>${Object.entries(TIPOS).filter(([,t])=>t.dim===d.id).map(([k,t])=>`<div style="display:grid;grid-template-columns:minmax(0,1fr) 72px 26px;gap:10px;align-items:center;padding:3px 0"><label for="sla-${k}" style="font-size:.88rem">${esc(t.nome)}</label><input class="inp" id="sla-${k}" type="number" min="1" max="365" value="${slaDe(k)}"><input type="checkbox" id="on-${k}" ${off.includes(k)?"":"checked"} aria-label="Oferecer ${esc(t.nome)}"></div>`).join("")}`).join("")}
   <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn pri">Salvar serviços e prazos</button></div>
   <p class="note" style="margin:12px 0 0">Novos prazos valem para novas solicitações. Serviços desmarcados deixam de aparecer no catálogo, mas as demandas já abertas continuam.</p></form>
  <div class="col">
   <form class="panel" id="fmetas"><div class="sec-t"><h2>Metas de entregas</h2><select id="mano" class="inp" aria-label="Ano">${[ano-1,ano,ano+1].map(a=>`<option ${a===ano?"selected":""}>${a}</option>`).join("")}</select></div>
    ${DIMS.map(d=>`<div style="display:grid;grid-template-columns:minmax(0,1fr) 80px;gap:10px;align-items:center;padding:3px 0"><label for="meta-${d.id}" style="font-size:.88rem">${esc(d.nome)}</label><input class="inp" id="meta-${d.id}" type="number" min="0" value="${metas[d.id]||""}"></div>`).join("")}
    <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn pri">Salvar metas</button></div></form>
   <div class="panel"><div class="sec-t"><h2>Marca Embrapa</h2></div>
    <div class="logo-prev"><div class="pl"><img src="${esc(window.MARCA?MARCA.cor:"")}" alt="Marca Embrapa, versão colorida"></div><div class="pl neg"><img src="${esc(window.MARCA?MARCA.negativa:"")}" alt="Marca Embrapa, versão negativa"></div><div class="pl"><img src="${esc(window.MARCA?MARCA.preta:"")}" alt="Marca Embrapa, versão monocromática"></div></div>
    <p class="note" style="margin:12px 0 0">As três versões oficiais estão incorporadas ao sistema. A colorida aparece no cabeçalho, na planilha e na apresentação, sempre sobre fundo branco, com fio separador e o nome síntese da Unidade.</p></div>
   <div class="panel"><div class="sec-t"><h2>Notificações</h2></div>
    ${Store.emailDisponivel?`<p class="muted" style="margin:0 0 10px;font-size:.88rem">Os e-mails automáticos usam este endereço nos botões "Abrir no sistema".</p>
     <div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><input id="cfg-url" class="inp" style="flex:1 1 240px" value="${esc(S.cfg.sistema?.url||location.origin+location.pathname)}"><button class="btn sm" id="tcfg-url">Salvar</button></div>
     <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn sm" id="tcfg-email">Enviar e-mail de teste para mim</button></div>
     <p class="note" style="margin:12px 0 0">E-mails enviados: nova demanda sem responsável e resumo semanal às segundas (supervisores), demanda atribuída (responsável), pendência (solicitante), resposta do solicitante (responsável), aprovação pendente (chefias) e entrega concluída (solicitante). A configuração do serviço de e-mail está no README, seção Notificações por e-mail.</p>`
     :`<p class="note" style="margin:0">Nesta versão, os avisos aparecem no sino do sistema e no painel de cada pessoa. Avisos por e-mail estão disponíveis na instalação própria (GitHub e Supabase).</p>`}</div>
   <div class="panel"><div class="sec-t"><h2>Dados de exemplo</h2></div>
    <p class="muted" style="margin:0 0 12px;font-size:.88rem">Insere cinco demandas marcadas como exemplo, uma por dimensão, para treinar a equipe. Os indicadores ignoram exemplos por padrão.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="seed">Inserir exemplos</button><button class="btn danger" id="unseed" ${ex?"":"disabled"}>Remover ${ex} exemplo(s)</button></div></div>
  </div></div>`;
}

/* ---------- Diagnóstico de conexão ---------- */
function dicaErro(m){m=String(m||"");
  if(/does not exist|schema cache|relation|42P01|PGRST205/i.test(m)) return "As tabelas não foram encontradas no banco. No Supabase, abra SQL Editor, cole todo o arquivo supabase/schema.sql e clique em Run.";
  if(/api ?key|apikey|JWT|Invalid|401|unauthorized/i.test(m)) return "A chave ou a URL do config.js não foram aceitas. Confira a Project URL e a chave publicável (sb_publishable_…) em Settings → API Keys.";
  if(/permission|policy|row-level|42501/i.test(m)) return "O banco recusou a leitura pelas regras de acesso. Execute novamente o supabase/schema.sql completo.";
  if(/fetch|network|Failed to/i.test(m)) return "O navegador não alcançou o Supabase. Confira a conexão, a URL do config.js e se o projeto não está pausado no painel do Supabase.";
  return "Envie esta mensagem ao administrador do sistema.";}
window.SPAT_ERRO=m=>{if(S.erro===m)return;S.erro=m;console.error("SPAT:",m);if(!S.loaded){S.stale=true;S.loaded=true}render()};
window.addEventListener("unhandledrejection",e=>window.SPAT_ERRO(e.reason?.message||String(e.reason)));
window.addEventListener("error",e=>{if(e.message)window.SPAT_ERRO(e.message)});
/* ---------- Render ---------- */
async function render(){try{await render0()}catch(e){console.error(e);const v=$("view");if(v)v.innerHTML=`<div class="banner"><b>Erro ao exibir a tela:</b> ${esc(e.message)}</div>`}}
async function render0(){
  const r=rota(); const v=$("view");
  if(S.precisaLogin){nav();v.innerHTML=telaLogin();bind();return}
  if(!S.loaded && !S.stale){nav();v.innerHTML=vazio("Carregando o Sistema SPAT…","As informações aparecem assim que a conexão com a base for confirmada.");return}
  if(Store.nomes){const ids=S.demandas.flatMap(d=>[d.solicitante,d.responsavel,...(d.historico||[]).map(h=>h.por)]).concat(Object.keys(S.perfis),[S.me?.id]).filter(i=>i&&!S.prof[i]);if(ids.length)Object.assign(S.prof,await Store.nomes([...new Set(ids)]))}
  nav();
  const banner = S.stale?`<div class="banner"><b>Não foi possível confirmar a conexão com a base.</b>${S.erro?`<br>Erro: <span class="mono">${esc(S.erro)}</span><br>${esc(dicaErro(S.erro))}`:" As informações podem estar desatualizadas. Recarregue a página; se persistir, abra o console do navegador (F12) e envie o erro em vermelho ao administrador."}</div>`:"";
  let html;
  if(!realRole()) html=telaCadastro();
  else if(r.startsWith("d-")) html=telaDetalhe(r.slice(2));
  else html=({nova:telaNova,servicos:telaServicos,demandas:telaLista,cronograma:telaCronograma,indicadores:telaIndicadores,impactos:telaImpactos,cadastros:telaCadastros,config:telaConfig}[r]||telaInicio)();
  const foco=document.activeElement?.id; let pos=null; try{pos=foco&&document.activeElement.selectionStart}catch(e){}
  const keep={}; if(r===S.lastRoute&&!S.noKeep) v.querySelectorAll("input[id],textarea[id]").forEach(el=>{if(el.id!=="fq"&&el.type!=="file")keep[el.id]=el.type==="checkbox"?el.checked:el.value});
  if(r!==S.lastRoute){S.form=null;S.axModo=null}
  S.noKeep=false; S.lastRoute=r;
  v.innerHTML=banner+html;
  for(const [k,val] of Object.entries(keep)){const el=$(k);if(el){if(el.type==="checkbox")el.checked=val;else el.value=val}}
  if(foco&&$(foco)){$(foco).focus();try{if(pos!=null)$(foco).setSelectionRange(pos,pos)}catch(e){}}
  if(r.startsWith("d-")){const d=S.demandas.find(x=>x.id===r.slice(2));const h=d?.historico||[];if(d&&h.length&&seen[d.id]!==h[h.length-1].em){seen[d.id]=h[h.length-1].em;saveSeen()}}
  bind(); renderSino();
}

/* ---------- Escrita ---------- */
function evento(t){return {em:new Date().toISOString(),por:S.me.id,t,tipo:"sistema"}}
async function mutate(id,fn){
  try{const atual=await Store.getDemanda(id); if(!atual) throw {code:"gone"};
    const d=JSON.parse(JSON.stringify(atual)); fn(d); d.atualizadoEm=new Date().toISOString();
    d.aguardaChefia=d.status==="aberta"&&!!TIPOS[d.tipo]&&etAprov(TIPOS[d.tipo].etapas[d.etapa]);
    await Store.setDemanda(id,d); return true;
  }catch(e){falha(e);return false}
}
function falha(e){
  if(e?.code==="invalid_argument"||e?.code==="42501"){S.readOnly=true;toast("Seu acesso não permite gravar esta informação.");render()}
  else if(e?.code==="quota_exceeded") toast("A base atingiu o limite de registros. Remova demandas antigas ou de exemplo.");
  else toast("Não foi possível salvar agora. Tente de novo em instantes.");
}
function novoCod(tipo){const d=new Date();const a=String(d.getFullYear()).slice(2)+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0");const z="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let s="";for(let i=0;i<3;i++)s+=z[Math.floor(Math.random()*z.length)];return `${TIPOS[tipo].sigla}-${a}-${s}`}
function montar(o){
  const cod=novoCod(o.tipo); const agora=o.criadoEm||new Date().toISOString(); const n=TIPOS[o.tipo].etapas.length;
  const ini=o.inicio?new Date(o.inicio+"T12:00:00").toISOString():agora; const plan=dia(ini)>hoje();
  const prazo=o.fim?new Date(o.fim+"T12:00:00").toISOString():addDU(ini,slaDe(o.tipo)).toISOString();
  const datas=Array(n).fill(null); if(!plan) datas[0]=ini;
  return {id:cod.toLowerCase(),body:{cod,tipo:o.tipo,dim:TIPOS[o.tipo].dim,titulo:o.titulo,descricao:o.descricao,unidade:o.unidade||"",contato:o.contato||"",parceiro:o.parceiro||"",urgencia:o.urgencia||"normal",links:o.links||"",origem:o.origem||"solicitacao",
    solicitante:S.me.id,responsavel:o.responsavel||null,criadoEm:agora,inicio:ini,prazo,etapa:0,status:plan?"planejada":"aberta",etapasDatas:datas,anexos:[],aguardaChefia:false,ativos:o.ativos||[],
    historico:[{em:agora,por:S.me.id,t:plan?`Ação planejada para início em ${fmt(ini)}`:o.origem==="interna"?"Ação interna registrada pelo SPAT":"Solicitação enviada ao SPAT",tipo:"sistema"}],atualizadoEm:agora,...(o.exemplo?{exemplo:true}:{})}};
}
function csv(){
  const cols=["codigo","dimensao","servico","titulo","origem","solicitante","unidade","parceiro","responsavel","situacao","etapa","aberta_em","previsao","concluida_em","dias_uteis"];
  const q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const rows=visiveis().map(d=>[d.cod,dimDe(d.tipo).nome,TIPOS[d.tipo].nome,d.titulo,d.origem,nome(d.solicitante),d.unidade,d.parceiro,nome(d.responsavel),situacao(d).t,etapaAtual(d),fmt(d.criadoEm),fmt(d.prazo),d.concluidaEm?fmt(d.concluidaEm):"",du(d.criadoEm,d.concluidaEm||hoje())].map(q).join(";"));
  Store.baixar(`spat-demandas-${new Date().toISOString().slice(0,10)}.csv`,new Blob(["\ufeff"+cols.join(";")+"\n"+rows.join("\n")],{type:"text/csv;charset=utf-8"})).then(()=>toast("Arquivo gerado")).catch(()=>toast("O download não foi concluído."));
}
async function exportar(tipo,btn){
  const txt=btn.textContent;btn.disabled=true;btn.textContent="Gerando…";
  try{const Rr=dadosRelatorio();const per=S.per==="ano"?String(S.ano):`${S.per}-${S.ano}`;
    const bytes=tipo==="xlsx"?await Export.xlsx(Rr):await Export.pptx(Rr);
    const mime=tipo==="xlsx"?"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"application/vnd.openxmlformats-officedocument.presentationml.presentation";
    await Store.baixar(`spat-indicadores-${per}.${tipo}`,new Blob([bytes],{type:mime}));toast(tipo==="xlsx"?"Planilha gerada":"Apresentação gerada");
  }catch(e){console.error(e);toast(e?.message?.startsWith("Não foi")?e.message:"Não foi possível gerar o arquivo.")}
  btn.disabled=false;btn.textContent=txt;
}

/* ---------- Eventos ---------- */
function lerDraft(){
  const D=S.draft; if(!D) return; const g=id=>$(id)?.value;
  if($("n-titulo")){D.titulo=g("n-titulo");D.descricao=g("n-desc");D.unidade=g("n-unid");D.contato=g("n-cont");D.urgencia=g("n-urg");D.links=g("n-links");if($("n-origem"))D.origem=g("n-origem");if($("n-parc"))D.parceiro=g("n-parc");if($("n-ini")){D.inicio=g("n-ini");D.fim=g("n-fim")}}
  D.ativos=D.ativos.map((a,i)=>$("a-n-"+i)?{nome:g("a-n-"+i),modo:g("a-m-"+i)||"avaliacao"}:a);
}
const escolherTipo=k=>{const D=novoDraft();D.tipo=k;if(TIPOS[k].interna&&isTeam())D.origem="interna"};
function bind(){
  const on=(sel,ev,fn)=>document.querySelectorAll(sel).forEach(el=>el[ev]=()=>fn(el));
  // acesso
  on("[data-tab]","onclick",b=>{S.authTab=b.dataset.tab;render()});
  if($("fauth")) $("fauth").onsubmit=async e=>{e.preventDefault();const em=$("a-email").value.trim(),pw=$("a-senha")?.value;const btn=e.target.querySelector("button");btn.disabled=true;
    try{if(S.authTab==="entrar")await Store.auth.entrar(em,pw);else if(S.authTab==="criar"){await Store.auth.criarConta(em,pw);toast("Conta criada. Confirme o e-mail recebido e entre.");S.authTab="entrar";render()}else{await Store.auth.redefinir(em);toast("Enviamos o link de redefinição para o e-mail.")}}
    catch(err){toast(err?.message||"Não foi possível concluir. Confira e-mail e senha.")}btn.disabled=false};
  if($("editcad")) $("editcad").onclick=()=>{S.editCad=true;render()};
  if($("fcad")) $("fcad").onsubmit=async e=>{e.preventDefault();const g=id=>$(id).value.trim();
    const papel=g("c-papel");if(papel!=="solicitante"&&!g("c-just")){toast("Informe a justificativa para o perfil solicitado.");return}
    try{await Store.salvarCadastro({nome:g("c-nome"),email:g("c-email"),matricula:g("c-mat"),setor:g("c-setor"),cargo:g("c-cargo"),ramal:g("c-ramal"),papelSolicitado:papel,justificativa:g("c-just"),criadoEm:new Date().toISOString()});S.editCad=false;toast("Cadastro enviado para validação")}catch(err){falha(err)}};
  // painel
  on("[data-go]","onclick",b=>{Object.assign(S.filtro,{status:b.dataset.go,dim:"",tipo:"",resp:""});location.hash="demandas"});
  document.querySelectorAll("a[data-tipo]").forEach(a=>a.addEventListener("click",()=>{S.draft=null;escolherTipo(a.dataset.tipo);if(rota()==="nova"){S.noKeep=true;render()}}));
  // lista
  if($("fq")){$("fq").oninput=e=>{S.filtro.q=e.target.value;render()};$("fd").onchange=e=>{S.filtro.dim=e.target.value;S.filtro.tipo="";render()};$("ft").onchange=e=>{S.filtro.tipo=e.target.value;render()};$("fs").onchange=e=>{S.filtro.status=e.target.value;render()};if($("fr"))$("fr").onchange=e=>{S.filtro.resp=e.target.value;render()}}
  if($("csv")) $("csv").onclick=csv;
  // nova
  on("[data-pick]","onclick",b=>{lerDraft();escolherTipo(b.dataset.pick);S.noKeep=true;render()});
  if($("trocar")) $("trocar").onclick=()=>{lerDraft();S.draft.tipo="";render()};
  if($("addasset")) $("addasset").onclick=()=>{lerDraft();S.draft.ativos.push({nome:"",modo:"avaliacao"});S.noKeep=true;render()};
  on("[data-rmasset]","onclick",b=>{lerDraft();S.draft.ativos.splice(+b.dataset.rmasset,1);if(!S.draft.ativos.length)S.draft.ativos.push({nome:"",modo:"avaliacao"});S.noKeep=true;render()});
  if($("n-ini")) $("n-ini").onchange=()=>{lerDraft();S.draft.fim="";S.noKeep=true;render()};
  if($("n-fim")) $("n-fim").onchange=()=>{lerDraft();S.noKeep=true;render()};
  if($("ncancel")) $("ncancel").onclick=()=>{S.draft=null;S.noKeep=true;render()};
  if($("fnova")) $("fnova").onsubmit=async e=>{
    e.preventDefault(); lerDraft(); const D=S.draft;
    if(!D.titulo.trim()||!D.descricao.trim()){toast("Preencha título e descrição.");return}
    const btn=$("nsend"); btn.disabled=true; btn.textContent="Enviando…";
    const {id,body}=montar({...D,ativos:TIPOS[D.tipo].ativos?D.ativos.filter(a=>a.nome.trim()):[]});
    try{await Store.setDemanda(id,body);S.draft=null;toast("Solicitação enviada");location.hash="d-"+id}catch(err){btn.disabled=false;btn.textContent="Enviar solicitação";falha(err)}
  };
  // detalhe
  const r=rota(); if(r.startsWith("d-")){const id=r.slice(2);
    if($("d-resp")) $("d-resp").onchange=e=>{const v=e.target.value||null;mutate(id,d=>{d.responsavel=v;d.historico.push(evento(v?`Responsável definido: ${nome(v)}`:"Responsável removido"))}).then(ok=>ok&&toast("Responsável atualizado"))};
    on("[data-act]","onclick",b=>acao(id,b.dataset.act,b));
    on("[data-axmodo]","onclick",b=>{S.axModo=S.axModo===b.dataset.axmodo?null:b.dataset.axmodo;S.noKeep=true;render()});
    on("[data-copiar]","onclick",b=>{const t=b.dataset.copiar;try{navigator.clipboard.writeText(t).then(()=>toast("Número copiado"),()=>toast(t))}catch(e){toast(t)}});
    on("[data-baixar]","onclick",async b=>{const d=S.demandas.find(x=>x.id===id);const a=(d.anexos||[])[+b.dataset.baixar];b.disabled=true;try{await Store.abrirAnexo(a)}catch(e){toast(e.message||"Não foi possível baixar o arquivo.")}b.disabled=false});
    on("[data-rmanexo]","onclick",b=>{const i=+b.dataset.rmanexo;mutate(id,x=>{const a=(x.anexos||[])[i];if(!a)return;x.anexos.splice(i,1);x.historico.push(evento(`Anexo removido: ${a.nome||a.sei||a.url}`))}).then(ok=>ok&&toast("Anexo removido"))});
    if($("ax-file")) $("ax-file").onchange=async e=>{const fs=[...e.target.files];if(!fs.length)return;const ent=!!$("ax-ent")?.checked;toast("Enviando arquivo…");
      try{const novos=[];for(const f of fs){const r=await Store.anexar(id,f);novos.push({tipo:"arquivo",nome:f.name,tam:f.size,...r,por:S.me.id,em:new Date().toISOString(),...(ent?{entrega:true}:{})})}
        await mutate(id,x=>{x.anexos=[...(x.anexos||[]),...novos];x.historico.push(evento(`${novos.length===1?"Arquivo anexado":novos.length+" arquivos anexados"}: ${novos.map(n=>n.nome).join(", ")}`));respondeu(x)});toast("Arquivo anexado")}
      catch(err){toast(err.message||"Não foi possível anexar o arquivo.")} e.target.value=""};
    if($("fentrega")) $("fentrega").onsubmit=e=>{e.preventDefault();acao(id,"entregar",$("e-ok"))};
  }
  on("[data-pendgo]","onclick",b=>{const t=b.dataset.pendgo;const m={"Aguardando alocação de responsável":{status:"ativas",resp:"sem"},"Aguardando sua manifestação":{status:"aguardando",resp:""},"Solicitante respondeu à pendência":{status:"aguardando",resp:""},"Prazo vencido":{status:"atrasadas",resp:isTeam()?"eu":""}}[t]||{status:"ativas",resp:""};Object.assign(S.filtro,{dim:"",tipo:"",q:""},m);location.hash="demandas"});
  if($("tcfg-url")) $("tcfg-url").onclick=async()=>{const u=$("cfg-url").value.trim();if(!ehUrl(u)){toast("Informe um endereço que comece com https://");return}try{await Store.setConfig("sistema",{...(S.cfg.sistema||{}),url:u});toast("Endereço salvo")}catch(e){toast("Não foi possível salvar.")}};
  if($("tcfg-email")) $("tcfg-email").onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{toast(await Store.testarEmail())}catch(err){toast(err.message||"Falha no teste.")}b.disabled=false};
  // indicadores
  if($("iano")) $("iano").onchange=e=>{S.ano=+e.target.value;render()};
  if($("gmeses")){const g=S.gj;$("gmeses").onchange=e=>{g.meses=+e.target.value;render()};$("gant").onclick=()=>{g.desloc-=g.meses===12?3:Math.max(1,g.meses/3);render()};$("gprox").onclick=()=>{g.desloc+=g.meses===12?3:Math.max(1,g.meses/3);render()};$("ghoje").onclick=()=>{g.desloc=0;render()};
    $("gdim").onchange=e=>{g.dim=e.target.value;render()};$("gresp").onchange=e=>{g.resp=e.target.value;render()};$("gconcl").onchange=e=>{g.concl=e.target.checked;render()}}
  if($("planejar")) $("planejar").addEventListener("click",()=>{S.draft=null;const D=novoDraft();D.origem="interna";if(rota()==="nova"){S.noKeep=true;render()}});
  if($("iper")) $("iper").onchange=e=>{S.per=e.target.value;render()};
  if($("xlsx")) $("xlsx").onclick=e=>exportar("xlsx",e.currentTarget);
  if($("pptx")) $("pptx").onclick=e=>exportar("pptx",e.currentTarget);
  if($("iex")) $("iex").onchange=e=>{S.incluiEx=e.target.checked;render()};
  // cadastros
  const acesso=(id,o)=>Store.definirAcesso(id,o).then(()=>toast("Cadastro atualizado")).catch(()=>toast("Não foi possível salvar. Confira seu acesso de supervisor."));
  on("[data-aprovar]","onclick",b=>{const id=b.dataset.aprovar;const papel=document.querySelector(`[data-papel="${CSS.escape(id)}"]`).value;acesso(id,{papel,status:"ativo"})});
  on("[data-recusar]","onclick",b=>acesso(b.dataset.recusar,{papel:null,status:"recusado"}));
  on("[data-desativar]","onclick",b=>acesso(b.dataset.desativar,{status:"inativo"}));
  on("[data-reativar]","onclick",b=>{const p=S.perfis[b.dataset.reativar];acesso(b.dataset.reativar,{papel:p.papel||p.papelSolicitado||"solicitante",status:"ativo"})});
  if(rota()==="cadastros") on("[data-papel]","onchange",s=>{const p=S.perfis[s.dataset.papel];if(p.status==="ativo")acesso(s.dataset.papel,{papel:s.value,status:"ativo"})});
  // configurações
  if($("fsla")) $("fsla").onsubmit=async e=>{e.preventDefault();const m={},off=[];Object.keys(TIPOS).forEach(k=>{const v=parseInt($("sla-"+k).value,10);if(v>0&&v!==TIPOS[k].sla)m[k]=v;if(!$("on-"+k).checked)off.push(k)});
    try{await Store.setConfig("sla",{map:m});await Store.setConfig("servicos",{off});toast("Serviços e prazos salvos")}catch(err){toast("Não foi possível salvar. Supervisores precisam de acesso de Editor.")}};
  if($("mano")) $("mano").onchange=e=>{S.ano=+e.target.value;S.noKeep=true;render()};
  if($("fmetas")) $("fmetas").onsubmit=async e=>{e.preventDefault();const all={...(S.cfg.metas?.map||{})};const m={};DIMS.forEach(d=>{const v=parseInt($("meta-"+d.id).value,10);if(v>0)m[d.id]=v});all[S.ano]=m;
    try{await Store.setConfig("metas",{map:all});toast("Metas salvas")}catch(err){toast("Não foi possível salvar as metas.")}};
  if($("logofile")) $("logofile").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const url=await Store.uploadLogo(f);await Store.setConfig("marca",{...(S.cfg.marca||{}),logo:url});toast("Marca atualizada")}catch(err){toast("Não foi possível enviar o arquivo.")}};
  if($("logodel")) $("logodel").onclick=async()=>{try{await Store.setConfig("marca",{logo:null})}catch(e){}};
  if($("seed")) $("seed").onclick=seed;
  if($("unseed")) $("unseed").onclick=async()=>{for(const d of S.demandas.filter(x=>x.exemplo)){try{await Store.delDemanda(d.id)}catch(e){}}toast("Exemplos removidos")};
}

/* resposta do solicitante a uma pendência */
function respondeu(x){if(x.status==="aguardando"&&x.solicitante===S.me.id&&!x.respondido){x.respondido=true;x.respondidoEm=new Date().toISOString();x.historico.push(evento("Solicitante respondeu à pendência"))}}
async function acao(id,act,btn){
  const d=S.demandas.find(x=>x.id===id); const T=TIPOS[d.tipo]; const agora=new Date().toISOString();
  const ok=m=>v=>v&&toast(m);
  if(act==="comentar"){const box=$("d-msg");const t=box.value.trim();if(!t)return;const interna=!!$("d-int")?.checked;box.value="";if($("d-int"))$("d-int").checked=false;btn.disabled=true;
    const r=await mutate(id,x=>{x.historico.push({em:agora,por:S.me.id,t,tipo:"comentario",...(interna?{interna:true}:{})});if(!interna)respondeu(x)});btn.disabled=false;if(r)toast("Mensagem enviada");else if($("d-msg")&&!$("d-msg").value)$("d-msg").value=t;return}
  if(act==="iniciar") return mutate(id,x=>{x.status="aberta";x.inicio=agora;x.etapasDatas=x.etapasDatas||[];x.etapasDatas[0]=agora;if(dia(x.prazo)<=hoje())x.prazo=addDU(agora,slaDe(x.tipo)).toISOString();x.historico.push(evento(`Ação iniciada. Previsão de entrega: ${fmt(x.prazo)}`))}).then(ok("Ação iniciada"));
  if(act==="inicio"){const v=$("d-ini").value;if(!v)return;const nd=new Date(v+"T12:00:00").toISOString();return mutate(id,x=>{x.inicio=nd;if(dia(x.prazo)<dia(nd))x.prazo=addDU(nd,slaDe(x.tipo)).toISOString();x.historico.push(evento(`Início previsto ajustado para ${fmt(nd)}`))}).then(ok("Início ajustado"))}
  if(act==="assumir") return mutate(id,x=>{x.responsavel=S.me.id;x.historico.push(evento(`${nome(S.me.id)} assumiu a demanda`))}).then(ok("Demanda assumida"));
  if(act==="avancar") return mutate(id,x=>{const ap=etAprov(T.etapas[x.etapa]);x.etapa++;x.etapasDatas=x.etapasDatas||[];x.etapasDatas[x.etapa]=agora;x.historico.push(evento(`${ap?"Aprovado pela chefia. ":""}Etapa: ${etN(T.etapas[x.etapa])}`))}).then(ok("Etapa atualizada"));
  if(act==="concluir"){S.form="entrega";S.noKeep=true;render();setTimeout(()=>{$("fentrega")?.scrollIntoView({behavior:"smooth",block:"start"});$("e-sei")?.focus()},50);return}
  if(act==="fechar-form"){S.form=null;S.noKeep=true;render();return}
  if(act==="entregar"){
    const sei=$("e-sei").value.trim(), url=$("e-link").value.trim(), rot=$("e-linkrot").value.trim(), msg=$("e-msg").value.trim(), sem=$("e-sem").checked, arqs=[...($("e-arq").files||[])];
    if(url&&!ehUrl(url)){toast("O link precisa começar com https://");return}
    const jaTem=(d.anexos||[]).some(a=>a.entrega);
    if(!sei&&!url&&!arqs.length&&!jaTem&&!sem){toast("Informe um processo SEI, um link ou um arquivo, ou marque Concluir sem anexo.");return}
    if(sem&&!msg&&!sei&&!url&&!arqs.length){toast("Descreva o resultado na mensagem ao solicitante.");return}
    btn.disabled=true;btn.textContent="Enviando…";
    try{
      const novos=[];
      for(const f of arqs){const r=await Store.anexar(id,f);novos.push({tipo:"arquivo",nome:f.name,tam:f.size,...r,por:S.me.id,em:agora,entrega:true})}
      if(url) novos.push({tipo:"link",url,nome:rot,por:S.me.id,em:agora,entrega:true});
      const r=await mutate(id,x=>{
        x.anexos=x.anexos||[];
        if(sei){const s0=x.anexos.find(a=>a.tipo==="sei"&&a.sei===sei);if(s0)s0.entrega=true;else x.anexos.push({tipo:"sei",sei,nome:"",por:S.me.id,em:agora,entrega:true})}
        x.anexos.push(...novos);
        x.entrega={em:agora,por:S.me.id,obs:msg};
        x.status="concluida";x.concluidaEm=agora;x.etapa=T.etapas.length-1;x.etapasDatas=x.etapasDatas||[];x.etapasDatas[x.etapa]=agora;
        x.historico.push(evento(T.fimManual?"Instrumento assinado e registrado. Entrega disponível ao solicitante.":"Demanda concluída. Entrega disponível ao solicitante."));
        if(msg) x.historico.push({em:agora,por:S.me.id,t:msg,tipo:"comentario",auto:true});
      });
      if(r){S.form=null;toast("Demanda concluída e solicitante avisado");render()} else {btn.disabled=false;btn.textContent="Concluir e avisar o solicitante"}
    }catch(err){toast(err.message||"Não foi possível concluir.");btn.disabled=false;btn.textContent="Concluir e avisar o solicitante"}
    return;
  }
  if(act==="ax-link"){const u=$("ax-url").value.trim(),n=$("ax-rot").value.trim();if(!ehUrl(u)){toast("O link precisa começar com https://");return}const ent=!!$("ax-ent")?.checked;
    return mutate(id,x=>{x.anexos=[...(x.anexos||[]),{tipo:"link",url:u,nome:n,por:S.me.id,em:agora,...(ent?{entrega:true}:{})}];x.historico.push(evento(`Link adicionado: ${n||origemLink(u)}`));respondeu(x)}).then(v=>{if(v){S.axModo=null;S.noKeep=true;toast("Link adicionado");render()}})}
  if(act==="ax-sei"){const n=$("ax-sei").value.trim(),r=$("ax-seirot").value.trim();if(n.length<5){toast("Informe o número do processo SEI.");return}const ent=!!$("ax-ent")?.checked;
    return mutate(id,x=>{x.anexos=[...(x.anexos||[]),{tipo:"sei",sei:n,nome:r,por:S.me.id,em:agora,...(ent?{entrega:true}:{})}];x.historico.push(evento(`Processo SEI informado: ${n}`));respondeu(x)}).then(v=>{if(v){S.axModo=null;S.noKeep=true;toast("Processo SEI registrado");render()}})}
  if(act==="voltar") return mutate(id,x=>{x.etapa=Math.max(0,x.etapa-1);x.historico.push(evento(`Retornou para: ${etN(T.etapas[x.etapa])}`))}).then(ok("Etapa revertida"));
  if(act==="pausar"){S.form="pausa";S.noKeep=true;render();setTimeout(()=>$("p-txt")?.focus(),30);return}
  if(act==="pausar2"){const t=$("p-txt").value.trim();if(t.length<5){toast("Descreva o que o solicitante precisa enviar ou decidir.");return}
    return mutate(id,x=>{x.status="aguardando";x.pausadoEm=agora;x.pendencia=t;x.respondido=false;delete x.respondidoEm;x.historico.push(evento("Aguardando manifestação do solicitante. Contagem do prazo suspensa."));x.historico.push({em:agora,por:S.me.id,t:"Pendência: "+t,tipo:"comentario",auto:true})}).then(v=>{if(v){S.form=null;toast("Prazo suspenso e solicitante avisado");render()}})}
  if(act==="retomar") return mutate(id,x=>{const n=Math.max(0,du(x.pausadoEm||agora,agora));x.status="aberta";x.prazo=addDU(x.prazo,n).toISOString();delete x.pausadoEm;delete x.respondido;delete x.respondidoEm;x.historico.push(evento(n>0?`Atendimento retomado. Previsão estendida em ${n} d.u., para ${fmt(x.prazo)}.`:`Atendimento retomado. Previsão mantida em ${fmt(x.prazo)}.`))}).then(ok("Atendimento retomado"));
  if(act==="prazo"){const v=$("d-prazo").value;if(!v)return;const nd=new Date(v+"T12:00:00");return mutate(id,x=>{x.prazo=nd.toISOString();x.historico.push(evento(`Previsão de entrega ajustada para ${fmt(x.prazo)}`))}).then(ok("Prazo ajustado"))}
  if(act==="cancelar"){$("confcancel").innerHTML=`<div class="note" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">Cancelar esta demanda? <button class="btn sm danger" type="button">Sim, cancelar</button></div>`;$("confcancel").querySelector("button").onclick=()=>acao(id,"cancelar2");return}
  if(act==="cancelar2") return mutate(id,x=>{x.status="cancelada";x.historico.push(evento("Demanda cancelada"))}).then(ok("Demanda cancelada"));
  if(act==="reabrir") return mutate(id,x=>{x.status="aberta";delete x.concluidaEm;x.historico.push(evento("Demanda reaberta"))}).then(ok("Demanda reaberta"));
}

async function seed(){
  const base=hoje(); const back=n=>{const x=new Date(base);let c=0;while(c<n){x.setDate(x.getDate()-1);const w=x.getDay();if(w&&w!==6)c++}return x.toISOString()};
  const ex=[
    {tipo:"prospeccao",titulo:"[Exemplo] Prospecção sobre biochar em sistemas integrados",descricao:"Mapear publicações, patentes e grupos de pesquisa sobre biochar em sistemas ILPF entre 2015 e 2026.",unidade:"Projeto ILPF Regenera",dias:12,etapa:3},
    {tipo:"clpi",titulo:"[Exemplo] Parecer sobre proteção de formulação de bioinsumo",descricao:"Avaliar patenteabilidade e estratégia de proteção antes da submissão de artigo.",unidade:"Laboratório de Entomologia",dias:24,etapa:2},
    {tipo:"actf",titulo:"[Exemplo] ACTF com cooperativa regional para validação de tecnologia",descricao:"Validação em rede de fazendas parceiras, vigência de 36 meses, aporte do parceiro via fundação de apoio.",parceiro:"Cooperativa Agroindustrial (exemplo)",unidade:"Transferência de Tecnologia",dias:40,etapa:5},
    {tipo:"qualificacao",titulo:"[Exemplo] Qualificação do manejo integrado de vassourinha-de-botão",descricao:"Diagnóstico de maturidade e proposta de qualificação do ativo.",unidade:"Núcleo de Plantas Daninhas",dias:20,etapa:2},
    {tipo:"impacto",titulo:"[Exemplo] Ciclo de avaliação de impacto 2027",descricao:"Planejamento do ciclo anual de avaliação e monitoramento de ativos da Unidade.",origem:"interna",dias:5,etapa:0,ativos:[{nome:"Sistemas ILPF em Mato Grosso",modo:"avaliacao"},{nome:"Manejo integrado de vassourinha-de-botão",modo:"monitoramento"}]}
  ];
  try{for(const e of ex){const {id,body}=montar({...e,criadoEm:back(e.dias),exemplo:true,responsavel:e.etapa>0?S.me.id:null});body.etapa=e.etapa;for(let i=1;i<=e.etapa;i++)body.etapasDatas[i]=back(Math.max(0,e.dias-i*Math.floor(e.dias/(e.etapa+1))));await Store.setDemanda(id,body)}toast("Exemplos inseridos")}catch(err){falha(err)}
}

/* ---------- Inicialização ---------- */
window.addEventListener("hashchange",()=>{window.scrollTo(0,0);render()});
document.addEventListener("click",e=>{const pn=$("notif");if(pn&&!pn.hidden&&!e.target.closest("#notif")&&!e.target.closest("#sino")){pn.hidden=true;$("sino")?.setAttribute("aria-expanded","false")}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){const pn=$("notif");if(pn&&!pn.hidden){pn.hidden=true;$("sino")?.focus()}}});
(async()=>{
  nav();
  let info; try{info=await Store.init()}catch(e){info={erro:"Não foi possível conectar à base",detalhe:`${e?.message||e}. ${dicaErro(e?.message)}`}} S.info=info;
  if(info.erro){$("view").innerHTML=vazio(info.erro,info.detalhe||"");return}
  if(info.precisaLogin){S.precisaLogin=true;render();return}
  S.me=info.me; S.readOnly=info.podeGravar===false;
  const timer=setTimeout(()=>{if(!S.loaded){S.stale=true;render()}},10000);
  Store.onPerfis(m=>{S.perfis=m;render()});
  Store.onConfig(c=>{S.cfg=c;render();
    if(Store.mode==="supabase"&&realRole()==="supervisor"&&!c.sistema?.url&&!S.urlSalva){S.urlSalva=true;Store.setConfig("sistema",{url:location.origin+location.pathname}).catch(()=>{})}});
  if($("sino")) $("sino").onclick=abrirAvisos;
  Store.onDemandas((list,conf)=>{S.demandas=list.filter(d=>TIPOS[d.tipo]);if(conf){S.loaded=true;S.stale=false;clearTimeout(timer)}else if(!S.loaded)S.loaded=true;render()},
    ()=>{clearTimeout(timer);S.stale=true;S.loaded=true;render()});
  render();
})();
