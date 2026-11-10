/* ===== Adaptador de dados: Supabase (instalação própria via GitHub Pages) =====
   Requer config.js com window.SPAT_CONFIG = {supabaseUrl, supabaseAnonKey, logo} */
window.Store = (()=>{
  const C = window.SPAT_CONFIG || {};
  let sb, me, aguardandoLogin=false;
  const map = r => ({nome:r.nome,email:r.email,matricula:r.matricula,setor:r.setor,cargo:r.cargo,ramal:r.ramal,papelSolicitado:r.papel_solicitado,justificativa:r.justificativa,criadoEm:r.criado_em,papel:r.papel,status:r.status});
  const err = e => { if(e) throw {code:e.code,message:e.message}; };
  async function all(table){const {data,error}=await sb.from(table).select("*");if(error){window.SPAT_ERRO&&window.SPAT_ERRO(`${table}: ${error.message}${error.code?` (código ${error.code})`:""}`);err(error)}return data||[]}
  function live(table,load){load();try{sb.channel("rt-"+table).on("postgres_changes",{event:"*",schema:"public",table},()=>load()).subscribe()}catch(e){console.warn("tempo real indisponível",e)}}
  return {
    mode:"supabase",
    logoPadrao: C.logo || null,
    async init(){
      const KEY=C.supabaseKey||C.supabaseAnonKey;
      if(!C.supabaseUrl||!KEY||/COLE-AQUI|SEU-PROJETO/.test(C.supabaseUrl+KEY)) return {erro:"Instalação incompleta",detalhe:"Preencha supabaseUrl e supabaseKey no arquivo config.js, como descrito no README."};
      // lock: executa direto, sem a trava navigator.locks, que pode deixar as consultas paradas até a aba receber foco
      sb = supabase.createClient(C.supabaseUrl, KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,lock:async(_n,_t,fn)=>await fn()}});
      // nunca chamar o Supabase dentro deste callback (outra causa de travamento): só agenda a recarga
      sb.auth.onAuthStateChange((ev)=>{ if((ev==="SIGNED_IN"&&aguardandoLogin)||(ev==="SIGNED_OUT"&&me)) setTimeout(()=>location.reload(),0); });
      const limite = new Promise((_,rej)=>setTimeout(()=>rej(new Error("O Supabase não respondeu em 15 segundos (sessão).")),15000));
      const {data:{session}} = await Promise.race([sb.auth.getSession(), limite]);
      if(!session){aguardandoLogin=true; return {precisaLogin:true};}
      me = {id:session.user.id, email:session.user.email, nome:"", isOwner:false};
      return {me, podeGravar:true};
    },
    auth:{
      async entrar(email,senha){const {error}=await sb.auth.signInWithPassword({email,password:senha});if(error)throw new Error("E-mail ou senha incorretos, ou e-mail ainda não confirmado.")},
      async criarConta(email,senha){const {error}=await sb.auth.signUp({email,password:senha,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw new Error(error.message)},
      async redefinir(email){const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw new Error(error.message)},
      async sair(){await sb.auth.signOut()}
    },
    onDemandas(cb,onErr){live("demandas",async()=>{try{const rows=await all("demandas");cb(rows.map(r=>({id:r.id,...r.dados})),true)}catch(e){onErr&&onErr(e)}})},
    onConfig(cb){live("config",async()=>{try{const rows=await all("config");const c={};rows.forEach(r=>c[r.id]=r.dados);cb(c)}catch(e){}})},
    onPerfis(cb){live("perfis",async()=>{try{const rows=await all("perfis");const m={};rows.forEach(r=>m[r.id]=map(r));cb(m)}catch(e){}})},
    async getDemanda(id){const {data,error}=await sb.from("demandas").select("dados").eq("id",id).maybeSingle();err(error);return data?data.dados:null},
    async setDemanda(id,b){const {error}=await sb.from("demandas").upsert({id,dados:b,solicitante:b.solicitante,atualizado_em:new Date().toISOString()});err(error)},
    async delDemanda(id){const {error}=await sb.from("demandas").delete().eq("id",id);err(error)},
    async setConfig(id,b){const {error}=await sb.from("config").upsert({id,dados:b});err(error)},
    async salvarCadastro(b){const {error}=await sb.from("perfis").upsert({id:me.id,nome:b.nome,email:b.email,matricula:b.matricula,setor:b.setor,cargo:b.cargo,ramal:b.ramal,papel_solicitado:b.papelSolicitado,justificativa:b.justificativa});err(error)},
    async definirAcesso(id,o){const u={status:o.status};if(o.papel!==undefined)u.papel=o.papel;const {error}=await sb.from("perfis").update(u).eq("id",id);err(error)},
    nomes:null,
    uploadLogo:null,
    async baixar(nome,blob){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=nome;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}
  };
})();
