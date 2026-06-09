
const socket=io();
let eventos=[],eventoAtual=null,catalogo=[],locais=[],pedidos=[],dias=[],inventarios=[],transferenciasLocais=[],carrinho=[],pedidoAtual=null,ultimoPedidoCliente=null;
let inventarioLocalSelecionado=null;
let inventarioContagensLocaisDraft={};
let contagemLocalAutenticadoId=null;
let contagemPasswordAtual="";
let clienteLocalAutenticadoId = null;
let clientePasswordAtual = "";
let idsPedidosImpressos = new Set(JSON.parse(localStorage.getItem("idsPedidosImpressos") || "[]"));
let adminAutenticado = sessionStorage.getItem("adminAutenticado") === "1";
let operadorAutenticado = sessionStorage.getItem("operadorAutenticado") === "1";
const ADMIN_PASSWORD = localStorage.getItem("adminPassword") || "1234";
const paginasAdministracao = ["admin", "dashboard", "contagem", "inventario", "bd", "def"];

function passwordOperadorAtual(){
  return localStorage.getItem("operadorPassword") || "1234";
}

function pedirPasswordOperador(){
  const password = prompt("Password do Operador:");
  if(password === null) return false;
  if(String(password) !== String(passwordOperadorAtual())){
    alert("Password do operador incorreta.");
    return false;
  }
  operadorAutenticado = true;
  sessionStorage.setItem("operadorAutenticado", "1");
  return true;
}

function entrarOperador(){
  if(!operadorAutenticado && !pedirPasswordOperador()) return;
  show("operador");
}

function terminarSessaoOperador(){
  operadorAutenticado = false;
  sessionStorage.removeItem("operadorAutenticado");
  const estado=document.getElementById("estadoPasswordOperador");
  if(estado) estado.innerText="Sessão do operador terminada.";
  alert("Sessão do operador terminada.");
}

function carregarDefinicoesOperador(){
  const estado=document.getElementById("estadoPasswordOperador");
  if(estado) estado.innerText="Password atual definida. Usa os campos acima para alterar.";
}

function guardarPasswordOperador(){
  const p1=document.getElementById("operadorPasswordDef")?.value || "";
  const p2=document.getElementById("operadorPasswordConfirmDef")?.value || "";
  const estado=document.getElementById("estadoPasswordOperador");
  if(!p1.trim()){ alert("A password do operador não pode ficar vazia."); return; }
  if(p1 !== p2){ alert("As passwords não coincidem."); return; }
  localStorage.setItem("operadorPassword", p1);
  operadorAutenticado = false;
  sessionStorage.removeItem("operadorAutenticado");
  const i1=document.getElementById("operadorPasswordDef");
  const i2=document.getElementById("operadorPasswordConfirmDef");
  if(i1) i1.value="";
  if(i2) i2.value="";
  if(estado) estado.innerText="Password do operador guardada. Será pedida na próxima entrada no Operador.";
  alert("Password do operador guardada.");
}

function pedirPasswordAdmin(){
  const password = prompt("Password da Administração:");
  if(password === null) return false;
  if(String(password) !== String(ADMIN_PASSWORD)){
    alert("Password incorreta.");
    return false;
  }
  adminAutenticado = true;
  sessionStorage.setItem("adminAutenticado", "1");
  return true;
}

function entrarAdministracao(){
  if(!adminAutenticado && !pedirPasswordAdmin()) return;
  show("admin");
}

function sairAdministracao(){
  adminAutenticado = false;
  sessionStorage.removeItem("adminAutenticado");
  alert("Sessão de administração terminada.");
  show("home");
}

function voltarEventosAdmin(){
  if(!adminAutenticado && !pedirPasswordAdmin()) return;
  voltarEventos();
}

function show(id){
  if(id !== "eventos" && !eventoAtual){
    alert("Cria ou escolhe um evento primeiro.");
    id = "eventos";
  }
  if(id === "operador" && !operadorAutenticado){
    if(!pedirPasswordOperador()) return;
  }
  if(paginasAdministracao.includes(id) && !adminAutenticado){
    if(!pedirPasswordAdmin()) return;
  }
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function api(url){
  if(!eventoAtual) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}eventoId=${eventoAtual.id}`;
}

function localAtivo(local){
  return !!local && local.ativo !== false && local.inativo !== true;
}

function locaisAtivos(){
  return locais.filter(localAtivo);
}

function listaLocaisParaSelect(id){
  return ["clienteLocal", "contagemLocal", "transferLocal", "inventarioLocal"].includes(id) ? locaisAtivos() : locais;
}

function voltarEventos(){
  document.getElementById("mainHeader").style.display="none";
  show("eventos");
}

function mostrarEventos(){
  const div=document.getElementById("listaEventos");
  if(!div)return;
  div.innerHTML="";
  if(!eventos.length){div.innerHTML='<p class="muted">Ainda não existem eventos.</p>';return}
  eventos.slice().reverse().forEach(ev=>{
    const row=document.createElement("div");
    row.className="pedido";
    row.innerHTML=`
      <div>
        <strong>${ev.nome}</strong><br>
        <span class="muted">${ev.data || "Sem data"} · ${ev.totalPedidos || 0} pedidos · ${ev.totalLocais || 0} locais</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="entrarEvento(${ev.id})">Entrar</button>
        <button class="red" onclick="removerEvento(${ev.id})">Remover</button>
      </div>
    `;
    div.appendChild(row);
  });
}


async function removerEvento(id){
  if(!adminAutenticado && !pedirPasswordAdmin()) return;
  const ev = eventos.find(e => Number(e.id) === Number(id));
  const nome = ev ? ev.nome : "este evento";
  if(!confirm(`Remover o evento "${nome}"? Esta ação não pode ser anulada.`)) return;
  const password = prompt("Insere a password para remover o evento:");
  if(password === null) return;

  const r = await fetch(`/eventos/${id}`, {
    method:"DELETE",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({password})
  });
  const dados = await r.json().catch(()=>({}));
  if(!r.ok){
    alert(dados.erro || "Erro ao remover evento.");
    return;
  }

  eventos = dados.eventos || eventos.filter(e => Number(e.id) !== Number(id));
  if(eventoAtual && Number(eventoAtual.id) === Number(id)){
    eventoAtual = null;
    catalogo=[]; locais=[]; pedidos=[]; dias=[]; inventarios=[]; transferenciasLocais=[]; carrinho=[]; pedidoAtual=null; ultimoPedidoCliente=null;
    const header=document.getElementById("mainHeader");
    if(header)header.style.display="none";
    show("eventos");
  }
  mostrarEventos();
  alert("Evento removido.");
}

async function criarEvento(){
  if(!adminAutenticado && !pedirPasswordAdmin()) return;
  const nome=document.getElementById("novoEventoNome").value.trim();
  const data=document.getElementById("novoEventoData").value.trim();
  const diasNumero=Math.max(0, Number(document.getElementById("novoEventoDiasNumero")?.value || 0) || 0);
  const diasNomesTexto=document.getElementById("novoEventoDiasNomes")?.value || "";
  const diasNomes=diasNomesTexto.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const totalDias=Math.max(diasNumero, diasNomes.length);
  const diasIniciais=[];
  for(let i=0;i<totalDias;i++){
    diasIniciais.push({
      nome:diasNomes[i] || `Dia ${i+1}`,
      data:""
    });
  }
  if(!nome){alert("Escreve o nome do evento.");return}
  const r=await fetch("/eventos",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({nome,data,dias:diasIniciais})
  });
  const ev=await r.json();
  if(!r.ok){alert(ev.erro||"Erro ao criar evento.");return}
  document.getElementById("novoEventoNome").value="";
  document.getElementById("novoEventoData").value="";
  if(document.getElementById("novoEventoDiasNumero"))document.getElementById("novoEventoDiasNumero").value="";
  if(document.getElementById("novoEventoDiasNomes"))document.getElementById("novoEventoDiasNomes").value="";
  entrarEvento(ev.id);
}

async function entrarEvento(id){
  eventoAtual = eventos.find(e=>e.id===id) || {id};
  socket.emit("selecionarEvento", id);
  const r=await fetch(`/evento-atual?eventoId=${id}`);
  const dados=await r.json();
  if(!r.ok){alert(dados.erro||"Erro ao abrir evento.");eventoAtual=null;return}
  eventoAtual=dados.evento;
  catalogo=dados.catalogo||[];
  locais=dados.locais||[];
  pedidos=dados.pedidos||[];
  dias=dados.dias||[];
  inventarios=dados.inventarios||[];
  transferenciasLocais=dados.transferenciasLocais||[];
  await carregarInventarios();
  carrinho=[];
  pedidoAtual=null;
  ultimoPedidoCliente=null;
  clienteLocalAutenticadoId=null;
  clientePasswordAtual="";
  contagemLocalAutenticadoId=null;
  contagemPasswordAtual="";
  document.getElementById("mainHeader").style.display="flex";
  document.getElementById("eventoAtualBadge").innerText=`Evento: ${eventoAtual.nome}${eventoAtual.data ? " · "+eventoAtual.data : ""}`;
  refreshTudo();
  mostrarCarrinho();
  show("home");
}

function preencherSelect(id){
  const s=document.getElementById(id);
  if(!s)return;
  const atual=s.value;
  s.innerHTML="";
  const lista=listaLocaisParaSelect(id);
  lista.forEach(l=>{
    const op=document.createElement("option");
    op.value=l.id;
    op.innerText=l.nome + (localAtivo(l) ? "" : " (inativo)");
    s.appendChild(op);
  });
  if(atual && lista.some(l=>String(l.id)===String(atual)))s.value=atual;
}


function localContagem(){
  return locaisAtivos().find(l=>l.id==document.getElementById("contagemLocal")?.value);
}

function mostrarDiasContagem(){
  const sel=document.getElementById("contagemDia");
  if(!sel)return;
  const atual=sel.value;
  sel.innerHTML="";
  dias.forEach(d=>{
    const op=document.createElement("option");
    op.value=d.id;
    op.innerText=`${d.nome}${d.data?" · "+d.data:""}`;
    sel.appendChild(op);
  });
  if(atual)sel.value=atual;
}

function trocarLocalContagem(){
  contagemLocalAutenticadoId=null;
  contagemPasswordAtual="";
  const p=document.getElementById("contagemPassword");
  if(p)p.value="";
  const estado=document.getElementById("estadoLoginContagem");
  if(estado)estado.innerText="Insere a password para aceder à contagem deste local.";
  mostrarFormularioContagemLocal();
}

function bloquearContagemLocal(){
  contagemLocalAutenticadoId=null;
  contagemPasswordAtual="";
  const estado=document.getElementById("estadoLoginContagem");
  if(estado)estado.innerText="Password alterada. Carrega em Entrar para validar.";
  mostrarFormularioContagemLocal();
}

async function validarPasswordContagem(){
  const local=localContagem();
  if(!local){alert("Seleciona um local.");return}
  const password=document.getElementById("contagemPassword")?.value || "";
  const r=await fetch(api(`/locais/${local.id}/validar-password`),{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({password})
  });
  const d=await r.json();
  const estado=document.getElementById("estadoLoginContagem");
  if(d.ok){
    contagemLocalAutenticadoId=local.id;
    contagemPasswordAtual=password;
    if(estado)estado.innerText=`Acesso autorizado para ${local.nome}.`;
  }else{
    contagemLocalAutenticadoId=null;
    contagemPasswordAtual="";
    if(estado)estado.innerText="Password incorreta.";
  }
  mostrarFormularioContagemLocal();
}

function mostrarFormularioContagemLocal(){
  const div=document.getElementById("produtosContagem");
  const titulo=document.getElementById("tituloContagemLocal");
  if(!div)return;
  mostrarDiasContagem();
  const local=localContagem();
  if(titulo)titulo.innerText=local?`Produtos — ${local.nome}`:"Produtos do local";
  if(!local){div.innerHTML='<p class="muted">Seleciona um local.</p>';return}
  if(contagemLocalAutenticadoId !== local.id){
    div.innerHTML='<p class="muted">Insere a password correta para ver e enviar a contagem deste local.</p>';
    return;
  }
  if(!dias.length){
    div.innerHTML='<p class="muted">Ainda não existem dias criados no Inventário.</p>';
    return;
  }
  if(!local.itens || !local.itens.length){
    div.innerHTML='<p class="muted">Este local ainda não tem itens associados.</p>';
    return;
  }
  div.innerHTML=local.itens.map(item=>{
    const stock=Number(item.stockBar||0);
    return `<div class="stock-row">
      <div>
        <strong>${escapeHtml(item.nome)}</strong><br>
        <span class="muted">Código: ${escapeHtml(item.codigo||"-")} · Stock sistema neste local: ${stock}</span>
      </div>
      <input class="contagem-local-item" data-item="${Number(item.id)}" type="number" min="0" value="${stock}" style="width:120px">
    </div>`;
  }).join("");
}

async function enviarContagemFimDiaLocal(){
  const local=localContagem();
  if(!local){alert("Seleciona um local.");return}
  if(contagemLocalAutenticadoId !== local.id){alert("Insere a password correta do local.");return}
  const diaId=Number(document.getElementById("contagemDia")?.value || 0);
  if(!diaId){alert("Cria ou seleciona um dia no Inventário.");return}
  const contagensLocal={};
  document.querySelectorAll("#produtosContagem .contagem-local-item").forEach(input=>{
    const itemId=Number(input.dataset.item||0);
    if(itemId)contagensLocal[itemId]=Math.max(0,Number(input.value||0));
  });
  if(!Object.keys(contagensLocal).length){alert("Não existem itens para enviar.");return}
  const contagens={};
  catalogo.forEach(item=>{contagens[item.id]=Number(contagensLocal[item.id]||0)});
  const contagensLocais={};
  contagensLocais[local.id]=contagensLocal;
  const notaBase=document.getElementById("contagemNota")?.value.trim() || "";
  const nota=`Contagem enviada pelo local ${local.nome}${notaBase?" · "+notaBase:""}`;
  const r=await fetch(api("/inventarios"),{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({tipo:"fim_dia",diaId,nota,contagens,contagensLocais,localIdContagem:local.id})
  });
  const d=await r.json();
  if(!r.ok){alert(d.erro||"Erro ao enviar contagem.");return}
  alert("Contagem enviada. Fica pendente até ao operador fechar o dia.");
  await carregarInventarios();
  mostrarFormularioContagemLocal();
  mostrarInventario();
}


function escapePrint(v){
  return String(v ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

function definicoesImpressao(){
  const def={auto:false,som:true,observacoes:true,dataHora:true,copias:1};
  try{return {...def,...JSON.parse(localStorage.getItem("definicoesImpressao")||"{}")};}
  catch(e){return def;}
}

function carregarDefinicoesImpressao(){
  const d=definicoesImpressao();
  const auto=document.getElementById("printAuto");
  const som=document.getElementById("printSom");
  const obs=document.getElementById("printObservacoes");
  const dt=document.getElementById("printDataHora");
  const copias=document.getElementById("printCopias");
  if(auto)auto.checked=!!d.auto;
  if(som)som.checked=!!d.som;
  if(obs)obs.checked=!!d.observacoes;
  if(dt)dt.checked=!!d.dataHora;
  if(copias)copias.value=Number(d.copias||1);
}

function guardarDefinicoesImpressao(){
  const d={
    auto:!!document.getElementById("printAuto")?.checked,
    som:!!document.getElementById("printSom")?.checked,
    observacoes:!!document.getElementById("printObservacoes")?.checked,
    dataHora:!!document.getElementById("printDataHora")?.checked,
    copias:Math.max(1,Math.min(5,Number(document.getElementById("printCopias")?.value||1)))
  };
  localStorage.setItem("definicoesImpressao",JSON.stringify(d));
}

function tocarSomNovoPedido(){
  try{
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.type="sine";
    osc.frequency.value=880;
    gain.gain.value=0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(()=>{osc.stop();ctx.close();},180);
  }catch(e){}
}

function htmlTalaoPedido(pedido, opts={}){
  const local=locais.find(l=>String(l.id)===String(pedido.localId));
  const localNome=pedido.local || pedido.localNome || local?.nome || "Local";
  const data=pedido.criadoEm ? new Date(pedido.criadoEm) : new Date();
  const d=definicoesImpressao();
  const obs=pedido.observacoes || pedido.observacao || pedido.nota || "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapePrint(pedido.codigo||"Pedido")}</title>
  <style>
    @page{size:80mm auto;margin:4mm}
    body{font-family:Arial, sans-serif;width:72mm;margin:0;color:#111;font-size:13px}
    h1{font-size:18px;margin:0 0 6px;text-align:center}
    .linha{border-top:1px dashed #333;margin:8px 0}
    .meta{font-size:12px;margin:2px 0}
    table{width:100%;border-collapse:collapse;margin-top:6px}
    td{padding:4px 0;border-bottom:1px dotted #bbb;vertical-align:top}
    td.qtd{width:18mm;font-weight:bold;text-align:right;padding-right:6px}
    .estado{text-align:center;font-weight:bold;margin-top:8px}
  </style></head><body>
    <h1>PEDIDO</h1>
    <div class="meta"><strong>Nº:</strong> ${escapePrint(pedido.codigo||pedido.id||"")}</div>
    <div class="meta"><strong>Local:</strong> ${escapePrint(localNome)}</div>
    ${d.dataHora ? `<div class="meta"><strong>Data:</strong> ${escapePrint(data.toLocaleString("pt-PT"))}</div>` : ""}
    <div class="linha"></div>
    <table>${(pedido.itens||[]).map(i=>`<tr><td class="qtd">${escapePrint(i.quantidade)}x</td><td>${escapePrint(i.nome)}</td></tr>`).join("")}</table>
    ${d.observacoes && obs ? `<div class="linha"></div><div><strong>Obs.:</strong><br>${escapePrint(obs)}</div>` : ""}
    <div class="linha"></div>
    <div class="estado">${escapePrint(pedido.estado||"A aguardar")}</div>
  </body></html>`;
}

