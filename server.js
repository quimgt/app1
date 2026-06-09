const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: "4mb" }));
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const DATA_FILE = path.join(__dirname, "eventos.json");
const BACKUP_DIR = path.join(__dirname, "backups");

const catalogoInicial = [];
const locaisIniciais = [];

let contadorEventos = 1;
let eventos = [];

function carregarEventos() {
  try {
    if (!fs.existsSync(DATA_FILE)) return false;
    const dados = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    eventos = Array.isArray(dados.eventos) ? dados.eventos : [];
    contadorEventos = Number(dados.contadorEventos || 1);
    return eventos.length > 0;
  } catch (err) {
    console.error("Erro ao carregar eventos.json:", err.message);
    return false;
  }
}

function guardarEventos() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ contadorEventos, eventos }, null, 2));
}

function nomeBackup(motivo = "manual") {
  const seguro = String(motivo || "manual").toLowerCase().replace(/[^a-z0-9_-]+/g, "_").slice(0, 40) || "manual";
  const data = new Date().toISOString().replace(/[:.]/g, "-");
  return `eventos_backup_${data}_${seguro}.json`;
}

function criarBackup(motivo = "manual") {
  if (!fs.existsSync(DATA_FILE)) return null;
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ficheiro = nomeBackup(motivo);
  const destino = path.join(BACKUP_DIR, ficheiro);
  fs.copyFileSync(DATA_FILE, destino);
  return { ficheiro, caminho: destino, criadoEm: new Date().toISOString(), motivo };
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function numero(v, padrao = 0) {
  if (v === undefined || v === null || v === "") return padrao;
  const n = Number(String(v).trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : padrao;
}

function booleano(v) {
  if (typeof v === "boolean") return v;
  const txt = String(v ?? "").trim().toLowerCase();
  return ["1", "true", "sim", "s", "yes", "y", "ativo", "on"].includes(txt);
}

function criarBaseEvento(nome, data) {
  return {
    id: contadorEventos++,
    nome: String(nome || "Novo evento").trim(),
    data: String(data || "").trim(),
    criadoEm: new Date().toISOString(),
    catalogo: [],
    locais: [],
    pedidos: [],
    dias: [],
    inventarios: [],
    consultasStock: [],
    transferenciasLocais: [],
    contadorPedidos: 1,
    contadorCatalogo: 1,
    contadorLocais: 1,
    contadorDias: 1,
    contadorInventarios: 1,
    contadorConsultasStock: 1
  };
}


if (!carregarEventos()) {
  eventos = [];
  guardarEventos();
}

function normalizarEvento(evento) {
  evento.catalogo = Array.isArray(evento.catalogo) ? evento.catalogo : [];
  evento.locais = Array.isArray(evento.locais) ? evento.locais : [];
  evento.pedidos = Array.isArray(evento.pedidos) ? evento.pedidos : [];
  evento.dias = Array.isArray(evento.dias) ? evento.dias : [];
  evento.inventarios = Array.isArray(evento.inventarios) ? evento.inventarios : [];
  evento.consultasStock = Array.isArray(evento.consultasStock) ? evento.consultasStock : [];
  evento.transferenciasLocais = Array.isArray(evento.transferenciasLocais) ? evento.transferenciasLocais : [];
  evento.contadorTransferenciasLocais = Number(evento.contadorTransferenciasLocais || (Math.max(0, ...evento.transferenciasLocais.map(t => Number(t.id) || 0)) + 1));
  evento.contadorDias = Number(evento.contadorDias || (Math.max(0, ...evento.dias.map(d => Number(d.id) || 0)) + 1));
  evento.contadorInventarios = Number(evento.contadorInventarios || (Math.max(0, ...evento.inventarios.map(i => Number(i.id) || 0)) + 1));
  evento.contadorConsultasStock = Number(evento.contadorConsultasStock || (Math.max(0, ...evento.consultasStock.map(c => Number(c.id) || 0)) + 1));
  evento.contadorPedidos = Number(evento.contadorPedidos || (Math.max(0, ...evento.pedidos.map(p => Number(p.id) || 0)) + 1));
  evento.contadorCatalogo = Number(evento.contadorCatalogo || (Math.max(0, ...evento.catalogo.map(i => Number(i.id) || 0)) + 1));
  evento.contadorLocais = Number(evento.contadorLocais || (Math.max(0, ...evento.locais.map(l => Number(l.id) || 0)) + 1));
  evento.catalogo.forEach(item => {
    item.stockMinimo = Math.max(0, numero(item.stockMinimo ?? item.stock_minimo ?? item.minimo ?? 0));
    item.dosesAtivo = booleano(item.dosesAtivo ?? item.dosesAtivas ?? item.ativarDoses ?? item.doses_ativo ?? false);
    item.dosesPorGarrafa = Math.max(0, numero(item.dosesPorGarrafa ?? item.doses_por_garrafa ?? item.doses ?? 0));
    item.precoDose = Math.max(0, numero(item.precoDose ?? item.preco_dose ?? item.preco ?? 0));
  });
  evento.locais.forEach(local => {
    if (local.ativo === undefined && local.inativo === undefined) local.ativo = true;
    if (local.inativo !== undefined) local.ativo = !booleano(local.inativo);
    local.ativo = local.ativo !== false;
  });
  return evento;
}

eventos.forEach(normalizarEvento);


function localTemHistoricoOuAssociacoes(evento, localId) {
  const id = Number(localId);
  const local = evento.locais.find(l => Number(l.id) === id);
  if (!local) return true;

  if (Array.isArray(local.itemIds) && local.itemIds.length > 0) return true;
  if (local.stockBar && Object.values(local.stockBar).some(v => Number(v || 0) > 0)) return true;

  if ((evento.pedidos || []).some(p => Number(p.localId) === id)) return true;
  if ((evento.transferenciasLocais || []).some(t => Number(t.localId) === id)) return true;
  if ((evento.inventarios || []).some(inv => {
    if (Number(inv.localIdContagem || 0) === id) return true;
    const cl = inv.contagensLocais || {};
    if (cl[id] || cl[String(id)]) return true;
    return false;
  })) return true;

  return false;
}

function resumoEvento(evento) {
  normalizarEvento(evento);
  return {
    id: evento.id,
    nome: evento.nome,
    data: evento.data,
    criadoEm: evento.criadoEm,
    totalItens: evento.catalogo.length,
    totalLocais: evento.locais.length,
    totalPedidos: evento.pedidos.length,
    totalDias: evento.dias.length,
    totalInventarios: evento.inventarios.length
  };
}

function eventoDoPedido(req, res) {
  const id = Number(req.query.eventoId || req.body.eventoId || req.headers["x-evento-id"] || eventos[0]?.id);
  const evento = eventos.find(e => e.id === id);
  if (!evento) {
    res.status(404).json({ erro: "Evento não encontrado." });
    return null;
  }
  return evento;
}

function getItem(evento, id) {
  return evento.catalogo.find(i => i.id === Number(id));
}

function enriquecerLocal(evento, local) {
  return {
    ...local,
    itens: local.itemIds
      .map(id => getItem(evento, id))
      .filter(Boolean)
      .map(item => ({
        id: item.id,
        nome: item.nome,
        codigo: item.codigo || "",
        stock: Number(item.stock || 0),
        stockBar: Number((local.stockBar || {})[item.id] || 0),
        semStock: Number(item.stock || 0) <= 0
      }))
  };
}

function emitirTudo(evento) {
  normalizarEvento(evento);
  guardarEventos();
  const sala = `evento-${evento.id}`;
  io.to(sala).emit("catalogoAtualizado", evento.catalogo);
  io.to(sala).emit("locaisAtualizados", evento.locais.map(l => enriquecerLocal(evento, l)));
  io.to(sala).emit("pedidosAtualizados", evento.pedidos);
  io.to(sala).emit("diasAtualizados", evento.dias);
  io.to(sala).emit("inventariosAtualizados", evento.inventarios);
  io.to(sala).emit("consultasStockAtualizadas", evento.consultasStock || []);
  io.to(sala).emit("transferenciasLocaisAtualizadas", evento.transferenciasLocais || []);
  io.emit("eventosAtualizados", eventos.map(resumoEvento));
}

function snapshotSistema(evento) {
  return evento.catalogo.map(item => {
    const porBar = {};
    evento.locais.forEach(local => {
      porBar[local.id] = Number((local.stockBar || {})[item.id] || 0);
    });
    return {
      id: item.id,
      nome: item.nome,
      codigo: item.codigo || "",
      dosesAtivo: !!item.dosesAtivo,
      dosesPorGarrafa: Math.max(0, numero(item.dosesPorGarrafa || 0)),
      precoDose: Math.max(0, numero(item.precoDose || 0)),
      stockCentral: Number(item.stock || 0),
      stockBarTotal: Object.values(porBar).reduce((a,b)=>a+Number(b||0),0),
      porBar
    };
  });
}


function transportarStockFimDiaParaLocais(evento, contagensLocais) {
  let alteracoes = 0;

  evento.locais.forEach(local => {
    if (!local.stockBar) local.stockBar = {};

    const contagensDoLocal = contagensLocais && typeof contagensLocais === "object"
      ? contagensLocais[local.id] || contagensLocais[String(local.id)] || {}
      : {};

    local.itemIds.forEach(itemId => {
      if (contagensDoLocal[itemId] === undefined && contagensDoLocal[String(itemId)] === undefined) return;

      const novoStock = Math.max(0, Number(contagensDoLocal[itemId] ?? contagensDoLocal[String(itemId)]) || 0);
      if (Number(local.stockBar[itemId] || 0) !== novoStock) alteracoes++;
      local.stockBar[itemId] = novoStock;
    });
  });

  return alteracoes;
}

function calcularEstatisticasInventario(evento, inventario) {
  const contagens = inventario.contagens || {};
  const contagensLocais = inventario.contagensLocais || {};
  const snapshot = Array.isArray(inventario.snapshot) && inventario.snapshot.length ? inventario.snapshot : snapshotSistema(evento);

  return snapshot.map(item => {
    const itemCatalogoAtual = getItem(evento, item.id) || {};
    const metaDoses = {
      dosesAtivo: booleano(item.dosesAtivo ?? itemCatalogoAtual.dosesAtivo ?? false),
      dosesPorGarrafa: Math.max(0, numero(item.dosesPorGarrafa ?? itemCatalogoAtual.dosesPorGarrafa ?? 0)),
      precoDose: Math.max(0, numero(item.precoDose ?? itemCatalogoAtual.precoDose ?? 0))
    };
    const stockCentral = Number(item.stockCentral || 0);
    const filtroLocalId = Number(inventario.localIdContagem || 0);
    const stockBarTotal = filtroLocalId ? Number((item.porBar || {})[filtroLocalId] || (item.porBar || {})[String(filtroLocalId)] || 0) : Number(item.stockBarTotal || 0);
    const sistema = stockCentral + stockBarTotal;
    const realLocais = Math.max(0, Number(contagens[item.id]) || 0);
    const realComArmazem = stockCentral + realLocais;
    const desvioLocais = realLocais - stockBarTotal;
    const desvio = realComArmazem - sistema;
    const desvioAbs = Math.abs(desvio);
    const desvioPercent = sistema > 0 ? Number(((desvioAbs / sistema) * 100).toFixed(2)) : (realComArmazem > 0 ? 100 : 0);
    const requisitadoTransferido = evento.pedidos.reduce((total, pedido) => {
      return total + (pedido.itens || []).filter(i => Number(i.id) === Number(item.id)).reduce((s,i)=>s+Number(i.quantidade||0),0);
    }, 0);
    // Pedidos/requisições são transferências internas do armazém para o local.
    // Não são vendas. O vendido teórico nasce apenas da diferença do stock do local.
    const vendidoTeorico = Math.max(0, stockBarTotal - realLocais);
    const dosesAtivo = metaDoses.dosesAtivo;
    const dosesPorGarrafa = metaDoses.dosesPorGarrafa;
    const precoDose = metaDoses.precoDose;
    const dosesVendidasTeoricas = dosesAtivo ? Number((vendidoTeorico * dosesPorGarrafa).toFixed(2)) : 0;
    const valorVendidoTeorico = dosesAtivo ? Number((dosesVendidasTeoricas * precoDose).toFixed(2)) : 0;
    const vendidoPOS = 0;

    const locaisParaEstatistica = filtroLocalId ? evento.locais.filter(local => Number(local.id) === filtroLocalId) : evento.locais;
    const locais = locaisParaEstatistica.map(local => {
      const stockLocal = Number((item.porBar || {})[local.id] || (item.porBar || {})[String(local.id)] || 0);
      const realLocal = Math.max(0, Number((contagensLocais[local.id] || contagensLocais[String(local.id)] || {})[item.id] ?? (contagensLocais[local.id] || contagensLocais[String(local.id)] || {})[String(item.id)] ?? 0));
      const desvioLocal = realLocal - stockLocal;
      const vendidoTeoricoLocal = Math.max(0, stockLocal - realLocal);
      const dosesVendidasTeoricasLocal = dosesAtivo ? Number((vendidoTeoricoLocal * dosesPorGarrafa).toFixed(2)) : 0;
      const valorVendidoTeoricoLocal = dosesAtivo ? Number((dosesVendidasTeoricasLocal * precoDose).toFixed(2)) : 0;
      return {
        localId: local.id,
        localNome: local.nome,
        stockLocal,
        realLocal,
        vendidoTeoricoLocal,
        dosesVendidasTeoricasLocal,
        valorVendidoTeoricoLocal,
        desvioLocal,
        estado: desvioLocal === 0 ? "OK" : (desvioLocal < 0 ? "Vendido/saída" : "Excesso")
      };
    }).filter(l => l.stockLocal > 0 || l.realLocal > 0);

    return {
      id: item.id, nome: item.nome, codigo: item.codigo,
      dosesAtivo, dosesPorGarrafa, precoDose,
      dosesVendidasTeoricas, valorVendidoTeorico,
      stockCentral, stockBarTotal, sistema,
      real: realLocais,
      realLocais,
      realComArmazem,
      desvio,
      desvioLocais,
      desvioAbs, desvioPercent,
      vendido: vendidoTeorico,
      vendidoPOS,
      requisitadoTransferido,
      vendidoTeorico,
      locais,
      estado: desvio === 0 ? "OK" : (desvio < 0 ? "Vendido/saída" : "Excesso")
    };
  });
}


app.get("/base-dados/exportar", (req, res) => {
  if (!fs.existsSync(DATA_FILE)) guardarEventos();
  res.download(DATA_FILE, "eventos.json");
});

app.get("/base-dados/backups", (req, res) => {
  if (!fs.existsSync(BACKUP_DIR)) return res.json([]);
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(nome => nome.endsWith(".json"))
    .map(nome => {
      const stat = fs.statSync(path.join(BACKUP_DIR, nome));
      return { nome, tamanho: stat.size, criadoEm: stat.mtime.toISOString() };
    })
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
  res.json(backups);
});

app.post("/base-dados/backup", (req, res) => {
  try {
    const backup = criarBackup(req.body?.motivo || "manual");
    if (!backup) return res.status(404).json({ erro: "Ficheiro eventos.json não encontrado." });
    res.json({ ok: true, backup });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao criar backup: " + err.message });
  }
});

app.post("/base-dados/importar", (req, res) => {
  try {
    const password = String(req.body.password || "");
    const adminPassword = String(process.env.ADMIN_PASSWORD || "1234");
    if (password !== adminPassword) return res.status(403).json({ erro: "Password incorreta." });

    const dados = req.body.dados;
    if (!dados || !Array.isArray(dados.eventos)) return res.status(400).json({ erro: "Ficheiro inválido. Tem de conter a propriedade eventos[]." });

    const backup = criarBackup("antes_importar_base_dados");
    eventos = dados.eventos;
    contadorEventos = Number(dados.contadorEventos || (Math.max(0, ...eventos.map(e => Number(e.id) || 0)) + 1));
    eventos.forEach(normalizarEvento);
    guardarEventos();
    io.emit("eventosAtualizados", eventos.map(resumoEvento));
    res.json({ ok: true, backup, totalEventos: eventos.length });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao importar base de dados: " + err.message });
  }
});

app.get("/eventos", (req, res) => res.json(eventos.map(resumoEvento)));

app.post("/eventos", (req, res) => {
  const nome = String(req.body.nome || "").trim();
  const data = String(req.body.data || "").trim();
  if (!nome) return res.status(400).json({ erro: "Nome do evento é obrigatório." });

  const evento = normalizarEvento(criarBaseEvento(nome, data));
  const diasRecebidos = Array.isArray(req.body.dias) ? req.body.dias : [];
  diasRecebidos.forEach((diaRecebido, index) => {
    const nomeDia = String((diaRecebido && diaRecebido.nome) || `Dia ${index + 1}`).trim();
    const dataDia = String((diaRecebido && diaRecebido.data) || "").trim();
    if (!nomeDia) return;
    evento.dias.push({
      id: evento.contadorDias++,
      nome: nomeDia,
      data: dataDia,
      criadoEm: new Date().toISOString()
    });
  });
  eventos.push(evento);
  guardarEventos();
  io.emit("eventosAtualizados", eventos.map(resumoEvento));
  res.status(201).json(resumoEvento(evento));
});

app.delete("/eventos/:id", (req, res) => {
  const id = Number(req.params.id);
  const password = String(req.body.password || "");
  const adminPassword = String(process.env.ADMIN_PASSWORD || "1234");

  if (password !== adminPassword) {
    return res.status(403).json({ erro: "Password incorreta." });
  }

  const existe = eventos.some(e => Number(e.id) === id);
  if (!existe) return res.status(404).json({ erro: "Evento não encontrado." });

  const backup = criarBackup("antes_remover_evento");
  eventos = eventos.filter(e => Number(e.id) !== id);
  guardarEventos();
  io.emit("eventosAtualizados", eventos.map(resumoEvento));
  io.emit("eventoRemovido", { id });
  res.json({ ok: true, backup, eventos: eventos.map(resumoEvento) });
});

app.get("/evento-atual", (req, res) => {
  const evento = eventoDoPedido(req, res);
  if (!evento) return;
  normalizarEvento(evento);
  res.json({
    evento: resumoEvento(evento),
    catalogo: evento.catalogo,
    locais: evento.locais.map(l => enriquecerLocal(evento, l)),
    pedidos: evento.pedidos,
    dias: evento.dias,
    inventarios: evento.inventarios,
    consultasStock: evento.consultasStock || [],
    transferenciasLocais: evento.transferenciasLocais || []
  });
});

app.get("/dias", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  normalizarEvento(evento);
  res.json(evento.dias);
});

app.post("/dias", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  normalizarEvento(evento);
  const nome = String(req.body.nome || "").trim();
  const data = String(req.body.data || "").trim();
  if (!nome) return res.status(400).json({ erro: "Nome do dia é obrigatório." });
  const dia = { id: evento.contadorDias++, nome, data, criadoEm: new Date().toISOString() };
  evento.dias.push(dia);
  emitirTudo(evento);
  res.status(201).json(dia);
});


app.get("/consultas-stock", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  normalizarEvento(evento);
  res.json(evento.consultasStock || []);
});

app.post("/consultas-stock", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  normalizarEvento(evento);
  const local = evento.locais.find(l => Number(l.id) === Number(req.body.localId));
  if (!local) return res.status(404).json({ erro: "Local não encontrado." });
  if (local.ativo === false) return res.status(403).json({ erro: "Este local está inativo e não pode enviar contagens." });
  if (String(req.body.password || "") !== String(local.password || "")) return res.status(403).json({ erro: "Password do local inválida." });

  const contagens = {};
  const recebidas = req.body.contagens && typeof req.body.contagens === "object" ? req.body.contagens : {};
  local.itemIds.forEach(itemId => {
    const item = getItem(evento, itemId);
    if (!item) return;
    contagens[item.id] = Math.max(0, Number(recebidas[item.id] ?? recebidas[String(item.id)] ?? 0) || 0);
  });

  const consulta = {
    id: evento.contadorConsultasStock++,
    localId: local.id,
    localNome: local.nome,
    nota: String(req.body.nota || "").trim(),
    contagens,
    snapshot: snapshotSistema(evento),
    criadoEm: new Date().toISOString()
  };
  evento.consultasStock.unshift(consulta);
  emitirTudo(evento);
  res.status(201).json(consulta);
});