function imprimirPedido(pedido, manual=false){
  if(!pedido){alert("Pedido inválido.");return}
  const d=definicoesImpressao();
  const copias=manual ? Math.max(1,Number(d.copias||1)) : 1;
  for(let i=0;i<copias;i++){
    const w=window.open("","_blank","width=420,height=640");
    if(!w){alert("O browser bloqueou a janela de impressão. Permite pop-ups para esta app.");return}
    w.document.open();
    w.document.write(htmlTalaoPedido(pedido));
    w.document.close();
    w.focus();
    setTimeout(()=>{try{w.print();}catch(e){}},250);
  }
}

function imprimirPedidoPorId(id){
  const p=pedidos.find(x=>Number(x.id)===Number(id));
  if(!p){alert("Pedido não encontrado.");return}
  imprimirPedido(p,true);
}

function imprimirPedidoAutomatico(pedido){
  const d=definicoesImpressao();
  if(d.som)tocarSomNovoPedido();
  if(!d.auto || !pedido || !pedido.id)return;
  if(idsPedidosImpressos.has(Number(pedido.id)))return;
  idsPedidosImpressos.add(Number(pedido.id));
  localStorage.setItem("idsPedidosImpressos",JSON.stringify([...idsPedidosImpressos]));
  imprimirPedido(pedido,false);
}

function refreshTudo(){
  preencherSelect("clienteLocal");
  preencherSelect("contagemLocal");
  preencherSelect("defLocal");
  
  mostrarProdutosCliente();
  mostrarFormularioContagemLocal();
  mostrarPedidos();
  mostrarStockOperador();
  mostrarStockBarOperador();
  mostrarAlertasStockMinimo();
  mostrarDashboardOperacional();
  mostrarCatalogo();
  mostrarTransferenciasBD();
  mostrarStockLocaisBD();
  mostrarAssociacao();
  mostrarLocaisDef();
  mostrarPasswordsLocaisDef();
  mostrarInventario();
  mostrarDiasContagem();
  mostrarHistoricoCliente();
  carregarDefinicoesImpressao();
  carregarDefinicoesOperador();
}

function localCliente(){
  return locaisAtivos().find(l=>l.id==document.getElementById("clienteLocal").value);
}

function trocarLocalCliente(){
  carrinho=[];
  clienteLocalAutenticadoId = null;
  clientePasswordAtual = "";
  document.getElementById("clientePassword").value = "";
  document.getElementById("estadoLoginCliente").innerText = "Insere a password para aceder ao local.";
  mostrarProdutosCliente();
  mostrarCarrinho();
  mostrarHistoricoCliente();
  carregarDefinicoesImpressao();
}

function bloquearLocal(){
  clienteLocalAutenticadoId = null;
  clientePasswordAtual = "";
  document.getElementById("estadoLoginCliente").innerText = "Password alterada. Clica em Entrar.";
  carrinho = [];
  mostrarProdutosCliente();
  mostrarCarrinho();
}

async function validarPasswordCliente(){
  const local = localCliente();

  if(!local){
    alert("Seleciona um local.");
    return;
  }

  const password = document.getElementById("clientePassword").value;

  const r = await fetch(api(`/locais/${local.id}/validar-password`), {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ password })
  });

  const dados = await r.json();

  if(dados.ok){
    clienteLocalAutenticadoId = local.id;
    clientePasswordAtual = password;
    document.getElementById("estadoLoginCliente").innerText = "Acesso autorizado.";
  }else{
    clienteLocalAutenticadoId = null;
    clientePasswordAtual = "";
    document.getElementById("estadoLoginCliente").innerText = "Password errada.";
  }

  mostrarProdutosCliente();
}

function getQuantidade(id){
  const i=carrinho.find(x=>x.id===id);
  return i?i.quantidade:0;
}

function itemDoLocal(id){
  const local=localCliente();
  return local?.itens.find(i=>i.id===id);
}

function mostrarProdutosCliente(){
  const local=localCliente();
  const div=document.getElementById("produtosCliente");
  div.innerHTML="";

  if(!local){
    div.innerHTML='<p class="muted">Não há locais criados.</p>';
    return;
  }

  if(clienteLocalAutenticadoId !== local.id){
    div.innerHTML='<p class="muted">Insere a password correta para ver os itens deste local.</p>';
    return;
  }

  if(!local.itens.length){
    div.innerHTML='<p class="muted">Este local ainda não tem itens associados.</p>';
    return;
  }

  local.itens.forEach(item=>{
    const q=getQuantidade(item.id);
    const row=document.createElement("div");
    row.className="produto";

    if(item.stock<=0){
      row.innerHTML=`
        <div>
          <div class="nome">${item.nome}</div>
          <div class="muted">Código: ${item.codigo || "-"}</div><div class="muted">Stock central: 0</div>
        </div>
        <span class="badge red">Sem stock</span>
      `;
    }else{
      row.innerHTML=`
        <div>
          <div class="nome">${item.nome}</div>
          <div class="muted">Código: ${item.codigo || "-"}</div><div class="muted">Stock central: ${item.stock}</div>
        </div>
        <div class="qty">
          <button onclick="menos(${item.id})">-</button>
          <input type="number" min="0" max="${item.stock}" value="${q}" onchange="manual(${item.id}, this.value)">
          <button onclick="mais(${item.id})">+</button>
        </div>
      `;
    }
    div.appendChild(row);
  });
}

function mais(id){
  const item=itemDoLocal(id);
  if(!item||item.stock<=0)return;
  const e=carrinho.find(i=>i.id===id);

  if(e){
    if(e.quantidade<item.stock)e.quantidade++;
  }else{
    carrinho.push({id:item.id,nome:item.nome,quantidade:1});
  }

  mostrarProdutosCliente();
  mostrarCarrinho();
}

function menos(id){
  const e=carrinho.find(i=>i.id===id);
  if(!e)return;
  e.quantidade--;
  if(e.quantidade<=0)carrinho=carrinho.filter(i=>i.id!==id);
  mostrarProdutosCliente();
  mostrarCarrinho();
}

function manual(id,valor){
  const item=itemDoLocal(id);
  if(!item||item.stock<=0)return;

  valor=Math.max(0,Number(valor)||0);
  valor=Math.min(valor,item.stock);

  const e=carrinho.find(i=>i.id===id);

  if(valor===0)carrinho=carrinho.filter(i=>i.id!==id);
  else if(e)e.quantidade=valor;
  else carrinho.push({id:item.id,nome:item.nome,quantidade:valor});

  mostrarProdutosCliente();
  mostrarCarrinho();
}

function mostrarCarrinho(){
  const ul=document.getElementById("carrinho");
  ul.innerHTML="";
  if(!carrinho.length)ul.innerHTML='<li class="muted">Carrinho vazio.</li>';
  carrinho.forEach(i=>{
    const li=document.createElement("li");
    li.innerText=`${i.quantidade}x ${i.nome}`;
    ul.appendChild(li);
  });
}

async function enviarPedido(){
  const local=localCliente();
  if(!local){alert("Seleciona um local.");return}
  if(clienteLocalAutenticadoId !== local.id){alert("Insere a password correta do local.");return}
  if(!carrinho.length){alert("Carrinho vazio.");return}

  const r=await fetch(api("/pedidos"),{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({localId:local.id,password:clientePasswordAtual,itens:carrinho})
  });

  const dados=await r.json();
  if(!r.ok){alert(dados.erro||"Erro ao enviar pedido.");return}

  ultimoPedidoCliente=dados;
  pedidoAtual=dados;
  gravarPedidoNoHistorico(dados);
  carrinho=[];
  mostrarCarrinho();
  mostrarProdutosCliente();
  mostrarUltimoPedido();
}

function pedidoEstaEntregue(pedido){
  return String(pedido?.estado || "").toLowerCase().includes("entregue");
}