app.delete("/consultas-stock/:id", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  normalizarEvento(evento);
  const id = Number(req.params.id);
  evento.consultasStock = (evento.consultasStock || []).filter(c => Number(c.id) !== id);
  emitirTudo(evento);
  res.json({ ok: true });
});

app.get("/inventarios", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  normalizarEvento(evento);
  res.json(evento.inventarios.map(inv => ({ ...inv, estatisticas: calcularEstatisticasInventario(evento, inv) })));
});

app.post("/inventarios", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  normalizarEvento(evento);
  const tipo = req.body.tipo === "final_evento" ? "final_evento" : "fim_dia";
  const diaId = req.body.diaId ? Number(req.body.diaId) : null;
  if (tipo === "fim_dia" && !evento.dias.some(d => Number(d.id) === diaId)) return res.status(400).json({ erro: "Escolhe um dia válido." });
  if (req.body.localIdContagem) {
    const localContagem = evento.locais.find(l => Number(l.id) === Number(req.body.localIdContagem));
    if (localContagem && localContagem.ativo === false) return res.status(403).json({ erro: "Este local está inativo e não pode enviar contagens." });
  }
  const contagens = {};
  const recebidas = req.body.contagens || {};
  evento.catalogo.forEach(item => { contagens[item.id] = Math.max(0, Number(recebidas[item.id]) || 0); });
  const contagensLocais = req.body.contagensLocais && typeof req.body.contagensLocais === "object" ? req.body.contagensLocais : {};
  const inventario = {
    id: evento.contadorInventarios++,
    tipo, diaId,
    nota: String(req.body.nota || "").trim(),
    localIdContagem: req.body.localIdContagem ? Number(req.body.localIdContagem) : null,
    contagens,
    contagensLocais,
    snapshot: snapshotSistema(evento),
    criadoEm: new Date().toISOString()
  };
  evento.inventarios.push(inventario);

  if (tipo === "fim_dia" && !inventario.localIdContagem) {
    // Só o fecho consolidado do operador transporta stock para o dia seguinte.
    // Contagens enviadas por cada local ficam pendentes até ao operador fechar o dia.
    criarBackup("antes_fechar_dia");
    const alteracoesTransportadas = transportarStockFimDiaParaLocais(evento, contagensLocais);
    inventario.transportadoParaDiaSeguinte = true;
    inventario.alteracoesTransportadas = alteracoesTransportadas;
  } else if (tipo === "fim_dia" && inventario.localIdContagem) {
    inventario.contagemLocalPendente = true;
    inventario.transportadoParaDiaSeguinte = false;
    inventario.alteracoesTransportadas = 0;
  }

  emitirTudo(evento);
  res.status(201).json({ ...inventario, estatisticas: calcularEstatisticasInventario(evento, inventario) });
});

app.delete("/inventarios/:id", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  normalizarEvento(evento);
  const id = Number(req.params.id);
  evento.inventarios = evento.inventarios.filter(i => Number(i.id) !== id);
  emitirTudo(evento);
  res.json({ ok: true });
});

app.get("/inventarios/resumo", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  normalizarEvento(evento);
  const inventarios = evento.inventarios.map(inv => ({ ...inv, estatisticas: calcularEstatisticasInventario(evento, inv) }));
  const porItem = {};
  inventarios.forEach(inv => inv.estatisticas.forEach(e => {
    if (!porItem[e.id]) porItem[e.id] = { id:e.id, nome:e.nome, codigo:e.codigo, vendido:0, requisitadoTransferido:0, desvioAbsTotal:0, faltas:0, excessos:0, registos:0 };
    porItem[e.id].vendido = e.vendidoTeorico ?? e.vendido ?? 0;
    porItem[e.id].requisitadoTransferido = e.requisitadoTransferido || 0;
    porItem[e.id].desvioAbsTotal += e.desvioAbs;
    if (e.desvio < 0) porItem[e.id].faltas += Math.abs(e.desvio);
    if (e.desvio > 0) porItem[e.id].excessos += e.desvio;
    porItem[e.id].registos += 1;
  }));
  const linhas = Object.values(porItem).sort((a,b)=>b.desvioAbsTotal-a.desvioAbsTotal);
  res.json({ totalInventarios: inventarios.length, totalDias: evento.dias.length, produtosComMaisDesvios: linhas.slice(0,10), linhas });
});

app.get("/catalogo", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  res.json(evento.catalogo);
});