function botaoConfirmarEntregaCliente(pedido){
  if(!pedido || pedidoEstaEntregue(pedido))return "";
  return `<button class="status-btn-delivered" style="margin-top:8px" onclick="confirmarEntregaCliente(${pedido.id})">Confirmar entrega deste pedido</button>`;
}

function mostrarUltimoPedido(){
  const div=document.getElementById("ultimoPedido");
  if(!ultimoPedidoCliente){div.innerHTML="Ainda sem pedido.";return}
  div.innerHTML=`
    <h3>${ultimoPedidoCliente.codigo}</h3>
    <div class="estado ${classeEstado(ultimoPedidoCliente.estado)}">${ultimoPedidoCliente.estado}</div>
    <ul>${ultimoPedidoCliente.itens.map(i=>`<li>${i.quantidade}x ${i.nome}</li>`).join("")}</ul>
    ${botaoConfirmarEntregaCliente(ultimoPedidoCliente)}
  `;
}

function chaveHistoricoCliente(){
  const local=localCliente();
  const eventoId=eventoAtual?.id || "sem-evento";
  const localId=local?.id || "sem-local";
  return `historicoClientePedidos:${eventoId}:${localId}`;
}

function lerHistoricoCliente(){
  try{
    const dados=JSON.parse(localStorage.getItem(chaveHistoricoCliente()) || "[]");
    return Array.isArray(dados) ? dados : [];
  }catch{
    return [];
  }
}

function guardarHistoricoCliente(lista){
  localStorage.setItem(chaveHistoricoCliente(), JSON.stringify(lista.slice(0,50)));
}

function gravarPedidoNoHistorico(pedido){
  if(!pedido || !eventoAtual)return;
  const local=localCliente();
  const entrada={
    id:pedido.id,
    codigo:pedido.codigo,
    estado:pedido.estado,
    localId:local?.id || pedido.localId || null,
    localNome:local?.nome || pedido.local || "Local",
    criadoEm:pedido.criadoEm || new Date().toISOString(),
    atualizadoEm:new Date().toISOString(),
    itens:(pedido.itens || []).map(i=>({id:i.id,nome:i.nome,quantidade:i.quantidade}))
  };
  const lista=lerHistoricoCliente().filter(p=>p.id!==entrada.id);
  lista.unshift(entrada);
  guardarHistoricoCliente(lista);
  mostrarHistoricoCliente();
  carregarDefinicoesImpressao();
}

function atualizarPedidoNoHistorico(pedido){
  if(!pedido || !eventoAtual)return;
  const lista=lerHistoricoCliente();
  const idx=lista.findIndex(p=>p.id===pedido.id);
  if(idx<0)return;
  lista[idx]={
    ...lista[idx],
    estado:pedido.estado,
    atualizadoEm:new Date().toISOString(),
    itens:(pedido.itens || lista[idx].itens || []).map(i=>({id:i.id,nome:i.nome,quantidade:i.quantidade}))
  };
  guardarHistoricoCliente(lista);
  mostrarHistoricoCliente();
  carregarDefinicoesImpressao();
}

function classeEstado(estado){
  const e=String(estado || "").toLowerCase();
  if(e.includes("aguardar")) return "status-await";
  if(e.includes("processamento")) return "status-processing";
  if(e.includes("caminho")) return "status-way";
  if(e.includes("entregue")) return "status-delivered";
  return "";
}

function mostrarHistoricoCliente(){
  const div=document.getElementById("historicoCliente");
  if(!div)return;
  const lista=lerHistoricoCliente();
  if(!lista.length){div.innerHTML="Ainda sem histórico.";return}
  div.innerHTML=lista.map(p=>`
    <div class="historico-pedido">
      <h4>${p.codigo || "Pedido"} <span class="badge ${classeEstado(p.estado)}">${p.estado || "Sem estado"}</span></h4>
      <div class="muted">${p.localNome || "Local"} · ${new Date(p.criadoEm || p.atualizadoEm).toLocaleString()}</div>
      <ul>${(p.itens || []).map(i=>`<li>${i.quantidade}x ${i.nome}</li>`).join("")}</ul>
      ${botaoConfirmarEntregaCliente(p)}
    </div>
  `).join("");
}

async function confirmarEntregaCliente(id){
  const pedidoId=Number(id);
  if(!pedidoId){alert("Pedido inválido.");return}
  const r=await fetch(api("/pedidos/"+pedidoId),{
    method:"PATCH",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({estado:"Entregue"})
  });
  const dados=await r.json().catch(()=>({}));
  if(!r.ok){alert(dados.erro || "Erro ao confirmar entrega.");return}

  const idx=pedidos.findIndex(p=>Number(p.id)===pedidoId);
  if(idx>=0)pedidos[idx]=dados;
  if(ultimoPedidoCliente && Number(ultimoPedidoCliente.id)===pedidoId){ultimoPedidoCliente=dados;mostrarUltimoPedido();}
  atualizarPedidoNoHistorico(dados);
  mostrarPedidos();
  alert("Entrega confirmada para este pedido.");
}

function limparHistoricoCliente(){
  if(!confirm("Limpar o histórico deste evento/local neste dispositivo?"))return;
  localStorage.removeItem(chaveHistoricoCliente());
  mostrarHistoricoCliente();
  carregarDefinicoesImpressao();
}

async function criarLocalDef(){
  const nome=document.getElementById("novoLocalDef").value.trim();
  const password=document.getElementById("novaPasswordLocalDef").value.trim() || "1234";
  if(!nome){alert("Escreve o nome do local.");return}

  const r=await fetch(api("/locais"),{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({nome,password})
  });

  const dados=await r.json();
  if(!r.ok)alert(dados.erro||"Erro ao criar local.");
  else{
    document.getElementById("novoLocalDef").value="";
    document.getElementById("novaPasswordLocalDef").value="";
  }
}

function mostrarLocaisDef(){
  const div=document.getElementById("listaLocaisDef");
  if(!div)return;
  div.innerHTML="";
  if(!locais.length){div.innerHTML='<p class="muted">Ainda não existem locais.</p>';return}

  locais.forEach(l=>{
    const ativo=localAtivo(l);
    const row=document.createElement("div");
    row.className="stock-row" + (ativo ? "" : " local-inativo");
    row.innerHTML=`
      <div>
        <strong>${escapeHtml(l.nome)}</strong>
        <span class="badge ${ativo ? "green" : "local-status-inativo"}">${ativo ? "Ativo" : "Inativo"}</span><br>
        <span class="muted">${(l.itens||[]).length} itens associados</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
        <button class="${ativo ? "red" : "green"}" onclick="alterarEstadoLocal(${Number(l.id)}, ${ativo ? "false" : "true"})">${ativo ? "Inativar" : "Reativar"}</button>
        <button class="red" onclick="removerLocalDefinitivo(${Number(l.id)})">Remover</button>
      </div>
    `;
    div.appendChild(row);
  });
}

async function alterarEstadoLocal(localId, ativo){
  const acao=ativo ? "reativar" : "inativar";
  const password=prompt(`Password para ${acao} este local:`);
  if(password===null)return;
  const r=await fetch(api(`/locais/${localId}/ativo`),{
    method:"PATCH",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ativo,password})
  });
  const dados=await r.json().catch(()=>({}));
  if(!r.ok){alert(dados.erro || `Erro ao ${acao} local.`);return}
  alert(ativo ? "Local reativado." : "Local inativado. Já não aparece no Cliente, Contagem nem Transferências.");
}


async function removerLocalDefinitivo(localId){
  const local=locais.find(l=>Number(l.id)===Number(localId));
  if(!local){alert("Local não encontrado.");return}
  if(!confirm(`Remover definitivamente o local ${local.nome}?\n\nSó é permitido se não tiver itens, stock, pedidos, transferências ou inventários associados.`))return;
  const password=prompt("Password para remover definitivamente este local:");
  if(password===null)return;
  const r=await fetch(api(`/locais/${localId}`),{
    method:"DELETE",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({password})
  });
  const dados=await r.json().catch(()=>({}));
  if(!r.ok){alert(dados.erro || "Erro ao remover local.");return}
  alert("Local removido definitivamente.");
}

function mostrarPasswordsLocaisDef(){
  const div = document.getElementById("passwordsLocaisDef");
  if(!div)return;

  div.innerHTML = "";

  if(!locais.length){
    div.innerHTML = '<p class="muted">Ainda não existem locais.</p>';
    return;
  }

  locais.forEach(local=>{
    const row=document.createElement("div");
    row.className="stock-row";
    row.innerHTML=`
      <strong>${local.nome}</strong>
      <div style="display:flex; gap:8px; align-items:center;">
        <input id="password-local-${local.id}" value="${local.password || ""}" style="width:140px">
        <button onclick="guardarPasswordLocal(${local.id})">Guardar</button>
      </div>
    `;
    div.appendChild(row);
  });
}

async function guardarPasswordLocal(localId){
  const input=document.getElementById("password-local-"+localId);
  const password=input.value.trim();

  if(!password){
    alert("Password não pode ficar vazia.");
    return;
  }

  const r=await fetch(api(`/locais/${localId}/password`),{
    method:"PATCH",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({password})
  });

  const dados=await r.json();

  if(!r.ok){
    alert(dados.erro || "Erro ao guardar password.");
  }else{
    alert("Password guardada.");
  }
}


function mostrarPedidos(){
  const div=document.getElementById("listaPedidos");
  div.innerHTML="";
  if(!pedidos.length){div.innerHTML='<p class="muted">Ainda não existem pedidos.</p>';return}

  pedidos.slice().reverse().forEach(p=>{
    const row=document.createElement("div");
    row.className="pedido";
    row.innerHTML=`
      <div>
        <strong>${p.codigo}</strong><br>
        <span class="badge ${classeEstado(p.estado)}">${p.estado}</span>
        <span class="muted">${p.itens.length} itens</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button onclick="abrirPedido(${p.id})">Abrir</button>
        <button class="light" onclick="imprimirPedidoPorId(${p.id})">Imprimir</button>
      </div>
    `;
    div.appendChild(row);
  });
}

function abrirPedido(id){
  pedidoAtual=pedidos.find(p=>p.id===id);
  document.getElementById("pedidoSelecionado").innerHTML=`
    <h3>${pedidoAtual.codigo}</h3>
    <div class="estado ${classeEstado(pedidoAtual.estado)}">${pedidoAtual.estado}</div>
    <ul>${pedidoAtual.itens.map(i=>`<li>${i.quantidade}x ${i.nome}</li>`).join("")}</ul>
    <button class="light" onclick="imprimirPedido(pedidoAtual, true)">Reimprimir pedido</button>
  `;
}

async function estado(e){
  if(!pedidoAtual){alert("Seleciona um pedido.");return}
  await fetch(api("/pedidos/"+pedidoAtual.id),{
    method:"PATCH",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({estado:e})
  });
}

function mostrarStockOperador(){
  const div=document.getElementById("stockOperador");
  if(!div)return;
  div.innerHTML="";

  if(!catalogo.length){
    div.innerHTML='<p class="muted">Ainda não existem itens.</p>';
    return;
  }

  catalogo.forEach(item=>{
    const minimo=Number(item.stockMinimo || 0);
    const stock=Number(item.stock || 0);
    const baixo=minimo>0 && stock<minimo;
    const row=document.createElement("div");
    row.className="stock-row" + (baixo ? " stock-alert-row" : "");
    row.innerHTML=`
      <div><strong>${escapeHtml(item.nome)}</strong><br><span class="muted">Código: ${escapeHtml(item.codigo || "-")}</span>${minimo>0?`<br><span class="muted">Mínimo: ${minimo}</span>`:""}</div>
      <span class="${baixo || stock<=0?'badge red':'badge green'}">Stock central: ${stock}${baixo?" · abaixo do mínimo":""}</span>
    `;
    div.appendChild(row);
  });
}