app.post("/catalogo", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  const nome = String(req.body.nome || "").trim();
  const codigo = String(req.body.codigo || "").trim();
  const stock = Math.max(0, Number(req.body.stock) || 0);
  const stockMinimo = Math.max(0, numero(req.body.stockMinimo ?? req.body.stock_minimo ?? req.body.minimo ?? 0));
  const dosesAtivo = booleano(req.body.dosesAtivo ?? req.body.dosesAtivas ?? req.body.ativarDoses ?? req.body.doses_ativo ?? false);
  const dosesPorGarrafa = Math.max(0, numero(req.body.dosesPorGarrafa ?? req.body.doses_por_garrafa ?? req.body.doses ?? 0));
  const precoDose = Math.max(0, numero(req.body.precoDose ?? req.body.preco_dose ?? req.body.preco ?? 0));

  if (!nome) return res.status(400).json({ erro: "Nome do item é obrigatório." });

  const item = { id: evento.contadorCatalogo++, nome, codigo, stock, stockMinimo, dosesAtivo, dosesPorGarrafa, precoDose };
  evento.catalogo.push(item);
  emitirTudo(evento);
  res.status(201).json(item);
});

app.patch("/catalogo/:id", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  const item = getItem(evento, req.params.id);
  if (!item) return res.status(404).json({ erro: "Item não encontrado." });

  const nome = String(req.body.nome || "").trim();
  const codigo = String(req.body.codigo || "").trim();
  if (!nome) return res.status(400).json({ erro: "Nome do item é obrigatório." });

  item.nome = nome;
  item.codigo = codigo;
  if (req.body.stock !== undefined) item.stock = Math.max(0, Number(req.body.stock) || 0);
  if (req.body.stockMinimo !== undefined || req.body.stock_minimo !== undefined || req.body.minimo !== undefined) item.stockMinimo = Math.max(0, numero(req.body.stockMinimo ?? req.body.stock_minimo ?? req.body.minimo));
  if (req.body.dosesAtivo !== undefined || req.body.dosesAtivas !== undefined || req.body.ativarDoses !== undefined || req.body.doses_ativo !== undefined) item.dosesAtivo = booleano(req.body.dosesAtivo ?? req.body.dosesAtivas ?? req.body.ativarDoses ?? req.body.doses_ativo);
  if (req.body.dosesPorGarrafa !== undefined || req.body.doses_por_garrafa !== undefined || req.body.doses !== undefined) item.dosesPorGarrafa = Math.max(0, numero(req.body.dosesPorGarrafa ?? req.body.doses_por_garrafa ?? req.body.doses));
  if (req.body.precoDose !== undefined || req.body.preco_dose !== undefined || req.body.preco !== undefined) item.precoDose = Math.max(0, numero(req.body.precoDose ?? req.body.preco_dose ?? req.body.preco));

  evento.pedidos.forEach(pedido => {
    (pedido.itens || []).forEach(itemPedido => {
      if (Number(itemPedido.id) === Number(item.id)) {
        itemPedido.nome = item.nome;
        itemPedido.codigo = item.codigo || "";
      }
    });
  });

  emitirTudo(evento);
  res.json(item);
});

app.patch("/catalogo/:id/stock", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  const item = getItem(evento, req.params.id);
  if (!item) return res.status(404).json({ erro: "Item não encontrado." });
  item.stock = Math.max(0, Number(req.body.stock) || 0);
  emitirTudo(evento);
  res.json(item);
});


app.post("/transferencias/local", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  const item = getItem(evento, req.body.itemId);
  const local = evento.locais.find(l => Number(l.id) === Number(req.body.localId));
  const quantidade = Math.max(0, Number(req.body.quantidade) || 0);

  if (!item) return res.status(404).json({ erro: "Item não encontrado." });
  if (!local) return res.status(404).json({ erro: "Local não encontrado." });
  if (local.ativo === false) return res.status(400).json({ erro: "Local inativo. Reativa o local antes de transferir itens." });
  if (quantidade <= 0) return res.status(400).json({ erro: "Quantidade inválida." });
  if (quantidade > Number(item.stock || 0)) return res.status(400).json({ erro: "Stock central insuficiente." });

  item.stock = Number(item.stock || 0) - quantidade;
  if (!local.itemIds.includes(item.id)) local.itemIds.push(item.id);
  if (!local.stockBar) local.stockBar = {};
  local.stockBar[item.id] = Number(local.stockBar[item.id] || 0) + quantidade;

  const transferencia = {
    id: evento.contadorTransferenciasLocais++,
    itemId: item.id,
    itemNome: item.nome,
    localId: local.id,
    localNome: local.nome,
    quantidade,
    criadoEm: new Date().toISOString(),
    anulada: false,
    anuladaEm: null
  };
  evento.transferenciasLocais.unshift(transferencia);

  emitirTudo(evento);
  res.json({ ok: true, item, local: enriquecerLocal(evento, local), transferencia });
});

app.post("/transferencias/local/:id/undo", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  normalizarEvento(evento);
  const transferencia = evento.transferenciasLocais.find(t => Number(t.id) === Number(req.params.id));
  if (!transferencia) return res.status(404).json({ erro: "Transferência não encontrada." });
  if (transferencia.anulada) return res.status(400).json({ erro: "Esta transferência já foi anulada." });

  const item = getItem(evento, transferencia.itemId);
  const local = evento.locais.find(l => Number(l.id) === Number(transferencia.localId));
  const quantidade = Math.max(0, Number(transferencia.quantidade) || 0);

  if (!item) return res.status(404).json({ erro: "Item da transferência não encontrado." });
  if (!local) return res.status(404).json({ erro: "Local da transferência não encontrado." });
  if (!local.stockBar) local.stockBar = {};

  const stockLocalAtual = Number(local.stockBar[item.id] || 0);
  if (stockLocalAtual < quantidade) {
    return res.status(400).json({ erro: "Não é possível anular: o local já não tem stock suficiente deste item." });
  }

  local.stockBar[item.id] = stockLocalAtual - quantidade;
  item.stock = Number(item.stock || 0) + quantidade;
  transferencia.anulada = true;
  transferencia.anuladaEm = new Date().toISOString();

  emitirTudo(evento);
  res.json({ ok: true, transferencia, item, local: enriquecerLocal(evento, local) });
});


app.patch("/locais/:localId/stock/:itemId", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  const local = evento.locais.find(l => Number(l.id) === Number(req.params.localId));
  const item = getItem(evento, req.params.itemId);
  const stock = Math.max(0, Number(req.body.stock) || 0);

  if (!local) return res.status(404).json({ erro: "Local não encontrado." });
  if (!item) return res.status(404).json({ erro: "Item não encontrado." });

  if (!local.stockBar) local.stockBar = {};
  if (!local.itemIds.includes(item.id)) local.itemIds.push(item.id);
  local.stockBar[item.id] = stock;

  emitirTudo(evento);
  res.json({ ok: true, local: enriquecerLocal(evento, local), item });
});

app.delete("/catalogo/:id", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  const id = Number(req.params.id);
  if (!evento.catalogo.some(i => i.id === id)) return res.status(404).json({ erro: "Item não encontrado." });

  evento.catalogo = evento.catalogo.filter(i => i.id !== id);
  evento.locais.forEach(local => {
    local.itemIds = local.itemIds.filter(itemId => itemId !== id);
    if (!local.stockBar) local.stockBar = {};
    delete local.stockBar[id];
  });
  emitirTudo(evento);
  res.json({ ok: true });
});

app.get("/locais", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  res.json(evento.locais.map(l => enriquecerLocal(evento, l)));
});

app.post("/locais", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  const nome = String(req.body.nome || "").trim().toUpperCase();
  if (!nome) return res.status(400).json({ erro: "Nome do local é obrigatório." });
  if (evento.locais.find(l => l.nome.toUpperCase() === nome)) return res.status(400).json({ erro: "Esse local já existe neste evento." });

  const local = { id: evento.contadorLocais++, nome, password: String(req.body.password || "1234"), ativo: true, itemIds: [], stockBar: {} };
  evento.locais.push(local);
  emitirTudo(evento);
  res.status(201).json(enriquecerLocal(evento, local));
});

app.patch("/locais/:id/password", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  const local = evento.locais.find(l => l.id == req.params.id);
  if (!local) return res.status(404).json({ erro: "Local não encontrado." });
  local.password = String(req.body.password || "").trim();
  if (!local.password) return res.status(400).json({ erro: "Password é obrigatória." });
  emitirTudo(evento);
  res.json(enriquecerLocal(evento, local));
});

app.post("/locais/:id/validar-password", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  const local = evento.locais.find(l => l.id == req.params.id);
  if (!local) return res.status(404).json({ erro: "Local não encontrado." });
  if (local.ativo === false) return res.json({ ok: false, erro: "Local inativo." });
  res.json({ ok: String(req.body.password || "") === String(local.password || "") });
});

app.patch("/locais/:id/ativo", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  normalizarEvento(evento);
  const local = evento.locais.find(l => l.id == req.params.id);
  if (!local) return res.status(404).json({ erro: "Local não encontrado." });
  const password = String(req.body.password || "");
  if (password !== "1234") return res.status(403).json({ erro: "Password incorreta." });
  local.ativo = req.body.ativo !== false;
  local.inativo = !local.ativo;
  emitirTudo(evento);
  res.json(enriquecerLocal(evento, local));
});


app.delete("/locais/:id", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  normalizarEvento(evento);
  const id = Number(req.params.id);
  const local = evento.locais.find(l => Number(l.id) === id);
  if (!local) return res.status(404).json({ erro: "Local não encontrado." });

  const password = String(req.body.password || req.query.password || "");
  if (password !== "1234") return res.status(403).json({ erro: "Password incorreta." });

  if (localTemHistoricoOuAssociacoes(evento, id)) {
    return res.status(400).json({
      erro: "Não é possível remover definitivamente este local porque tem itens, stock, pedidos, transferências ou inventários associados. Usa Inativar para preservar o histórico."
    });
  }

  evento.locais = evento.locais.filter(l => Number(l.id) !== id);
  emitirTudo(evento);
  res.json({ ok: true });
});

app.patch("/locais/:id/itens", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  const local = evento.locais.find(l => l.id == req.params.id);
  if (!local) return res.status(404).json({ erro: "Local não encontrado." });

  const itemIds = Array.isArray(req.body.itemIds)
    ? req.body.itemIds.map(Number).filter(id => evento.catalogo.some(i => i.id === id))
    : [];

  local.itemIds = [...new Set(itemIds)];
  if (!local.stockBar) local.stockBar = {};
  local.itemIds.forEach(id => { if (local.stockBar[id] === undefined) local.stockBar[id] = 0; });
  Object.keys(local.stockBar).forEach(id => { if (!local.itemIds.includes(Number(id))) delete local.stockBar[id]; });

  emitirTudo(evento);
  res.json(enriquecerLocal(evento, local));
});

app.get("/pedidos", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  res.json(evento.pedidos);
});

app.post("/pedidos", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  const local = evento.locais.find(l => l.id == req.body.localId);
  if (!local) return res.status(400).json({ erro: "Local inválido." });
  if (local.ativo === false) return res.status(403).json({ erro: "Este local está inativo e não pode enviar pedidos." });
  if (String(req.body.password || "") !== String(local.password || "")) return res.status(403).json({ erro: "Password do local inválida." });

  const itensRecebidos = Array.isArray(req.body.itens) ? req.body.itens : [];
  const itensValidos = itensRecebidos.map(i => {
    const item = getItem(evento, i.id);
    const quantidade = Number(i.quantidade);
    if (!item || quantidade <= 0) return null;
    if (!local.itemIds.includes(item.id)) return null;
    if (Number(item.stock || 0) <= 0) return null;
    if (quantidade > Number(item.stock || 0)) return null;
    return { id: item.id, nome: item.nome, codigo: item.codigo || "", quantidade };
  }).filter(Boolean);

  if (itensValidos.length === 0 || itensValidos.length !== itensRecebidos.length) return res.status(400).json({ erro: "Stock insuficiente ou item inválido." });

  const pedido = {
    id: evento.contadorPedidos,
    codigo: `${local.nome} #${evento.contadorPedidos}`,
    localId: local.id,
    local: local.nome,
    estado: "A aguardar",
    entregueNoBar: false,
    itens: itensValidos,
    criadoEm: new Date().toISOString(),
    eventoId: evento.id
  };

  evento.contadorPedidos++;
  evento.pedidos.push(pedido);
  io.to(`evento-${evento.id}`).emit("novoPedido", pedido);
  emitirTudo(evento);
  res.status(201).json(pedido);
});