function gerarTabelaStockBarOperador(){
  if(!catalogo.length){
    return '<p class="muted">Ainda não existem itens.</p>';
  }

  if(!locais.length){
    return '<p class="muted">Ainda não existem locais.</p>';
  }

  let tabela = `
    <div class="stock-table-wrap">
      <table class="stock-table">
        <thead>
          <tr>
            <th>Item</th>
            ${locais.map(local => `<th>${local.nome}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
  `;

  catalogo.forEach(item => {
    tabela += `
      <tr>
        <td>
          <div class="item-name">${item.nome}</div>
          <div class="item-code">${item.codigo || "-"}</div>
        </td>
        ${locais.map(local => {
          const itemNoBar = (local.itens || []).find(i => Number(i.id) === Number(item.id));

          if(!itemNoBar){
            return `<td class="not-associated">—</td>`;
          }

          const stockBar = Number(itemNoBar.stockBar || 0);
          const minimo=Number(item.stockMinimo || 0);
          const baixo=minimo>0 && stockBar<minimo;

          return `<td class="${baixo ? "stock-low" : (stockBar <= 0 ? "stock-zero" : "stock-ok")}">${stockBar}${baixo?`<br><small>mín. ${minimo}</small>`:""}</td>`;
        }).join("")}
      </tr>
    `;
  });

  tabela += `
        </tbody>
      </table>
    </div>
  `;

  return tabela;
}

function mostrarAlertasStockMinimo(){
  const div=document.getElementById("alertasStockMinimo");
  if(!div)return;
  const alertas=[];
  catalogo.forEach(item=>{
    const minimo=Number(item.stockMinimo || 0);
    if(minimo<=0)return;
    const stockCentral=Number(item.stock || 0);
    if(stockCentral<minimo){
      alertas.push({tipo:"Armazém geral", nome:item.nome, codigo:item.codigo||"-", stock:stockCentral, minimo});
    }
    locais.forEach(local=>{
      const itemLocal=(local.itens||[]).find(i=>Number(i.id)===Number(item.id));
      if(!itemLocal)return;
      const stockLocal=Number(itemLocal.stockBar || 0);
      if(stockLocal<minimo){
        alertas.push({tipo:local.nome, nome:item.nome, codigo:item.codigo||"-", stock:stockLocal, minimo});
      }
    });
  });
  if(!alertas.length){
    div.innerHTML='<p><span class="badge green">Sem alertas de stock mínimo.</span></p>';
    return;
  }
  div.innerHTML=alertas.map(a=>`<div class="stock-row stock-alert-row"><div><strong>${escapeHtml(a.nome)}</strong><br><span class="muted">${escapeHtml(a.tipo)} · Código: ${escapeHtml(a.codigo)}</span></div><span class="badge red">${a.stock} / mín. ${a.minimo}</span></div>`).join("");
}

function mostrarStockBarOperador(){
  const div = document.getElementById("stockBarOperador");
  if(!div) return;
  div.innerHTML = gerarTabelaStockBarOperador();

  const modal=document.getElementById("stockBarFullscreen");
  const conteudo=document.getElementById("stockBarFullscreenConteudo");
  if(modal && modal.classList.contains("open") && conteudo){
    conteudo.innerHTML = gerarTabelaStockBarOperador();
  }
}

function abrirStockBarFullscreen(){
  const modal=document.getElementById("stockBarFullscreen");
  const conteudo=document.getElementById("stockBarFullscreenConteudo");
  if(!modal || !conteudo) return;
  conteudo.innerHTML = gerarTabelaStockBarOperador();
  modal.classList.add("open");
}

function fecharStockBarFullscreen(){
  const modal=document.getElementById("stockBarFullscreen");
  if(modal) modal.classList.remove("open");
}

function escapeHtml(v){
  return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function valorInput(v){
  return escapeHtml(v);
}

function numeroInput(v, padrao=0){
  if(v === undefined || v === null || v === "") return padrao;
  const n = Number(String(v).trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : padrao;
}

function mostrarCatalogo(){
  const div=document.getElementById("catalogoLista");
  div.innerHTML="";
  if(!catalogo.length){div.innerHTML='<p class="muted">Ainda não existem itens.</p>';return}

  catalogo.forEach(item=>{
    const row=document.createElement("div");
    row.className="stock-row";
    row.innerHTML=`
      <div class="catalogo-edit">
        <input id="edit-nome-${item.id}" value="${valorInput(item.nome)}" placeholder="Nome do item">
        <input id="edit-codigo-${item.id}" value="${valorInput(item.codigo || "")}" placeholder="Código de barras">
        <input id="edit-stock-${item.id}" class="stock-input" type="number" min="0" value="${Number(item.stock || 0)}" placeholder="Stock">
        <input id="edit-minimo-${item.id}" class="stock-input" type="number" min="0" value="${Number(item.stockMinimo || 0)}" placeholder="Mínimo">
        <label style="display:flex;gap:6px;align-items:center;font-size:12px"><input id="edit-doses-ativo-${item.id}" type="checkbox" style="width:auto" ${item.dosesAtivo ? "checked" : ""}> Doses</label>
        <input id="edit-doses-${item.id}" class="stock-input" type="number" min="0" step="0.01" value="${Number(item.dosesPorGarrafa || 0)}" placeholder="Doses/garrafa">
        <input id="edit-preco-${item.id}" class="stock-input" type="number" min="0" step="0.01" value="${Number(item.precoDose || 0)}" placeholder="Preço dose €">
        <button onclick="guardarItem(${item.id})">Guardar</button>
        <button class="red" onclick="removerItem(${item.id})">Remover</button>
      </div>
    `;
    div.appendChild(row);
  });
}


function mostrarTransferenciasBD(){
  const itemSel=document.getElementById("transferItem");
  const localSel=document.getElementById("transferLocal");
  const resumo=document.getElementById("transferResumo");
  const historico=document.getElementById("transferHistorico");
  if(!itemSel || !localSel)return;

  const itemAtual=itemSel.value;
  const localAtual=localSel.value;

  itemSel.innerHTML="";
  localSel.innerHTML="";

  catalogo.forEach(item=>{
    const op=document.createElement("option");
    op.value=item.id;
    op.textContent=`${item.nome} · stock central: ${Number(item.stock || 0)}`;
    itemSel.appendChild(op);
  });

  locaisAtivos().forEach(local=>{
    const op=document.createElement("option");
    op.value=local.id;
    op.textContent=local.nome;
    localSel.appendChild(op);
  });

  if(itemAtual && catalogo.some(i=>String(i.id)===String(itemAtual)))itemSel.value=itemAtual;
  if(localAtual && locaisAtivos().some(l=>String(l.id)===String(localAtual)))localSel.value=localAtual;

  if(resumo){
    if(!catalogo.length)resumo.innerHTML='<p class="muted">Ainda não existem itens na base de dados.</p>';
    else if(!locaisAtivos().length)resumo.innerHTML='<p class="muted">Ainda não existem locais ativos.</p>';
    else resumo.innerHTML='<p class="muted">A transferência associa automaticamente o item ao local, se ainda não estiver associado.</p>';
  }

  if(historico){
    const lista=(transferenciasLocais||[]).slice(0,12);
    if(!lista.length){
      historico.innerHTML='<p class="muted">Ainda não há transferências para locais.</p>';
    }else{
      historico.innerHTML=`<h3>Últimas transferências</h3>${lista.map(t=>`
        <div class="stock-row">
          <div>
            <strong>${escapeHtml(t.itemNome||"Item")}</strong> → ${escapeHtml(t.localNome||"Local")}<br>
            <span class="muted">Qtd: ${Number(t.quantidade||0)} · ${new Date(t.criadoEm).toLocaleString()}${t.anulada ? " · Anulada" : ""}</span>
          </div>
          ${t.anulada ? '<span class="badge">Undo feito</span>' : `<button class="red" onclick="undoTransferenciaLocal(${Number(t.id)})">Undo</button>`}
        </div>`).join("")}`;
    }
  }
}


function mostrarStockLocaisBD(){
  const div=document.getElementById("stockLocaisBD");
  const sel=document.getElementById("stockLocalSelect");
  if(!div)return;

  if(!locais.length){
    if(sel)sel.innerHTML="";
    div.innerHTML='<p class="muted">Ainda não existem locais.</p>';
    return;
  }
  if(!catalogo.length){
    if(sel)sel.innerHTML="";
    div.innerHTML='<p class="muted">Ainda não existem itens na base de dados.</p>';
    return;
  }

  let localId=sel ? sel.value : "";
  if(sel){
    const anterior=sel.value;
    sel.innerHTML=locais.map(local=>`<option value="${Number(local.id)}">${escapeHtml(local.nome)}</option>`).join("");
    if(anterior && locais.some(local=>String(local.id)===String(anterior)))sel.value=anterior;
    localId=sel.value || String(locais[0].id);
  }else{
    localId=String(locais[0].id);
  }

  const local=locais.find(l=>String(l.id)===String(localId)) || locais[0];
  const itens=catalogo.map(item=>{
    const itemLocal=(local.itens||[]).find(i=>Number(i.id)===Number(item.id));
    const stock=Number(itemLocal ? itemLocal.stockBar : ((local.stockBar||{})[item.id]||0));
    const minimo=Number(item.stockMinimo || 0);
    const baixo=minimo>0 && stock<minimo;
    return `<div class="stock-row ${baixo ? "stock-alert-row" : ""}">
      <div>
        <strong>${escapeHtml(item.nome)}</strong><br>
        <span class="muted">${escapeHtml(item.codigo||"")} · Stock ${escapeHtml(local.nome)}: ${stock}${minimo>0?` · Mínimo: ${minimo}`:""}</span>${baixo?`<br><span class="stock-alert-text">Abaixo do mínimo</span>`:""}
      </div>
      <div class="row">
        <input id="stock-local-${local.id}-${item.id}" class="stock-input" type="number" min="0" value="${stock}">
        <button onclick="guardarStockLocal(${Number(local.id)},${Number(item.id)})">Guardar</button>
      </div>
    </div>`;
  }).join("");

  div.innerHTML=`<div style="margin-top:14px">
    <h3>Stock ${escapeHtml(local.nome)}</h3>
    ${itens}
  </div>`;
}

async function guardarStockLocal(localId,itemId){
  const input=document.getElementById(`stock-local-${localId}-${itemId}`);
  const stock=Math.max(0,Number(input?.value)||0);
  const r=await fetch(api(`/locais/${localId}/stock/${itemId}`),{
    method:"PATCH",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({stock})
  });
  const dados=await r.json();
  if(!r.ok){alert(dados.erro||"Erro ao guardar stock do local.");return}
  alert("Stock do local atualizado.");
}

async function transferirItemParaLocal(){
  const itemId=Number(document.getElementById("transferItem").value);
  const localId=Number(document.getElementById("transferLocal").value);
  const quantidade=Math.max(0,Number(document.getElementById("transferQuantidade").value)||0);
  if(!itemId || !localId){alert("Seleciona o item e o local.");return}
  if(quantidade<=0){alert("Indica uma quantidade maior que zero.");return}

  const r=await fetch(api("/transferencias/local"),{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({itemId,localId,quantidade})
  });
  const dados=await r.json();
  if(!r.ok){alert(dados.erro||"Erro ao transferir item.");return}
  document.getElementById("transferQuantidade").value="";
  alert("Item transferido para o local.");
}

async function undoTransferenciaLocal(id){
  if(!confirm("Anular esta transferência? O stock volta ao stock central e sai do local."))return;
  const r=await fetch(api(`/transferencias/local/${id}/undo`),{method:"POST"});
  const dados=await r.json();
  if(!r.ok){alert(dados.erro||"Erro ao anular transferência.");return}
  alert("Transferência anulada.");
}

async function atualizarStockGlobal(id,valor){
  const item=catalogo.find(i=>i.id===id);
  if(!item)return;
  await guardarItem(id, { nome:item.nome, codigo:item.codigo || "", stock:Math.max(0,numeroInput(valor)), stockMinimo:Number(item.stockMinimo || 0), dosesAtivo:!!item.dosesAtivo, dosesPorGarrafa:Number(item.dosesPorGarrafa||0), precoDose:Number(item.precoDose||0) });
}

async function guardarItem(id, dadosManuais){
  const item=catalogo.find(i=>i.id===id);
  if(!item)return;

  const dados=dadosManuais || {
    nome:document.getElementById("edit-nome-"+id).value.trim(),
    codigo:document.getElementById("edit-codigo-"+id).value.trim(),
    stock:Math.max(0,numeroInput(document.getElementById("edit-stock-"+id).value)),
    stockMinimo:Math.max(0,numeroInput(document.getElementById("edit-minimo-"+id).value)),
    dosesAtivo:!!document.getElementById("edit-doses-ativo-"+id)?.checked,
    dosesPorGarrafa:Math.max(0,numeroInput(document.getElementById("edit-doses-"+id)?.value)),
    precoDose:Math.max(0,numeroInput(document.getElementById("edit-preco-"+id)?.value))
  };

  if(!dados.nome){alert("O nome do item não pode ficar vazio.");return}

  const r=await fetch(api(`/catalogo/${id}`),{
    method:"PATCH",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(dados)
  });

  const resposta=await r.json();
  if(!r.ok)alert(resposta.erro||"Erro ao guardar item.");
}

async function criarItem(){
  const nome=document.getElementById("novoItemNome").value.trim();
  const codigo=document.getElementById("novoItemCodigo").value.trim();
  const stock=Math.max(0,numeroInput(document.getElementById("novoItemStock").value));
  const stockMinimo=Math.max(0,numeroInput(document.getElementById("novoItemStockMinimo").value));
  const dosesAtivo=!!document.getElementById("novoItemDosesAtivo")?.checked;
  const dosesPorGarrafa=Math.max(0,numeroInput(document.getElementById("novoItemDosesPorGarrafa")?.value));
  const precoDose=Math.max(0,numeroInput(document.getElementById("novoItemPrecoDose")?.value));
  if(!nome){alert("Preenche o nome do item.");return}

  const r=await fetch(api("/catalogo"),{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({nome,codigo,stock,stockMinimo,dosesAtivo,dosesPorGarrafa,precoDose})
  });

  const dados=await r.json();
  if(!r.ok)alert(dados.erro||"Erro ao criar item.");
  else{
    document.getElementById("novoItemNome").value="";
    document.getElementById("novoItemCodigo").value="";
    document.getElementById("novoItemStock").value="";
    document.getElementById("novoItemStockMinimo").value="";
    document.getElementById("novoItemDosesAtivo").checked=false;
    document.getElementById("novoItemDosesPorGarrafa").value="";
    document.getElementById("novoItemPrecoDose").value="";
  }
}

async function removerItem(id){
  const item=catalogo.find(i=>i.id===id);
  const nome=item?item.nome:"item";
  if(!confirm(`Remover "${nome}" da base de dados e de todos os locais?`))return;

  const r=await fetch(api("/catalogo/"+id),{method:"DELETE"});
  const dados=await r.json();
  if(!r.ok)alert(dados.erro||"Erro ao remover item.");
}

function selecionarTodosItens(){
  document.querySelectorAll("#associacaoItens input[type=checkbox]").forEach(c=>c.checked=true);
}

function removerTodosItens(){
  document.querySelectorAll("#associacaoItens input[type=checkbox]").forEach(c=>c.checked=false);
}

function mostrarAssociacao(){
  const local=locais.find(l=>l.id==document.getElementById("defLocal").value);
  const div=document.getElementById("associacaoItens");
  if(!div)return;
  div.innerHTML="";

  if(!local){div.innerHTML='<p class="muted">Seleciona um local.</p>';return}

  catalogo.forEach(item=>{
    const checked=local.itens.some(i=>i.id===item.id);
    const row=document.createElement("label");
    row.className="check-row";
    row.innerHTML=`
      <span>${item.nome} <span class="muted">Código: ${item.codigo || "-"} · Stock central: ${item.stock}</span></span>
      <input type="checkbox" value="${item.id}" ${checked?"checked":""} style="width:auto">
    `;
    div.appendChild(row);
  });
}

async function guardarAssociacao(){
  const localId=document.getElementById("defLocal").value;
  const checks=document.querySelectorAll("#associacaoItens input[type=checkbox]:checked");
  const itemIds=Array.from(checks).map(c=>Number(c.value));

  await fetch(api(`/locais/${localId}/itens`),{
    method:"PATCH",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({itemIds})
  });

  alert("Associação guardada.");
}

async function importarListas(){
  let dados;
  try{dados=JSON.parse(document.getElementById("jsonImportar").value)}
  catch{alert("JSON inválido.");return}

  const r=await fetch(api("/importar"),{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(dados)
  });

  if(!r.ok)alert("Erro ao importar.");
  else alert("Importado.");
}


async function criarDia(){
  const nome=document.getElementById("novoDiaNome").value.trim();
  const data=document.getElementById("novoDiaData").value.trim();
  if(!nome){alert("Escreve o nome do dia.");return}
  const r=await fetch(api("/dias"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nome,data})});
  const d=await r.json();
  if(!r.ok){alert(d.erro||"Erro ao criar dia.");return}
  document.getElementById("novoDiaNome").value="";
  document.getElementById("novoDiaData").value="";
}

async function carregarInventarios(){
  if(!eventoAtual)return;
  const r=await fetch(api("/inventarios"));
  if(r.ok) inventarios=await r.json();
}

function stockLocalSistema(itemId, localId){
  const local=locais.find(l=>Number(l.id)===Number(localId));
  const it=(local?.itens||[]).find(i=>Number(i.id)===Number(itemId));
  return Number(it?.stockBar||0);
}

function stockTotalLocaisItem(itemId){
  let total=0;
  locais.forEach(local=> total += stockLocalSistema(itemId, local.id));
  return total;
}

function sistemaTotalItem(item){
  return Number(item.stock||0)+stockTotalLocaisItem(item.id);
}

function itemComDoses(item){
  return !!item?.dosesAtivo && Number(item?.dosesPorGarrafa || 0) > 0;
}

function formatoEuro(valor){
  return Number(valor || 0).toLocaleString("pt-PT", { style:"currency", currency:"EUR" });
}

function resumoDosesInventario(item, vendidoGarrafas){
  if(!itemComDoses(item)) return "";
  const doses=Number((Number(vendidoGarrafas || 0) * Number(item.dosesPorGarrafa || 0)).toFixed(2));
  const valor=Number((doses * Number(item.precoDose || 0)).toFixed(2));
  return `<br><span class="muted">Doses teóricas: <strong>${doses}</strong> · Preço dose: <strong>${formatoEuro(item.precoDose)}</strong> · Valor teórico: <strong>${formatoEuro(valor)}</strong></span>`;
}

function mostrarInventario(){
  mostrarDiasInventario();
  mostrarFormularioInventario();
  mostrarEstadoFechoDia();
  mostrarListaInventarios();
  mostrarResumoInventario();
}

function inventariosLocaisRecebidos(diaId){
  const porLocal={};
  inventarios
    .filter(inv=>inv.tipo==="fim_dia" && Number(inv.diaId)===Number(diaId) && Number(inv.localIdContagem||0)>0)
    .sort((a,b)=>new Date(a.criadoEm||0)-new Date(b.criadoEm||0))
    .forEach(inv=>{ porLocal[Number(inv.localIdContagem)] = inv; });
  return porLocal;
}

function contagensLocaisRecebidasParaDia(diaId){
  const recebidos=inventariosLocaisRecebidos(diaId);
  const contagensLocais={};
  Object.keys(recebidos).forEach(localId=>{
    const inv=recebidos[localId];
    const mapa=inv.contagensLocais?.[localId] || inv.contagensLocais?.[String(localId)] || {};
    contagensLocais[localId]={};
    Object.keys(mapa).forEach(itemId=>{ contagensLocais[localId][itemId]=Math.max(0,Number(mapa[itemId]||0)); });
  });
  return contagensLocais;
}

function locaisComItensInventario(){
  return locais.filter(l=>((l.itens&&l.itens.length) || (l.itemIds&&l.itemIds.length)));
}

function aplicarContagensRecebidasAoDraft(){
  const diaId=Number(document.getElementById("inventarioDia")?.value||0);
  if(!diaId){alert("Escolhe um dia.");return false}
  const recebidas=contagensLocaisRecebidasParaDia(diaId);
  if(!Object.keys(recebidas).length){alert("Ainda não há contagens enviadas para este dia.");return false}
  inventarioContagensLocaisDraft=recebidas;
  mostrarFormularioInventario(false);
  mostrarEstadoFechoDia();
  return true;
}

async function fecharDiaComContagensRecebidas(){
  if(!aplicarContagensRecebidasAoDraft())return;
  await guardarInventario(true);
}

function mostrarEstadoFechoDia(){
  const div=document.getElementById("estadoFechoDia");
  if(!div)return;
  const diaId=Number(document.getElementById("inventarioDia")?.value||0);
  if(!diaId){div.innerHTML='<p class="muted">Escolhe um dia para ver as contagens recebidas.</p>';return}
  const recebidos=inventariosLocaisRecebidos(diaId);
  const locaisBase=locaisComItensInventario();
  const linhas=locaisBase.map(local=>{
    const inv=recebidos[Number(local.id)];
    return `<div class="stock-row"><strong>${local.nome}</strong><span class="badge ${inv?'green':'red'}">${inv?'Enviado':'Por enviar'}</span></div>`;
  }).join("");
  const enviados=locaisBase.filter(l=>recebidos[Number(l.id)]).length;
  const todos=locaisBase.length>0 && enviados===locaisBase.length;
  div.innerHTML=`
    <div class="card">
      <h3>Fecho do dia por contagens recebidas <span class="badge ${todos?'green':'red'}">${enviados}/${locaisBase.length}</span></h3>
      ${linhas || '<p class="muted">Ainda não existem locais com itens.</p>'}
      <button class="light" style="margin-top:10px" onclick="aplicarContagensRecebidasAoDraft()">Carregar contagens recebidas</button>
      <button class="green" style="margin-top:10px" onclick="fecharDiaComContagensRecebidas()">Fechar dia com contagens recebidas</button>
      ${!todos?'<p class="muted">Pode fechar mesmo assim, mas a app vai avisar dos locais em falta.</p>':''}
    </div>`;
}

function mostrarDiasInventario(){
  const div=document.getElementById("listaDiasInventario");
  const sel=document.getElementById("inventarioDia");
  if(!div||!sel)return;
  div.innerHTML=""; sel.innerHTML="";
  if(!dias.length){div.innerHTML='<p class="muted">Ainda não existem dias neste evento.</p>';}
  dias.forEach(d=>{
    const row=document.createElement("div");
    row.className="stock-row";
    row.innerHTML=`<strong>${d.nome}</strong><span class="muted">${d.data || "Sem data"}</span>`;
    div.appendChild(row);
    const op=document.createElement("option"); op.value=d.id; op.innerText=`${d.nome}${d.data?" · "+d.data:""}`; sel.appendChild(op);
  });
}

function capturarContagensLocalAtual(){
  const sel=document.getElementById("inventarioLocal");
  const localId=Number(sel?.value || inventarioLocalSelecionado || 0);
  if(!localId)return;
  inventarioContagensLocaisDraft[localId]=inventarioContagensLocaisDraft[localId]||{};
  document.querySelectorAll(".inventario-local-input").forEach(input=>{
    const itemId=Number(input.dataset.item||0);
    if(itemId) inventarioContagensLocaisDraft[localId][itemId]=Math.max(0,Number(input.value||0));
  });
}

function totalRealItemDraft(itemId){
  let total=0;
  locais.forEach(local=>{
    total += Number((inventarioContagensLocaisDraft[local.id]||{})[itemId]||0);
  });
  return total;
}

function atualizarResumoItemInventario(itemId, stockLocalAtual){
  const localId=Number(document.getElementById("inventarioLocal")?.value || inventarioLocalSelecionado || 0);
  const realLocal=Number((inventarioContagensLocaisDraft[localId]||{})[itemId]||0);
  const totalLocaisSistema=stockTotalLocaisItem(itemId);
  const totalRealLocais=totalRealItemDraft(itemId);
  const vendidoLocal=Math.max(0, stockLocalAtual - realLocal);
  const vendidoTotal=Math.max(0, totalLocaisSistema - totalRealLocais);
  const totalInput=document.getElementById(`contagem-item-${itemId}`);
  if(totalInput) totalInput.value = totalRealLocais;
  const desvioLocal = realLocal - stockLocalAtual;
  const desvioEl=document.getElementById(`desvio-item-${itemId}`);
  if(desvioEl){
    const itemCatalogo=catalogo.find(i=>Number(i.id)===Number(itemId));
    desvioEl.innerHTML = `Stock neste local: <strong>${stockLocalAtual}</strong> · Real neste local: <strong>${realLocal}</strong> · Vendido teórico local: <strong>${vendidoLocal}</strong>${resumoDosesInventario(itemCatalogo, vendidoLocal)}<br>Total real locais: <strong>${totalRealLocais}</strong> · Vendido teórico geral dos locais: <strong>${vendidoTotal}</strong> · Diferença local: <strong>${desvioLocal>0?'+':''}${desvioLocal}</strong>`;
  }
}

function mudarLocalInventario(){
  capturarContagensLocalAtual();
  const sel=document.getElementById("inventarioLocal");
  inventarioLocalSelecionado=Number(sel?.value||0);
  mostrarFormularioInventario(false);
}

function mostrarFormularioInventario(capturar=true){
  if(capturar) capturarContagensLocalAtual();
  const tipo=document.getElementById("inventarioTipo")?.value || "fim_dia";
  const selDia=document.getElementById("inventarioDia");
  if(selDia) selDia.disabled = tipo === "final_evento";
  const selLocal=document.getElementById("inventarioLocal");
  const div=document.getElementById("contagensInventario");
  if(!div)return;
  div.innerHTML="";

  const locaisInventario=locaisAtivos();
  if(!locaisInventario.length){
    if(selLocal) selLocal.innerHTML="";
    div.innerHTML='<p class="muted">Ainda não existem locais/bares ativos.</p>';
    return;
  }

  if(!inventarioLocalSelecionado || !locaisInventario.some(l=>Number(l.id)===Number(inventarioLocalSelecionado))){
    inventarioLocalSelecionado=Number(locaisInventario[0].id);
  }

  if(selLocal){
    const atual=String(inventarioLocalSelecionado);
    selLocal.innerHTML="";
    locaisInventario.forEach(local=>{
      const op=document.createElement("option");
      op.value=local.id;
      op.innerText=local.nome;
      selLocal.appendChild(op);
    });
    selLocal.value=atual;
  }

  const local=locaisInventario.find(l=>Number(l.id)===Number(inventarioLocalSelecionado));
  const itensLocal=(local?.itens&&local.itens.length?local.itens:catalogo.filter(item=>(local?.itemIds||[]).map(Number).includes(Number(item.id))));
  if(!itensLocal.length){
    div.innerHTML='<p class="muted">Este local ainda não tem itens associados.</p>';
    return;
  }

  inventarioContagensLocaisDraft[inventarioLocalSelecionado]=inventarioContagensLocaisDraft[inventarioLocalSelecionado]||{};

  const titulo=document.createElement("div");
  titulo.className="stock-row";
  titulo.innerHTML=`<strong>${local.nome}</strong><span class="badge">${itensLocal.length} itens</span>`;
  div.appendChild(titulo);

  itensLocal.forEach(item=>{
    const itemCatalogo=catalogo.find(i=>Number(i.id)===Number(item.id)) || item;
    const stockLocal=stockLocalSistema(item.id, inventarioLocalSelecionado);
    const totalLocais=stockTotalLocaisItem(item.id);
    const sistema=sistemaTotalItem(itemCatalogo);
    const valorLocal=Number((inventarioContagensLocaisDraft[inventarioLocalSelecionado]||{})[item.id]||0);
    const wrapper=document.createElement("div");
    wrapper.className="card";
    wrapper.innerHTML=`
      <div class="stock-row">
        <div>
          <strong style="font-size:16px">${itemCatalogo.nome}</strong><br>
          <span class="muted">Código: ${itemCatalogo.codigo || "-"} · Stock deste local: ${stockLocal} · Total locais: ${totalLocais} · Armazém geral: ${Number(itemCatalogo.stock||0)} · Sistema geral: ${sistema}${itemComDoses(itemCatalogo)?` · Doses/garrafa: ${Number(itemCatalogo.dosesPorGarrafa||0)} · Preço dose: ${formatoEuro(itemCatalogo.precoDose)}`:""}</span>
        </div>
        <input type="number" min="0" value="${valorLocal}" 
          data-item="${item.id}" 
          data-local="${inventarioLocalSelecionado}" 
          class="inventario-local-input"
          style="width:120px"
          oninput="inventarioContagensLocaisDraft[${inventarioLocalSelecionado}]=inventarioContagensLocaisDraft[${inventarioLocalSelecionado}]||{}; inventarioContagensLocaisDraft[${inventarioLocalSelecionado}][${item.id}]=Math.max(0,Number(this.value||0)); atualizarResumoItemInventario(${item.id}, ${stockLocal})">
      </div>
      <input id="contagem-item-${item.id}" type="hidden" value="${totalRealItemDraft(item.id)}">
      <div class="muted" id="desvio-item-${item.id}" style="margin-top:6px;font-size:12px"></div>
    `;
    div.appendChild(wrapper);
    atualizarResumoItemInventario(item.id, stockLocal);
  });
}

function atualizarTotalInventario(itemId, sistema){
  const inputs=[...document.querySelectorAll(`[data-item="${itemId}"]`)];
  let total=0;
  inputs.forEach(i=> total += Number(i.value||0));
  const totalInput=document.getElementById(`contagem-item-${itemId}`);
  if(totalInput) totalInput.value = total;

  const desvio = total - sistema;
  const desvioEl=document.getElementById(`desvio-item-${itemId}`);
  if(desvioEl){
    desvioEl.innerHTML = `Desvio: <strong>${desvio>0?'+':''}${desvio}</strong>`;
  }
}

function estatisticasDoInventario(inv){
  if(inv.estatisticas)return inv.estatisticas;
  const contagens=inv.contagens||{};
  return catalogo.map(item=>{
    const sistema=sistemaTotalItem(item);
    const real=Math.max(0,Number(contagens[item.id])||0);
    const desvio=real-sistema;
    const desvioAbs=Math.abs(desvio);
    const desvioPercent=sistema>0?Number(((desvioAbs/sistema)*100).toFixed(2)):(real>0?100:0);
    const requisitadoTransferido=pedidos.reduce((t,p)=>t+(p.itens||[]).filter(i=>i.id===item.id).reduce((s,i)=>s+Number(i.quantidade||0),0),0);
    const vendido=Math.max(0,(item.stockBarTotal||0)-(real||0));
    const dosesAtivo=!!item.dosesAtivo;
    const dosesPorGarrafa=Number(item.dosesPorGarrafa||0);
    const precoDose=Number(item.precoDose||0);
    const dosesVendidasTeoricas=dosesAtivo?Number((vendido*dosesPorGarrafa).toFixed(2)):0;
    const valorVendidoTeorico=dosesAtivo?Number((dosesVendidasTeoricas*precoDose).toFixed(2)):0;
    return {id:item.id,nome:item.nome,codigo:item.codigo||"",dosesAtivo,dosesPorGarrafa,precoDose,dosesVendidasTeoricas,valorVendidoTeorico,sistema,real,desvio,desvioAbs,desvioPercent,vendido,requisitadoTransferido,estado:desvio===0?"OK":(desvio<0?"Falta":"Excesso")};
  });
}

async function guardarInventario(usouContagensRecebidas=false){
  capturarContagensLocalAtual();
  const tipo=document.getElementById("inventarioTipo").value;
  const diaId=Number(document.getElementById("inventarioDia").value||0);
  if(tipo==="fim_dia" && !diaId){alert("Cria ou escolhe um dia.");return}
  const contagens={};
  catalogo.forEach(item=>{contagens[item.id]=Math.max(0,Number(totalRealItemDraft(item.id))||0)});
  const locaisComItens=locais.filter(l=>(l.itens||[]).length>0);
  const locaisPreenchidos=locaisComItens.filter(l=>inventarioContagensLocaisDraft[l.id] && Object.keys(inventarioContagensLocaisDraft[l.id]).length>0);
  if(tipo==="fim_dia" && locaisComItens.length && locaisPreenchidos.length < locaisComItens.length){
    const falta=locaisComItens.filter(l=>!inventarioContagensLocaisDraft[l.id] || !Object.keys(inventarioContagensLocaisDraft[l.id]).length).map(l=>l.nome).join(", ");
    if(!confirm(`Ainda faltam contagens de alguns locais: ${falta}. Fechar dia na mesma?`))return;
  }
  const contagensLocais=inventarioContagensLocaisDraft;
  const notaBase=document.getElementById("inventarioNota").value.trim();
  const nota=usouContagensRecebidas ? `Fecho consolidado com contagens recebidas${notaBase?" · "+notaBase:""}` : notaBase;
  const r=await fetch(api("/inventarios"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tipo,diaId,nota,contagens,contagensLocais})});
  const d=await r.json();
  if(!r.ok){alert(d.erro||"Erro ao guardar inventário.");return}
  if(tipo==="fim_dia") alert("Fim do dia guardado. O stock dos locais foi transportado automaticamente para o dia seguinte.");
  document.getElementById("inventarioNota").value="";
  inventarioContagensLocaisDraft={};
  await carregarInventarios();
  mostrarInventario();
}

async function removerInventario(id){
  if(!confirm("Remover este registo de inventário?"))return;
  await fetch(api("/inventarios/"+id),{method:"DELETE"});
  await carregarInventarios();
  mostrarInventario();
}

function mostrarListaInventarios(){
  const div=document.getElementById("listaInventarios");
  if(!div)return;
  div.innerHTML="";
  if(!inventarios.length){div.innerHTML='<p class="muted">Ainda não há registos de inventário.</p>';return}
  inventarios.slice().reverse().forEach(inv=>{
    const dia=dias.find(d=>d.id===inv.diaId);
    const stats=estatisticasDoInventario(inv);
    const totalDesvio=stats.reduce((a,e)=>a+e.desvioAbs,0);
    const linhas=stats.slice().sort((a,b)=>b.desvioAbs-a.desvioAbs).map(e=>`
      <tr>
        <td><strong>${e.nome}</strong><br><span class="muted">${e.codigo||"-"}</span></td>
        <td>${e.stockCentral ?? 0}</td>
        <td>${e.stockBarTotal ?? 0}</td>
        <td>${e.realLocais ?? e.real}</td>
        <td>${e.realComArmazem ?? ((e.stockCentral||0)+(e.real||0))}</td>
        <td>${e.vendidoTeorico ?? Math.max(0,(e.stockBarTotal||0)-(e.real||0))}</td>
        <td>${e.dosesAtivo ? (e.dosesVendidasTeoricas ?? 0) : "—"}</td>
        <td>${e.dosesAtivo ? formatoEuro(e.valorVendidoTeorico ?? 0) : "—"}</td>
        <td class="${e.desvio===0?'stock-ok':'stock-zero'}">${e.desvio>0?"+":""}${e.desvio}</td>
        <td>${e.requisitadoTransferido ?? 0}</td>
        <td>${e.estado}</td>
      </tr>`).join("");
    const card=document.createElement("div");
    card.className="card";
    card.innerHTML=`
      <h3>${inv.tipo==="final_evento"?"Final do evento":(inv.localIdContagem?"Contagem recebida":"Fim do dia fechado")} <span class="badge ${inv.localIdContagem?'':'green'}">${inv.localIdContagem?'Pendente':'Consolidado'}</span> <span class="badge ${totalDesvio?"red":"green"}">Desvio total: ${totalDesvio}</span></h3>
      <p class="muted">${dia?dia.nome:"Evento completo"} · ${new Date(inv.criadoEm).toLocaleString()} ${inv.nota?"· "+inv.nota:""}</p>
      <div class="stock-table-wrap"><table class="stock-table"><thead><tr><th>Item</th><th>Armazém geral</th><th>Stock locais</th><th>Real locais</th><th>Real + armazém</th><th>Vendido teórico</th><th>Doses teóricas</th><th>Valor teórico</th><th>Diferença</th><th>Requisitado / transferido</th><th>Estado</th></tr></thead><tbody>${linhas}</tbody></table></div>
      <button class="red" style="margin-top:10px" onclick="removerInventario(${inv.id})">Remover registo</button>
    `;
    div.appendChild(card);
  });
}

function mostrarResumoInventario(){
  const div=document.getElementById("resumoInventario");
  if(!div)return;
  const totalRequisitado={};
  pedidos.forEach(p=>(p.itens||[]).forEach(i=>{totalRequisitado[i.id]=(totalRequisitado[i.id]||0)+Number(i.quantidade||0)}));
  const acumulado={};
  inventarios.forEach(inv=>estatisticasDoInventario(inv).forEach(e=>{
    if(!acumulado[e.id])acumulado[e.id]={nome:e.nome,codigo:e.codigo,dosesAtivo:!!e.dosesAtivo,dosesPorGarrafa:Number(e.dosesPorGarrafa||0),precoDose:Number(e.precoDose||0),vendido:e.vendidoTeorico ?? e.vendido ?? 0,dosesVendidasTeoricas:e.dosesVendidasTeoricas||0,valorVendidoTeorico:e.valorVendidoTeorico||0,requisitadoTransferido:e.requisitadoTransferido||0,desvioAbsTotal:0,faltas:0,excessos:0,registos:0};
    acumulado[e.id].desvioAbsTotal+=e.desvioAbs;
    if(e.desvio<0)acumulado[e.id].faltas+=Math.abs(e.desvio);
    if(e.desvio>0)acumulado[e.id].excessos+=e.desvio;
    acumulado[e.id].vendido=e.vendidoTeorico ?? e.vendido ?? 0;
    acumulado[e.id].dosesAtivo=!!e.dosesAtivo;
    acumulado[e.id].dosesVendidasTeoricas=e.dosesVendidasTeoricas||0;
    acumulado[e.id].valorVendidoTeorico=e.valorVendidoTeorico||0;
    acumulado[e.id].requisitadoTransferido=totalRequisitado[e.id]||e.requisitadoTransferido||0;
    acumulado[e.id].registos++;
  }));
  const linhas=Object.values(acumulado).sort((a,b)=>b.desvioAbsTotal-a.desvioAbsTotal);
  const totalRequisicoes=Object.values(totalRequisitado).reduce((a,b)=>a+b,0);
  const totalVendidos=Object.values(acumulado).reduce((a,b)=>a+Number(b.vendido||0),0);
  const totalValorTeorico=Object.values(acumulado).reduce((a,b)=>a+Number(b.valorVendidoTeorico||0),0);
  const totalDesvios=linhas.reduce((a,e)=>a+e.desvioAbsTotal,0);
  let html=`<p><span class="badge green">Total vendido teórico: ${totalVendidos}</span> <span class="badge green">Valor teórico doses: ${formatoEuro(totalValorTeorico)}</span> <span class="badge">Requisições/transferências: ${totalRequisicoes}</span> <span class="badge ${totalDesvios?"red":"green"}">Desvios acumulados: ${totalDesvios}</span> <span class="badge">Registos: ${inventarios.length}</span></p>`;
  if(!linhas.length){html+='<p class="muted">Sem inventários registados.</p>'; div.innerHTML=html; return}
  html+=`<h3>Produtos com mais desvios</h3><div class="stock-table-wrap"><table class="stock-table"><thead><tr><th>Item</th><th>Vendido teórico</th><th>Doses teóricas</th><th>Valor teórico</th><th>Requisitado/transferido</th><th>Faltas</th><th>Excessos</th><th>Desvio acumulado</th></tr></thead><tbody>${linhas.slice(0,10).map(e=>`<tr><td><strong>${e.nome}</strong><br><span class="muted">${e.codigo||"-"}</span></td><td>${e.vendido}</td><td>${e.dosesAtivo ? (e.dosesVendidasTeoricas||0) : "—"}</td><td>${e.dosesAtivo ? formatoEuro(e.valorVendidoTeorico||0) : "—"}</td><td>${e.requisitadoTransferido||0}</td><td>${e.faltas}</td><td>${e.excessos}</td><td>${e.desvioAbsTotal}</td></tr>`).join("")}</tbody></table></div>`;
  div.innerHTML=html;
}


function linhasTemplate(operacao){
  if(operacao==="produtos") return [
    {nome:"Coca-Cola",codigo:"560000000001",stock:50,stock_minimo:12,doses_ativo:"não",doses_por_garrafa:0,preco_dose:0},
    {nome:"Água",codigo:"560000000002",stock:80,stock_minimo:20,doses_ativo:"não",doses_por_garrafa:0,preco_dose:0}
  ];
  if(operacao==="stock_local") return [
    {local:"BAR ILHA",produto:"Coca-Cola",codigo:"560000000001",quantidade:24},
    {local:"BAR LAGO",produto:"Água",codigo:"560000000002",quantidade:18}
  ];
  return [
    {dia:"Dia 1",local:"BAR ILHA",produto:"Coca-Cola",codigo:"560000000001",quantidade:12,nota:"Fecho do dia"},
    {dia:"Dia 1",local:"BAR LAGO",produto:"Água",codigo:"560000000002",quantidade:8,nota:"Fecho do dia"}
  ];
}

function dadosExportacao(operacao){
  if(operacao==="produtos") return catalogo.map(i=>({nome:i.nome,codigo:i.codigo||"",stock:Number(i.stock||0),stock_minimo:Number(i.stockMinimo||0),doses_ativo:i.dosesAtivo?"sim":"não",doses_por_garrafa:Number(i.dosesPorGarrafa||0),preco_dose:Number(i.precoDose||0)}));
  if(operacao==="stock_local"){
    const linhas=[];
    locais.forEach(local=>(local.itens||[]).forEach(item=>linhas.push({local:local.nome,produto:item.nome,codigo:item.codigo||"",quantidade:Number(item.stockBar||0)})));
    return linhas.length ? linhas : linhasTemplate("stock_local");
  }
  const dia=dias[dias.length-1];
  const linhas=[];
  locais.forEach(local=>(local.itens||[]).forEach(item=>linhas.push({dia:dia?dia.nome:"Dia 1",local:local.nome,produto:item.nome,codigo:item.codigo||"",quantidade:Number(item.stockBar||0),nota:""})));
  return linhas.length ? linhas : linhasTemplate("contagem_fim_dia");
}

function nomeDiaInventario(inv){
  const dia=dias.find(d=>Number(d.id)===Number(inv.diaId));
  return dia ? `${dia.nome}${dia.data ? " · "+dia.data : ""}` : "Evento completo";
}

function nomeLocalPorId(localId){
  const local=locais.find(l=>Number(l.id)===Number(localId));
  return local ? local.nome : (localId ? `Local ${localId}` : "");
}

function exportarInventariosLinhas(){
  const linhas=[];
  inventarios.forEach(inv=>{
    const stats=estatisticasDoInventario(inv);
    stats.forEach(e=>{
      linhas.push({
        inventario_id:inv.id,
        tipo:inv.tipo==="final_evento"?"Final do evento":(inv.localIdContagem?"Contagem recebida":"Fim do dia fechado"),
        estado:inv.localIdContagem?"Pendente":"Consolidado",
        dia:nomeDiaInventario(inv),
        local_contagem:inv.localIdContagem?nomeLocalPorId(inv.localIdContagem):"",
        data_hora:inv.criadoEm?new Date(inv.criadoEm).toLocaleString("pt-PT"):"",
        nota:inv.nota||"",
        produto:e.nome,
        codigo:e.codigo||"",
        armazem_geral:Number(e.stockCentral||0),
        stock_locais:Number(e.stockBarTotal||0),
        real_locais:Number(e.realLocais ?? e.real ?? 0),
        real_com_armazem:Number(e.realComArmazem ?? ((e.stockCentral||0)+(e.real||0))),
        vendido_teorico:Number(e.vendidoTeorico ?? e.vendido ?? 0),
        doses_ativo:e.dosesAtivo?"sim":"não",
        doses_por_garrafa:Number(e.dosesPorGarrafa||0),
        preco_dose:Number(e.precoDose||0),
        doses_teoricas:Number(e.dosesVendidasTeoricas||0),
        valor_teorico:Number(e.valorVendidoTeorico||0),
        diferenca:Number(e.desvio||0),
        diferenca_abs:Number(e.desvioAbs||0),
        requisitado_transferido:Number(e.requisitadoTransferido||0),
        resultado:e.estado||""
      });
    });
  });
  return linhas;
}

function exportarContagensRecebidasLinhas(){
  const linhas=[];
  inventarios.filter(inv=>inv.localIdContagem || inv.contagemLocalPendente).forEach(inv=>{
    const contagensLocais=inv.contagensLocais||{};
    Object.keys(contagensLocais).forEach(localId=>{
      const localNome=nomeLocalPorId(localId);
      const contagensLocal=contagensLocais[localId]||{};
      Object.keys(contagensLocal).forEach(itemId=>{
        const item=catalogo.find(i=>Number(i.id)===Number(itemId)) || {};
        linhas.push({
          inventario_id:inv.id,
          dia:nomeDiaInventario(inv),
          local:localNome,
          local_id:localId,
          produto:item.nome || `Produto ${itemId}`,
          codigo:item.codigo || "",
          quantidade_contada:Number(contagensLocal[itemId]||0),
          data_hora:inv.criadoEm?new Date(inv.criadoEm).toLocaleString("pt-PT"):"",
          nota:inv.nota||"",
          estado:"Recebida / pendente de fecho"
        });
      });
    });
  });
  return linhas;
}

function exportarInventarios(formato){
  const linhas=exportarInventariosLinhas();
  if(!linhas.length){alert("Ainda não existem inventários para exportar.");return}
  if(formato==="csv") downloadBlob("inventarios_export.csv", paraCSV(linhas), "text/csv;charset=utf-8");
  else downloadBlob("inventarios_export.xls", paraExcelHtml(linhas,"Inventários"), "application/vnd.ms-excel;charset=utf-8");
}

function exportarContagensRecebidas(formato){
  const linhas=exportarContagensRecebidasLinhas();
  if(!linhas.length){alert("Ainda não existem contagens recebidas para exportar.");return}
  if(formato==="csv") downloadBlob("contagens_recebidas_export.csv", paraCSV(linhas), "text/csv;charset=utf-8");
  else downloadBlob("contagens_recebidas_export.xls", paraExcelHtml(linhas,"Contagens recebidas"), "application/vnd.ms-excel;charset=utf-8");
}

function paraCSV(linhas){
  if(!linhas.length)return "";
  const headers=Object.keys(linhas[0]);
  const esc=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  return headers.join(",")+"\n"+linhas.map(r=>headers.map(h=>esc(r[h])).join(",")).join("\n");
}

function downloadBlob(nome,conteudo,tipo){
  const blob=new Blob([conteudo],{type:tipo});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},100);
}

function paraExcelHtml(linhas,titulo){
  if(!linhas.length)linhas=[{}];
  const headers=Object.keys(linhas[0]);
  const cell=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  return `<html><head><meta charset="utf-8"></head><body><table><caption>${cell(titulo)}</caption><thead><tr>${headers.map(h=>`<th>${cell(h)}</th>`).join("")}</tr></thead><tbody>${linhas.map(r=>`<tr>${headers.map(h=>`<td>${cell(r[h])}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
}

function operacaoAtualImportacao(){
  return document.getElementById("importOperacao")?.value || "produtos";
}

function nomeOperacao(operacao){
  if(operacao==="produtos")return "produtos";
  if(operacao==="stock_local")return "stock_por_local";
  return "contagem_fim_dia";
}

function downloadTemplate(formato){
  const op=operacaoAtualImportacao();
  const linhas=linhasTemplate(op);
  if(formato==="csv") downloadBlob(`template_${nomeOperacao(op)}.csv`, paraCSV(linhas), "text/csv;charset=utf-8");
  else downloadBlob(`template_${nomeOperacao(op)}.xls`, paraExcelHtml(linhas, `Template ${nomeOperacao(op)}`), "application/vnd.ms-excel;charset=utf-8");
}

function downloadTemplateContagem(formato){
  const linhas=linhasTemplate("contagem_fim_dia");
  if(formato==="csv") downloadBlob("template_contagem_fim_dia.csv", paraCSV(linhas), "text/csv;charset=utf-8");
  else downloadBlob("template_contagem_fim_dia.xls", paraExcelHtml(linhas,"Template contagem fim do dia"), "application/vnd.ms-excel;charset=utf-8");
}

function exportarDadosOperacao(formato){
  const op=operacaoAtualImportacao();
  const linhas=dadosExportacao(op);
  if(formato==="csv") downloadBlob(`export_${nomeOperacao(op)}.csv`, paraCSV(linhas), "text/csv;charset=utf-8");
  else downloadBlob(`export_${nomeOperacao(op)}.xls`, paraExcelHtml(linhas, `Export ${nomeOperacao(op)}`), "application/vnd.ms-excel;charset=utf-8");
}

function parseCSV(texto){
  const linhas=[]; let atual="", linha=[], aspas=false;
  for(let i=0;i<texto.length;i++){
    const c=texto[i], n=texto[i+1];
    if(c==='"' && aspas && n==='"'){atual+='"';i++;continue}
    if(c==='"'){aspas=!aspas;continue}
    if(c===',' && !aspas){linha.push(atual);atual="";continue}
    if((c==='\n'||c==='\r') && !aspas){
      if(c==='\r' && n==='\n')i++;
      linha.push(atual); atual="";
      if(linha.some(v=>String(v).trim()!==""))linhas.push(linha);
      linha=[]; continue;
    }
    atual+=c;
  }
  linha.push(atual); if(linha.some(v=>String(v).trim()!==""))linhas.push(linha);
  if(!linhas.length)return [];
  const headers=linhas.shift().map(h=>String(h||"").trim());
  return linhas.map(vals=>{const obj={};headers.forEach((h,i)=>obj[h]=vals[i]??"");return obj;});
}

function parseTabelaHtmlExcel(texto){
  const doc=new DOMParser().parseFromString(texto,"text/html");
  const rows=[...doc.querySelectorAll("tr")].map(tr=>[...tr.children].map(td=>td.textContent.trim())).filter(r=>r.length);
  if(!rows.length)return [];
  const headers=rows.shift();
  return rows.map(vals=>{const obj={};headers.forEach((h,i)=>obj[h]=vals[i]??"");return obj;});
}

function lerFicheiroTabela(file){
  return new Promise((resolve,reject)=>{
    const nome=(file.name||"").toLowerCase();
    if(nome.endsWith(".csv")){
      const r=new FileReader(); r.onload=()=>resolve(parseCSV(String(r.result||""))); r.onerror=reject; r.readAsText(file,"utf-8"); return;
    }
    if(nome.endsWith(".xls") && !nome.endsWith(".xlsx")){
      const r=new FileReader(); r.onload=()=>{
        const texto=String(r.result||"");
        if(texto.trim().startsWith("<")) resolve(parseTabelaHtmlExcel(texto));
        else if(window.XLSX) {
          const wb=XLSX.read(texto,{type:"binary"});
          const sh=wb.Sheets[wb.SheetNames[0]]; resolve(XLSX.utils.sheet_to_json(sh,{defval:""}));
        } else reject(new Error("Para importar Excel real, abre a app com internet ou usa CSV."));
      }; r.onerror=reject; r.readAsBinaryString(file); return;
    }
    if(nome.endsWith(".xlsx")){
      if(!window.XLSX){reject(new Error("Biblioteca Excel não carregada. Usa CSV ou o template .xls exportado pela app."));return}
      const r=new FileReader(); r.onload=()=>{
        const wb=XLSX.read(new Uint8Array(r.result),{type:"array"});
        const sh=wb.Sheets[wb.SheetNames[0]]; resolve(XLSX.utils.sheet_to_json(sh,{defval:""}));
      }; r.onerror=reject; r.readAsArrayBuffer(file); return;
    }
    reject(new Error("Formato não suportado. Usa CSV, XLS ou XLSX."));
  });
}

async function enviarImportacaoTabela(operacao,linhas,resultadoId){
  if(!linhas.length){alert("O ficheiro não tem linhas.");return}
  const r=await fetch(api("/importar-tabela"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({operacao,linhas})});
  const dados=await r.json().catch(()=>({}));
  if(!r.ok){alert(dados.erro||"Erro ao importar ficheiro.");return}
  const el=document.getElementById(resultadoId);
  if(el)el.innerText=`Importado: produtos ${dados.produtos||0}, stocks ${dados.stocks||0}, contagens ${dados.contagens||0}.`;
  if(eventoAtual) await entrarEvento(eventoAtual.id);
}

async function importarFicheiroTabela(){
  const file=document.getElementById("ficheiroImportacao")?.files?.[0];
  if(!file){alert("Escolhe um ficheiro CSV ou Excel.");return}
  try{ await enviarImportacaoTabela(operacaoAtualImportacao(), await lerFicheiroTabela(file), "resultadoImportacao"); }
  catch(e){alert(e.message||"Erro a ler ficheiro.")}
}

async function importarContagemPorFicheiro(){
  const file=document.getElementById("ficheiroContagemImportacao")?.files?.[0];
  if(!file){alert("Escolhe um ficheiro CSV ou Excel.");return}
  try{ await enviarImportacaoTabela("contagem_fim_dia", await lerFicheiroTabela(file), "resultadoImportacaoContagem"); }
  catch(e){alert(e.message||"Erro a ler ficheiro.")}
}

function atualizarPedidoEmTodasAsVistas(pedido){
  if(!pedido || !pedido.id)return;
  const pedidoId=Number(pedido.id);

  const idx=pedidos.findIndex(x=>Number(x.id)===pedidoId);
  if(idx>=0)pedidos[idx]=pedido;
  else pedidos.push(pedido);

  if(pedidoAtual && Number(pedidoAtual.id)===pedidoId){
    pedidoAtual=pedido;
    abrirPedido(pedidoId);
  }

  // Atualiza o último pedido do cliente mesmo que o estado seja alterado no operador.
  if(ultimoPedidoCliente && Number(ultimoPedidoCliente.id)===pedidoId){
    ultimoPedidoCliente=pedido;
    mostrarUltimoPedido();
  }

  // Atualiza o histórico local do cliente se este dispositivo tiver esse pedido guardado.
  atualizarPedidoNoHistorico(pedido);

  mostrarPedidos();
  mostrarDashboardOperacional();
  mostrarHistoricoCliente();
}

function atualizarListaPedidosEmTodasAsVistas(lista){
  pedidos=Array.isArray(lista) ? lista : [];

  if(pedidoAtual){
    const novo=pedidos.find(p=>Number(p.id)===Number(pedidoAtual.id));
    if(novo){pedidoAtual=novo;abrirPedido(Number(novo.id));}
  }

  if(ultimoPedidoCliente){
    const novo=pedidos.find(p=>Number(p.id)===Number(ultimoPedidoCliente.id));
    if(novo){
      ultimoPedidoCliente=novo;
      mostrarUltimoPedido();
      atualizarPedidoNoHistorico(novo);
    }
  }

  // Também sincroniza todos os pedidos guardados no histórico deste cliente/local.
  const hist=lerHistoricoCliente();
  let alterado=false;
  const novoHist=hist.map(h=>{
    const atualizado=pedidos.find(p=>Number(p.id)===Number(h.id));
    if(atualizado){alterado=true;return {...h,estado:atualizado.estado,itens:atualizado.itens||h.itens,atualizadoEm:new Date().toISOString()};}
    return h;
  });
  if(alterado)guardarHistoricoCliente(novoHist);

  mostrarPedidos();
  mostrarDashboardOperacional();
  mostrarUltimoPedido();
  mostrarHistoricoCliente();
}


function estadoNormalizadoPedido(estado){
  const e=String(estado || "").toLowerCase();
  if(e.includes("processamento")) return "processamento";
  if(e.includes("caminho")) return "caminho";
  if(e.includes("entregue")) return "entregue";
  return "aguardar";
}

function pedidoEntregueHoje(pedido){
  if(estadoNormalizadoPedido(pedido?.estado) !== "entregue") return false;
  const dataTxt=pedido.entregueEm || pedido.atualizadoEm || pedido.criadoEm;
  if(!dataTxt) return false;
  const d=new Date(dataTxt);
  const hoje=new Date();
  return d.getFullYear()===hoje.getFullYear() && d.getMonth()===hoje.getMonth() && d.getDate()===hoje.getDate();
}

function obterAlertasStockMinimo(){
  const alertas=[];
  catalogo.forEach(item=>{
    const minimo=Number(item.stockMinimo || 0);
    if(minimo<=0)return;
    const stockCentral=Number(item.stock || 0);
    if(stockCentral<minimo){
      alertas.push({tipo:"Armazém geral", nome:item.nome, codigo:item.codigo||"-", stock:stockCentral, minimo});
    }
    locaisAtivos().forEach(local=>{
      const itemLocal=(local.itens||[]).find(i=>Number(i.id)===Number(item.id));
      if(!itemLocal)return;
      const stockLocal=Number(itemLocal.stockBar || 0);
      if(stockLocal<minimo){
        alertas.push({tipo:local.nome, nome:item.nome, codigo:item.codigo||"-", stock:stockLocal, minimo});
      }
    });
  });
  return alertas;
}

function mostrarDashboardOperacional(){
  const kpis=document.getElementById("dashboardKPIs");
  const alertasDiv=document.getElementById("dashboardAlertasStock");
  const recentesDiv=document.getElementById("dashboardPedidosRecentes");
  const stocksDiv=document.getElementById("dashboardStocksPorBar");
  if(!kpis && !alertasDiv && !recentesDiv && !stocksDiv)return;

  const espera=pedidos.filter(p=>estadoNormalizadoPedido(p.estado)==="aguardar").length;
  const processamento=pedidos.filter(p=>estadoNormalizadoPedido(p.estado)==="processamento").length;
  const caminho=pedidos.filter(p=>estadoNormalizadoPedido(p.estado)==="caminho").length;
  const entreguesHoje=pedidos.filter(p=>pedidoEntregueHoje(p)).length;

  if(kpis){
    kpis.innerHTML=`
      <div class="dashboard-kpi wait"><h3>Pedidos em espera</h3><div class="num">${espera}</div></div>
      <div class="dashboard-kpi proc"><h3>Em processamento</h3><div class="num">${processamento}</div></div>
      <div class="dashboard-kpi way"><h3>A caminho</h3><div class="num">${caminho}</div></div>
      <div class="dashboard-kpi done"><h3>Entregues hoje</h3><div class="num">${entreguesHoje}</div></div>
    `;
  }

  if(alertasDiv){
    const alertas=obterAlertasStockMinimo();
    if(!alertas.length){
      alertasDiv.innerHTML='<p><span class="badge green">Sem alertas de stock mínimo.</span></p>';
    }else{
      alertasDiv.innerHTML=alertas.map(a=>`<div class="stock-row stock-alert-row"><div><strong>${escapeHtml(a.nome)}</strong><br><span class="muted">${escapeHtml(a.tipo)} · Código: ${escapeHtml(a.codigo)}</span></div><span class="badge red">${a.stock} / mín. ${a.minimo}</span></div>`).join("");
    }
  }

  if(recentesDiv){
    const recentes=pedidos.slice().reverse().slice(0,8);
    if(!recentes.length){
      recentesDiv.innerHTML='<p class="muted">Ainda não existem pedidos.</p>';
    }else{
      recentesDiv.innerHTML=recentes.map(p=>`<div class="pedido"><div><strong>${escapeHtml(p.codigo || "Pedido")}</strong><br><span class="badge ${classeEstado(p.estado)}">${escapeHtml(p.estado || "A aguardar")}</span> <span class="muted">${escapeHtml(p.local || "")}</span></div><button class="light" onclick="show('operador');abrirPedido(${Number(p.id)})">Abrir</button></div>`).join("");
    }
  }

  if(stocksDiv){
    stocksDiv.innerHTML=gerarTabelaStockBarOperador();
  }
}


function exportarBaseDadosCompleta(){
  window.location.href = "/base-dados/exportar";
}

async function criarBackupManual(){
  const div=document.getElementById("resultadoBaseDados");
  if(div)div.innerText="A criar backup...";
  const r=await fetch("/base-dados/backup",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({motivo:"manual"})
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok){if(div)div.innerText=d.erro||"Erro ao criar backup.";return}
  if(div)div.innerText=`Backup criado: ${d.backup?.ficheiro || "ok"}`;
  listarBackupsBaseDados();
}

async function listarBackupsBaseDados(){
  const div=document.getElementById("listaBackupsBaseDados");
  if(!div)return;
  const r=await fetch("/base-dados/backups");
  const lista=await r.json().catch(()=>[]);
  if(!Array.isArray(lista) || !lista.length){div.innerHTML='<p class="muted">Ainda sem backups.</p>';return}
  div.innerHTML='<h3>Últimos backups</h3>'+lista.slice(0,12).map(b=>`<div class="stock-row"><div><strong>${escapeHtml(b.nome)}</strong><br><span class="muted">${new Date(b.criadoEm).toLocaleString()} · ${(Number(b.tamanho||0)/1024).toFixed(1)} KB</span></div></div>`).join("");
}

async function importarBaseDadosCompleta(){
  const input=document.getElementById("ficheiroBaseDadosImportar");
  const div=document.getElementById("resultadoBaseDados");
  const file=input?.files?.[0];
  if(!file){alert("Escolhe o ficheiro eventos.json para importar.");return}
  if(!confirm("A importação vai substituir a base de dados atual. Antes será criado um backup automático. Continuar?"))return;
  const password=prompt("Password da Administração:");
  if(password===null)return;
  const texto=await file.text();
  let dados;
  try{dados=JSON.parse(texto);}catch(e){alert("Ficheiro JSON inválido.");return}
  if(div)div.innerText="A importar base de dados...";
  const r=await fetch("/base-dados/importar",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({password,dados})
  });
  const resp=await r.json().catch(()=>({}));
  if(!r.ok){if(div)div.innerText=resp.erro||"Erro ao importar base de dados.";return}
  if(div)div.innerText=`Base de dados importada. Eventos: ${resp.totalEventos}. Backup anterior: ${resp.backup?.ficheiro || "criado"}`;
  eventoAtual=null;
  catalogo=[];locais=[];pedidos=[];dias=[];inventarios=[];transferenciasLocais=[];
  const header=document.getElementById("mainHeader");
  if(header)header.style.display="none";
  show("eventos");
  listarBackupsBaseDados();
}

socket.on("connect",()=>{
  // Se a ligação cair e voltar, volta a entrar na sala do evento para receber atualizações.
  if(eventoAtual && eventoAtual.id)socket.emit("selecionarEvento", eventoAtual.id);
});

socket.on("eventosAtualizados",d=>{
  eventos=Array.isArray(d)?d:[];
  mostrarEventos();
  if(eventoAtual){
    const ev=eventos.find(e=>Number(e.id)===Number(eventoAtual.id));
    if(ev){
      eventoAtual=ev;
      const badge=document.getElementById("eventoAtualBadge");
      if(badge) badge.innerText=`Evento: ${eventoAtual.nome}${eventoAtual.data ? " · "+eventoAtual.data : ""}`;
    }
  }
});


socket.on("eventoRemovido", d=>{
  if(eventoAtual && d && Number(eventoAtual.id) === Number(d.id)){
    eventoAtual=null;
    catalogo=[]; locais=[]; pedidos=[]; dias=[]; inventarios=[]; transferenciasLocais=[]; carrinho=[]; pedidoAtual=null; ultimoPedidoCliente=null;
    const header=document.getElementById("mainHeader");
    if(header)header.style.display="none";
    show("eventos");
    alert("O evento aberto foi removido noutro dispositivo.");
  }
});

socket.on("catalogoAtualizado",d=>{catalogo=Array.isArray(d)?d:[];refreshTudo()});
socket.on("locaisAtualizados",d=>{locais=Array.isArray(d)?d:[];refreshTudo()});
socket.on("diasAtualizados",d=>{dias=Array.isArray(d)?d:[];mostrarDiasContagem();mostrarInventario()});
socket.on("inventariosAtualizados",async d=>{inventarios=Array.isArray(d)?d:[]; await carregarInventarios(); mostrarInventario()});
socket.on("transferenciasLocaisAtualizadas",d=>{transferenciasLocais=Array.isArray(d)?d:[];mostrarTransferenciasBD()});

socket.on("pedidosAtualizados",d=>{
  atualizarListaPedidosEmTodasAsVistas(d);
});

socket.on("novoPedido",p=>{
  atualizarPedidoEmTodasAsVistas(p);
  imprimirPedidoAutomatico(p);
});

socket.on("pedidoAtualizado",p=>{
  atualizarPedidoEmTodasAsVistas(p);
});

mostrarCarrinho();