app.patch("/pedidos/:id", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  const pedido = evento.pedidos.find(p => p.id == req.params.id);
  if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado." });

  const novoEstado = req.body.estado || pedido.estado;
  if (novoEstado === "Entregue" && !pedido.entregueNoBar) {
    const local = evento.locais.find(l => l.id === pedido.localId);
    if (!local) return res.status(400).json({ erro: "Local do pedido não encontrado." });
    if (!local.stockBar) local.stockBar = {};

    for (const itemPedido of pedido.itens) {
      const item = getItem(evento, itemPedido.id);
      const quantidade = Number(itemPedido.quantidade);
      if (!item || Number(item.stock || 0) < quantidade) return res.status(400).json({ erro: `Stock central insuficiente para ${itemPedido.nome}.` });
    }

    pedido.itens.forEach(itemPedido => {
      const item = getItem(evento, itemPedido.id);
      const quantidade = Number(itemPedido.quantidade);
      item.stock = Math.max(0, Number(item.stock || 0) - quantidade);
      local.stockBar[item.id] = Number(local.stockBar[item.id] || 0) + quantidade;
    });

    pedido.entregueNoBar = true;
  }

  const estadoAnterior = pedido.estado;
  pedido.estado = novoEstado;
  pedido.atualizadoEm = new Date().toISOString();
  if (novoEstado === "Entregue" && estadoAnterior !== "Entregue") {
    pedido.entregueEm = pedido.atualizadoEm;
  }
  io.to(`evento-${evento.id}`).emit("pedidoAtualizado", pedido);
  emitirTudo(evento);
  res.json(pedido);
});


function procurarOuCriarItem(evento, row) {
  const nome = String(row.nome || row.produto || row.item || "").trim();
  const codigo = String(row.codigo || row.codigobarras || row.barcode || "").trim();
  if (!nome && !codigo) return null;
  let item = evento.catalogo.find(i => (codigo && String(i.codigo || "") === codigo) || (nome && String(i.nome || "").toUpperCase() === nome.toUpperCase()));
  if (!item) {
    item = {
      id: evento.contadorCatalogo++, nome: nome || codigo, codigo,
      stock: Math.max(0, Number(row.stock ?? row.stockcentral ?? row.quantidade ?? 0) || 0),
      stockMinimo: Math.max(0, Number(row.stockminimo ?? row.stock_minimo ?? row.minimo ?? row.min ?? 0) || 0),
      dosesAtivo: String(row.dosesativo ?? row.doses_ativo ?? row.ativardoses ?? row.dosesativas ?? "").toLowerCase() === "true" || String(row.dosesativo ?? row.doses_ativo ?? row.ativardoses ?? row.dosesativas ?? "").toLowerCase() === "sim" || Number(row.dosesativo ?? row.doses_ativo ?? row.ativardoses ?? row.dosesativas ?? 0) === 1,
      dosesPorGarrafa: Math.max(0, Number(row.dosesporgarrafa ?? row.doses_por_garrafa ?? row.doses ?? 0) || 0),
      precoDose: Math.max(0, Number(row.precodose ?? row.preco_dose ?? row.preco ?? 0) || 0)
    };
    evento.catalogo.push(item);
  } else {
    if (nome) item.nome = nome;
    if (codigo) item.codigo = codigo;
    if (row.stock !== undefined || row.stockcentral !== undefined) item.stock = Math.max(0, Number(row.stock ?? row.stockcentral) || 0);
    if (row.stockminimo !== undefined || row.stock_minimo !== undefined || row.minimo !== undefined || row.min !== undefined) item.stockMinimo = Math.max(0, numero(row.stockminimo ?? row.stock_minimo ?? row.minimo ?? row.min));
    if (row.dosesativo !== undefined || row.doses_ativo !== undefined || row.ativardoses !== undefined || row.dosesativas !== undefined) item.dosesAtivo = booleano(row.dosesativo ?? row.doses_ativo ?? row.ativardoses ?? row.dosesativas);
    if (row.dosesporgarrafa !== undefined || row.doses_por_garrafa !== undefined || row.doses !== undefined) item.dosesPorGarrafa = Math.max(0, numero(row.dosesporgarrafa ?? row.doses_por_garrafa ?? row.doses));
    if (row.precodose !== undefined || row.preco_dose !== undefined || row.preco !== undefined) item.precoDose = Math.max(0, numero(row.precodose ?? row.preco_dose ?? row.preco));
  }
  return item;
}

function procurarOuCriarLocal(evento, row) {
  const nomeLocal = String(row.local || row.bar || row.nomeLocal || row.nomelocal || "").trim().toUpperCase();
  if (!nomeLocal) return null;
  let local = evento.locais.find(l => String(l.nome || "").toUpperCase() === nomeLocal);
  if (!local) {
    local = { id: evento.contadorLocais++, nome: nomeLocal, password: String(row.password || row.senha || "1234"), ativo: true, itemIds: [], stockBar: {} };
    evento.locais.push(local);
  }
  if (row.password !== undefined || row.senha !== undefined) local.password = String(row.password ?? row.senha ?? local.password);
  if (!local.stockBar) local.stockBar = {};
  return local;
}

function normalizarLinhaImportacao(row) {
  const out = {};
  Object.keys(row || {}).forEach(k => {
    const key = String(k || "").trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
    out[key] = row[k];
  });
  return out;
}

app.post("/importar-tabela", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  normalizarEvento(evento);
  const operacao = String(req.body.operacao || "produtos");
  const linhas = Array.isArray(req.body.linhas) ? req.body.linhas.map(normalizarLinhaImportacao) : [];
  if (!linhas.length) return res.status(400).json({ erro: "Sem linhas para importar." });

  let produtos = 0, locaisCriadosOuAtualizados = 0, stocks = 0, contagensImportadas = 0, descontadoCentral = 0;

  if (operacao === "produtos") {
    linhas.forEach(row => {
      const antes = evento.catalogo.length;
      const item = procurarOuCriarItem(evento, row);
      if (item) produtos++;
      if (evento.catalogo.length > antes) {}
    });
  } else if (operacao === "stock_local") {
    linhas.forEach(row => {
      const local = procurarOuCriarLocal(evento, row);
      const item = procurarOuCriarItem(evento, row);
      if (!local || !item) return;
      const q = Math.max(0, Number(row.quantidade ?? row.stock ?? row.stocklocal ?? row.stockbar ?? 0) || 0);
      if (!local.itemIds.includes(item.id)) local.itemIds.push(item.id);
      if (!local.stockBar) local.stockBar = {};

      // Importar stock por local passa a funcionar como distribuição do armazém geral.
      // Só desconta no stock central a diferença positiva entre o valor novo e o stock que o local já tinha,
      // evitando duplicar descontos se o mesmo ficheiro for importado novamente.
      const stockAnteriorLocal = Math.max(0, Number(local.stockBar[item.id] || 0) || 0);
      const diferencaEntradaLocal = Math.max(0, q - stockAnteriorLocal);
      if (diferencaEntradaLocal > 0) {
        item.stock = Math.max(0, Number(item.stock || 0) - diferencaEntradaLocal);
        descontadoCentral += diferencaEntradaLocal;

        evento.transferenciasLocais = Array.isArray(evento.transferenciasLocais) ? evento.transferenciasLocais : [];
        evento.contadorTransferenciasLocais = Number(evento.contadorTransferenciasLocais || (Math.max(0, ...evento.transferenciasLocais.map(t => Number(t.id) || 0)) + 1));
        evento.transferenciasLocais.unshift({
          id: evento.contadorTransferenciasLocais++,
          itemId: item.id,
          itemNome: item.nome,
          localId: local.id,
          localNome: local.nome,
          quantidade: diferencaEntradaLocal,
          criadoEm: new Date().toISOString(),
          origem: "Importação CSV/Excel stock por local",
          anulada: false,
          anuladaEm: null
        });
      }

      local.stockBar[item.id] = q;
      locaisCriadosOuAtualizados++;
      stocks++;
    });
  } else if (operacao === "contagem_fim_dia") {
    const grupos = {};
    linhas.forEach(row => {
      const local = procurarOuCriarLocal(evento, row);
      const item = procurarOuCriarItem(evento, row);
      if (!local || !item) return;
      if (!local.itemIds.includes(item.id)) local.itemIds.push(item.id);
      const diaTexto = String(row.dia || row.data || "").trim();
      let dia = diaTexto ? evento.dias.find(d => String(d.nome).toUpperCase() === diaTexto.toUpperCase() || String(d.data || "") === diaTexto) : null;
      if (!dia) {
        dia = evento.dias[evento.dias.length - 1] || { id: evento.contadorDias++, nome: diaTexto || "Dia importado", data: diaTexto || "", criadoEm: new Date().toISOString() };
        if (!evento.dias.some(d => Number(d.id) === Number(dia.id))) evento.dias.push(dia);
      }
      const chave = `${dia.id}:${local.id}`;
      if (!grupos[chave]) grupos[chave] = { dia, local, contagensLocal: {}, nota: String(row.nota || "Importado por CSV/Excel") };
      grupos[chave].contagensLocal[item.id] = Math.max(0, Number(row.quantidade ?? row.stock ?? row.real ?? 0) || 0);
    });

    Object.values(grupos).forEach(g => {
      const contagensLocais = { [g.local.id]: g.contagensLocal };
      const contagens = {};
      evento.catalogo.forEach(item => { contagens[item.id] = Math.max(0, Number(g.contagensLocal[item.id]) || 0); });
      evento.inventarios.push({
        id: evento.contadorInventarios++,
        tipo: "fim_dia",
        diaId: g.dia.id,
        nota: `${g.nota} · ${g.local.nome}`,
        localIdContagem: g.local.id,
        contagens,
        contagensLocais,
        snapshot: snapshotSistema(evento),
        criadoEm: new Date().toISOString(),
        contagemLocalPendente: true,
        transportadoParaDiaSeguinte: false,
        alteracoesTransportadas: 0
      });
      contagensImportadas++;
    });
  } else {
    return res.status(400).json({ erro: "Operação inválida." });
  }

  emitirTudo(evento);
  res.json({ ok: true, produtos, locaisCriadosOuAtualizados, stocks, contagens: contagensImportadas, descontadoCentral });
});

app.post("/importar", (req, res) => {
  const evento = eventoDoPedido(req, res); if (!evento) return;
  const listas = Array.isArray(req.body.listas) ? req.body.listas : [];

  listas.forEach(lista => {
    const nomeLocal = String(lista.nome || "").trim().toUpperCase();
    if (!nomeLocal) return;
    let local = evento.locais.find(l => l.nome.toUpperCase() === nomeLocal);

    if (!local) {
      local = { id: evento.contadorLocais++, nome: nomeLocal, password: String(lista.password || "1234"), ativo: true, itemIds: [], stockBar: {} };
      evento.locais.push(local);
    }

    if (lista.password !== undefined) local.password = String(lista.password);

    if (Array.isArray(lista.itens)) {
      lista.itens.forEach(itemRecebido => {
        const nome = String(itemRecebido.nome || "").trim();
        const codigo = String(itemRecebido.codigo || "").trim();
        if (!nome) return;

        let item = evento.catalogo.find(i => (codigo && String(i.codigo || "") === codigo) || i.nome.toUpperCase() === nome.toUpperCase());
        if (!item) {
          item = { id: evento.contadorCatalogo++, nome, codigo, stock: Math.max(0, Number(itemRecebido.stock) || 0) };
          evento.catalogo.push(item);
        } else {
          if (codigo) item.codigo = codigo;
          if (itemRecebido.stock !== undefined) item.stock = Math.max(0, Number(itemRecebido.stock) || 0);
        }

        if (!local.itemIds.includes(item.id)) local.itemIds.push(item.id);
        if (!local.stockBar) local.stockBar = {};
        if (local.stockBar[item.id] === undefined) local.stockBar[item.id] = 0;
      });
    }
  });

  emitirTudo(evento);
  res.json({ ok: true });
});

io.on("connection", socket => {
  socket.emit("eventosAtualizados", eventos.map(resumoEvento));

  socket.on("selecionarEvento", eventoId => {
    const evento = eventos.find(e => e.id === Number(eventoId));
    if (!evento) return;
    socket.join(`evento-${evento.id}`);
    socket.emit("catalogoAtualizado", evento.catalogo);
    socket.emit("locaisAtualizados", evento.locais.map(l => enriquecerLocal(evento, l)));
    normalizarEvento(evento);
    socket.emit("pedidosAtualizados", evento.pedidos);
    socket.emit("diasAtualizados", evento.dias);
    socket.emit("inventariosAtualizados", evento.inventarios);
    socket.emit("consultasStockAtualizadas", evento.consultasStock || []);
    socket.emit("transferenciasLocaisAtualizadas", evento.transferenciasLocais || []);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => console.log(`Servidor iniciado na porta ${PORT}`));
