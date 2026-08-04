// app.js
let sb;

let produtos = [];
let usuarios = [];
let logsAtividade = [];

let usuarioLogado = null;
let tipoLogado = null;
let usuarioSenhaEditandoId = null;
let usuarioSenhaEditandoNome = "";

let leitorCodigoBarras = null;
let scannerCampoDestino = "p-codigo";

document.addEventListener("DOMContentLoaded", async () => {
  if (typeof SUPABASE_URL === "undefined" || typeof SUPABASE_ANON_KEY === "undefined") {
    mostrarMensagemLogin("Configuração do Supabase ausente.", "erro");
    return;
  }

  if (!window.supabase) {
    mostrarMensagemLogin("Biblioteca do Supabase não carregada.", "erro");
    return;
  }

  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  carregarSessaoLocal();
  configurarInterfaceInicial();

  if (usuarioLogado) {
    mostrarApp();
    ajustarInterfacePorTipo();
    await carregarTudo();
  } else {
    mostrarTelaLogin();
  }
});

function carregarSessaoLocal() {
  usuarioLogado = localStorage.getItem("usuarioLogado");
  tipoLogado = localStorage.getItem("tipoLogado");
}

function configurarInterfaceInicial() {
  const formEntrar = document.getElementById("form-entrar");
  const formCriar = document.getElementById("form-criar");

  if (formEntrar) formEntrar.onsubmit = fazerLogin;
  if (formCriar) formCriar.onsubmit = criarConta;
}

function mostrarTelaLogin() {
  document.getElementById("tela-login")?.classList.remove("oculto");
  document.getElementById("app")?.classList.add("oculto");
}

function mostrarApp() {
  document.getElementById("tela-login")?.classList.add("oculto");
  document.getElementById("app")?.classList.remove("oculto");
  document.getElementById("nome-usuario-logado").textContent = usuarioLogado || "";
}

function mostrarMensagemLogin(msg, tipo = "info") {
  const el = document.getElementById("msg-login");
  if (!el) return;
  el.innerHTML = `<div class="msg ${tipo}">${msg}</div>`;
}

function mostrarMensagemCadastro(msg, tipo = "info") {
  const el = document.getElementById("msg-cadastro");
  if (!el) return;
  el.innerHTML = `<div class="msg ${tipo}">${msg}</div>`;
}

function mudarAbaLogin(aba) {
  const botaoEntrar = document.getElementById("aba-entrar");
  const botaoCriar = document.getElementById("aba-criar");
  const formEntrar = document.getElementById("form-entrar");
  const formCriar = document.getElementById("form-criar");

  if (aba === "entrar") {
    botaoEntrar?.classList.add("ativa");
    botaoCriar?.classList.remove("ativa");
    formEntrar?.classList.remove("oculto");
    formCriar?.classList.add("oculto");
  } else {
    botaoCriar?.classList.add("ativa");
    botaoEntrar?.classList.remove("ativa");
    formCriar?.classList.remove("oculto");
    formEntrar?.classList.add("oculto");
  }
}

async function fazerLogin(event) {
  event.preventDefault();

  const usuario = document.getElementById("login-usuario").value.trim();
  const senha = document.getElementById("login-senha").value.trim();

  if (!usuario || !senha) {
    mostrarMensagemLogin("Preencha usuário e senha.", "erro");
    return false;
  }

  try {
    const { data, error } = await sb
      .from("usuarios")
      .select("id, usuario, tipo")
      .eq("usuario", usuario)
      .eq("senha", senha)
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      mostrarMensagemLogin("Usuário ou senha inválidos.", "erro");
      return false;
    }

    usuarioLogado = data[0].usuario;
    tipoLogado = data[0].tipo || "user";

    localStorage.setItem("usuarioLogado", usuarioLogado);
    localStorage.setItem("tipoLogado", tipoLogado);

    mostrarApp();
    ajustarInterfacePorTipo();
    await carregarTudo();

    return false;
  } catch (erro) {
    console.error("Erro no login:", erro);
    mostrarMensagemLogin("Erro ao fazer login.", "erro");
    return false;
  }
}

async function criarConta(event) {
  event.preventDefault();

  const usuario = document.getElementById("criar-usuario").value.trim();
  const senha = document.getElementById("criar-senha").value.trim();
  const senha2 = document.getElementById("criar-senha2").value.trim();

  if (!usuario || !senha || !senha2) {
    mostrarMensagemCadastro("Preencha todos os campos.", "erro");
    return false;
  }

  if (senha !== senha2) {
    mostrarMensagemCadastro("As senhas não conferem.", "erro");
    return false;
  }

  try {
    const { data: existente, error: erroBusca } = await sb
      .from("usuarios")
      .select("id")
      .eq("usuario", usuario)
      .limit(1);

    if (erroBusca) throw erroBusca;

    if (existente && existente.length > 0) {
      mostrarMensagemCadastro("Esse usuário já existe.", "erro");
      return false;
    }

    const { error } = await sb.from("usuarios").insert([{
      usuario,
      senha,
      tipo: "user",
      criado_em: new Date().toISOString()
    }]);

    if (error) throw error;

    mostrarMensagemCadastro("Conta criada com sucesso. Faça login.", "sucesso");
    mudarAbaLogin("entrar");

    document.getElementById("criar-usuario").value = "";
    document.getElementById("criar-senha").value = "";
    document.getElementById("criar-senha2").value = "";

    await registrarLog("Cadastro de usuário", `Usuário criado: ${usuario}`);
    return false;
  } catch (erro) {
    console.error("Erro ao criar conta:", erro);
    mostrarMensagemCadastro("Erro ao criar conta.", "erro");
    return false;
  }
}

function fazerLogout() {
  usuarioLogado = null;
  tipoLogado = null;
  localStorage.removeItem("usuarioLogado");
  localStorage.removeItem("tipoLogado");
  mostrarTelaLogin();
}

function ajustarInterfacePorTipo() {
  const admin = tipoLogado === "admin";
  document.getElementById("tab-btn-usuarios")?.classList.toggle("oculto", !admin);
  document.getElementById("tab-btn-logs")?.classList.toggle("oculto", !admin);
}

async function carregarTudo() {
  await Promise.all([
    carregarProdutos(),
    carregarUsuarios(),
    carregarLogsAtividade()
  ]);

  atualizarDashboard();
  renderizarBusca();
  renderizarUsuarios();
  renderizarLogs();
  preencherFiltroLogsUsuarios();
  mostrarAlertaVencimentos();
}

async function carregarProdutos() {
  try {
    const { data, error } = await sb
      .from("produtos")
      .select("*")
      .order("validade", { ascending: true });

    if (error) throw error;
    produtos = data || [];
  } catch (erro) {
    console.error("Erro ao carregar produtos:", erro);
    produtos = [];
  }
}

async function carregarUsuarios() {
  try {
    const { data, error } = await sb
      .from("usuarios")
      .select("id, usuario, criado_em, tipo")
      .order("usuario", { ascending: true });

    if (error) throw error;
    usuarios = data || [];
  } catch (erro) {
    console.error("Erro ao carregar usuários:", erro);
    usuarios = [];
  }
}

async function carregarLogsAtividade() {
  try {
    const { data, error } = await sb
      .from("logs_atividade")
      .select("*")
      .order("criado_em", { ascending: false });

    if (error) throw error;
    logsAtividade = data || [];
  } catch (erro) {
    console.error("Erro ao carregar logs:", erro);
    logsAtividade = [];
  }
}

function atualizarDashboard() {
  let total = 0;
  let ok = 0;
  let semana = 0;
  let vencidos = 0;

  produtos.forEach((p) => {
    total++;
    const status = calcularStatusValidade(p.validade);

    if (status === "vencido") vencidos++;
    else if (status === "semana") semana++;
    else ok++;
  });

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-ok").textContent = ok;
  document.getElementById("stat-semana").textContent = semana;
  document.getElementById("stat-vencidos").textContent = vencidos;

  const tbody = document.getElementById("tbody-painel-semana");
  if (!tbody) return;

  const proximos = produtos.filter((p) => {
    const dias = diferencaDias(p.validade);
    return dias >= 0 && dias <= 7;
  });

  if (proximos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="vazio">Nenhum produto vencendo nesta semana.</td></tr>`;
    return;
  }

  tbody.innerHTML = proximos.map(renderLinhaProduto).join("");
}

function renderLinhaProduto(p) {
  const status = statusProduto(p.validade);

  return `
    <tr>
      <td>${escapeHtml(p.nome || "")}</td>
      <td>${escapeHtml(p.lote || "")}</td>
      <td>${escapeHtml(p.codigo || "")}</td>
      <td>${escapeHtml(String(p.quantidade ?? ""))}</td>
      <td>${formatarDataBR(p.validade)}</td>
      <td><span class="selo selo-${status.classe}">${status.texto}</span></td>
      <td>${escapeHtml(p.cadastrado_por || "")}</td>
    </tr>
  `;
}

function renderizarBusca() {
  const termo = (document.getElementById("campo-busca")?.value || "").trim().toLowerCase();
  const tbody = document.getElementById("tbody-busca");
  if (!tbody) return;

  const filtrados = produtos.filter((p) => {
    const nome = (p.nome || "").toLowerCase();
    const codigo = (p.codigo || "").toLowerCase();
    return nome.includes(termo) || codigo.includes(termo);
  });

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="vazio">Nenhum produto encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map((p) => {
    const status = statusProduto(p.validade);

    return `
      <tr>
        <td>${escapeHtml(p.nome || "")}</td>
        <td>${escapeHtml(p.lote || "")}</td>
        <td>${escapeHtml(p.codigo || "")}</td>
        <td>${escapeHtml(String(p.quantidade ?? ""))}</td>
        <td>${formatarDataBR(p.validade)}</td>
        <td><span class="selo selo-${status.classe}">${status.texto}</span></td>
        <td>${escapeHtml(p.cadastrado_por || "")}</td>
        <td>
          <div class="acoes-tabela">
            <button type="button" class="btn btn-secundario btn-pequeno" onclick="editarProduto('${p.id}')">Editar</button>
            <button type="button" class="btn btn-perigo btn-pequeno" onclick="excluirProduto('${p.id}')">Excluir</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

async function salvarProduto(event) {
  event.preventDefault();

  const id = document.getElementById("produto-id").value.trim();
  const nome = document.getElementById("p-nome").value.trim();
  const validade = document.getElementById("p-validade").value;
  const lote = document.getElementById("p-lote").value.trim();
  const quantidade = parseInt(document.getElementById("p-quantidade").value, 10);
  const codigo = document.getElementById("p-codigo").value.trim();

  if (!nome || !validade || !lote || !codigo || Number.isNaN(quantidade)) {
    mostrarMensagemCadastro("Preencha todos os campos corretamente.", "erro");
    return false;
  }

  try {
    const payload = {
      nome,
      validade,
      lote,
      quantidade,
      codigo,
      cadastrado_em: new Date().toISOString(),
      cadastrado_por: usuarioLogado || "sistema"
    };

    let error;

    if (id) {
      const resp = await sb.from("produtos").update(payload).eq("id", id);
      error = resp.error;
      await registrarLog("Edição de produto", `Produto editado: ${nome}`);
    } else {
      const resp = await sb.from("produtos").insert([payload]);
      error = resp.error;
      await registrarLog("Cadastro de produto", `Produto cadastrado: ${nome}`);
    }

    if (error) throw error;

    mostrarMensagemCadastro(id ? "Produto atualizado com sucesso." : "Produto cadastrado com sucesso.", "sucesso");
    cancelarEdicao();
    await carregarTudo();
    return false;
  } catch (erro) {
    console.error("Erro ao salvar produto:", erro);
    mostrarMensagemCadastro("Erro ao salvar produto.", "erro");
    return false;
  }
}

function cancelarEdicao() {
  document.getElementById("produto-id").value = "";
  document.getElementById("form-produto").reset();
  document.getElementById("btn-cancelar-edicao").classList.add("oculto");
  document.getElementById("btn-salvar-produto").textContent = "Cadastrar produto";
  document.getElementById("titulo-cadastro").textContent = "Cadastrar produto";
}

async function editarProduto(id) {
  const p = produtos.find((item) => String(item.id) === String(id));
  if (!p) return;

  document.getElementById("produto-id").value = p.id;
  document.getElementById("p-nome").value = p.nome || "";
  document.getElementById("p-validade").value = p.validade || "";
  document.getElementById("p-lote").value = p.lote || "";
  document.getElementById("p-quantidade").value = p.quantidade ?? "";
  document.getElementById("p-codigo").value = p.codigo || "";

  document.getElementById("btn-cancelar-edicao").classList.remove("oculto");
  document.getElementById("btn-salvar-produto").textContent = "Salvar alterações";
  document.getElementById("titulo-cadastro").textContent = "Editar produto";
  mudarAba("cadastro");
}

async function excluirProduto(id) {
  if (!confirm("Tem certeza que deseja excluir este produto?")) return;

  try {
    const produto = produtos.find((item) => String(item.id) === String(id));

    const { error } = await sb.from("produtos").delete().eq("id", id);
    if (error) throw error;

    if (produto) {
      await registrarLog("Exclusão de produto", `Produto excluído: ${produto.nome}`);
    }

    await carregarTudo();
  } catch (erro) {
    console.error("Erro ao excluir produto:", erro);
    alert("Erro ao excluir produto.");
  }
}

function mudarAba(aba) {
  const abas = ["painel", "cadastro", "busca", "relatorio", "usuarios", "logs"];

  abas.forEach((id) => {
    document.getElementById(`tab-${id}`)?.classList.toggle("oculto", id !== aba);
    document.getElementById(`tab-btn-${id}`)?.classList.toggle("ativa", id === aba);
  });
}

function statusProduto(dataValidade) {
  const dias = diferencaDias(dataValidade);

  if (dias < 0) return { classe: "alerta", texto: "Vencido" };
  if (dias <= 7) return { classe: "laranja", texto: "Vence em breve" };
  return { classe: "verde", texto: "OK" };
}

function calcularStatusValidade(dataValidade) {
  const dias = diferencaDias(dataValidade);
  if (dias < 0) return "vencido";
  if (dias <= 7) return "semana";
  return "ok";
}

function diferencaDias(dataValidade) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const validade = new Date(dataValidade);
  validade.setHours(0, 0, 0, 0);

  return Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
}

function formatarDataBR(data) {
  if (!data) return "";
  return new Date(data).toLocaleDateString("pt-BR");
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function atalhoData(dias) {
  const ini = new Date();
  const fim = new Date();
  fim.setDate(fim.getDate() + dias);

  document.getElementById("rel-data-ini").value = ini.toISOString().slice(0, 10);
  document.getElementById("rel-data-fim").value = fim.toISOString().slice(0, 10);

  gerarRelatorio();
}

function gerarRelatorio() {
  const ini = document.getElementById("rel-data-ini").value;
  const fim = document.getElementById("rel-data-fim").value;
  const tbody = document.getElementById("tbody-relatorio");
  const resumo = document.getElementById("resumo-relatorio");

  if (!ini || !fim) {
    resumo.innerHTML = `<div class="msg erro">Selecione a data inicial e final.</div>`;
    tbody.innerHTML = "";
    return;
  }

  const dataIni = new Date(ini);
  const dataFim = new Date(fim);
  dataFim.setHours(23, 59, 59, 999);

  const filtrados = produtos.filter((p) => {
    const v = new Date(p.validade);
    return v >= dataIni && v <= dataFim;
  });

  resumo.innerHTML = `<div class="msg sucesso">Encontrados ${filtrados.length} produto(s).</div>`;
  tbody.innerHTML = filtrados.map(renderLinhaProduto).join("");
}

function renderizarUsuarios() {
  const tbody = document.getElementById("tbody-usuarios");
  if (!tbody) return;

  tbody.innerHTML = usuarios.map((u) => `
    <tr>
      <td>${escapeHtml(u.usuario || "")}</td>
      <td>${escapeHtml(u.tipo || "")}</td>
      <td>${formatarDataBR(u.criado_em)}</td>
      <td>
        <button type="button" class="btn btn-secundario" onclick="abrirModalSenha('${u.id}', '${escapeHtml(u.usuario || "")}')">
          Alterar senha
        </button>
      </td>
    </tr>
  `).join("");
}

function renderizarLogs() {
  const tbody = document.getElementById("tbody-logs");
  if (!tbody) return;

  const usuarioFiltro = document.getElementById("filtro-log-usuario")?.value || "";
  const dataFiltro = document.getElementById("filtro-log-data")?.value || "";

  const filtrados = logsAtividade.filter((l) => {
    const okUsuario = !usuarioFiltro || l.usuario === usuarioFiltro;
    const okData = !dataFiltro || String(l.criado_em || "").startsWith(dataFiltro);
    return okUsuario && okData;
  });

  tbody.innerHTML = filtrados.map((l) => `
    <tr>
      <td>${formatarDataBR(l.criado_em)}</td>
      <td>${escapeHtml(l.usuario || "")}</td>
      <td>${escapeHtml(l.acao || "")}</td>
      <td>${escapeHtml(l.detalhes || "")}</td>
    </tr>
  `).join("");
}

function preencherFiltroLogsUsuarios() {
  const select = document.getElementById("filtro-log-usuario");
  if (!select) return;

  const nomes = [...new Set(logsAtividade.map((l) => l.usuario).filter(Boolean))];
  select.innerHTML = `<option value="">Todos os usuários</option>` +
    nomes.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
}

function filtrarLogs() {
  renderizarLogs();
}

function limparFiltrosLogs() {
  document.getElementById("filtro-log-usuario").value = "";
  document.getElementById("filtro-log-data").value = "";
  renderizarLogs();
}

function registrarLog(acao, detalhes) {
  if (!sb) return;

  const usuario = usuarioLogado || "sistema";

  sb.from("logs_atividade").insert([{
    usuario,
    acao,
    detalhes,
    criado_em: new Date().toISOString()
  }]).then(({ error }) => {
    if (error) {
      console.error("Erro ao registrar log:", error);
    } else {
      carregarLogsAtividade();
    }
  });
}

function mostrarAlertaVencimentos() {
  const modal = document.getElementById("modal-alerta");
  const subtitulo = document.getElementById("modal-subtitulo");
  const lista = document.getElementById("modal-lista");

  if (!modal || !subtitulo || !lista) return;

  const proximos = produtos.filter((p) => {
    const dias = diferencaDias(p.validade);
    return dias >= 0 && dias <= 7;
  });

  if (proximos.length === 0) {
    modal.classList.add("oculto");
    return;
  }

  subtitulo.textContent = `${proximos.length} produto(s) vencem nos próximos 7 dias.`;
  lista.innerHTML = proximos.map((p) => {
    const dias = diferencaDias(p.validade);
    return `
      <div class="item-alerta">
        <div>
          <div class="nome">${escapeHtml(p.nome || "")}</div>
          <div class="meta">${escapeHtml(p.lote || "")} • Vence em ${dias} dia(s)</div>
        </div>
        <span class="selo selo-laranja">Atenção</span>
      </div>
    `;
  }).join("");

  modal.classList.remove("oculto");
}

function fecharModal() {
  document.getElementById("modal-alerta")?.classList.add("oculto");
}

async function abrirScanner(campoDestino) {
  scannerCampoDestino = campoDestino || "p-codigo";
  const modal = document.getElementById("modal-scanner");
  const statusEl = document.getElementById("scanner-status");
  const videoEl = document.getElementById("scanner-video");

  if (!modal || !statusEl || !videoEl) return;

  modal.classList.remove("oculto");
  statusEl.textContent = "Iniciando câmera...";
  statusEl.className = "scanner-status";

  if (typeof ZXing === "undefined") {
    statusEl.textContent = "Não foi possível carregar o leitor. Verifique sua internet.";
    statusEl.className = "scanner-status erro";
    return;
  }

  try {
    leitorCodigoBarras = new ZXing.BrowserMultiFormatReader();

    const dispositivos = await leitorCodigoBarras.listVideoInputDevices();
    const traseira = dispositivos.find(d => /back|traseira|rear|environment/i.test(d.label));
    const idCamera = traseira ? traseira.deviceId : (dispositivos[0] ? dispositivos[0].deviceId : undefined);

    statusEl.textContent = "Aponte para o código de barras...";

    leitorCodigoBarras.decodeFromVideoDevice(idCamera, videoEl, (resultado, erro) => {
      if (resultado) {
        const codigoLido = resultado.getText();
        const input = document.getElementById(scannerCampoDestino);
        if (input) input.value = codigoLido;

        statusEl.textContent = "Código lido: " + codigoLido;
        statusEl.className = "scanner-status sucesso";

        if (navigator.vibrate) navigator.vibrate(120);

        if (scannerCampoDestino === "campo-busca") {
          renderizarBusca();
        }

        setTimeout(fecharScanner, 700);
      }
    });
  } catch (e) {
    console.error(e);
    let motivo = "Verifique as permissões do navegador.";
    if (e && e.name === "NotAllowedError") motivo = "Permissão de câmera negada. Libere o acesso à câmera para este site.";
    else if (e && e.name === "NotFoundError") motivo = "Nenhuma câmera foi encontrada neste dispositivo.";
    else if (e && e.name === "NotReadableError") motivo = "A câmera já está sendo usada por outro aplicativo.";
    else if (e && e.message) motivo = e.message;
    statusEl.textContent = "Não foi possível acessar a câmera. " + motivo;
    statusEl.className = "scanner-status erro";
  }
}

function fecharScanner() {
  try {
    if (leitorCodigoBarras) {
      leitorCodigoBarras.reset();
      leitorCodigoBarras = null;
    }
  } catch (e) {
    console.error("Erro ao fechar scanner:", e);
  }
  document.getElementById("modal-scanner")?.classList.add("oculto");
}


function abrirModalSenha(id, usuario) {
  usuarioSenhaEditandoId = id;
  usuarioSenhaEditandoNome = usuario;

  const modal = document.getElementById("modal-senha");
  const nomeEl = document.getElementById("senha-usuario-nome");
  const inputSenha = document.getElementById("nova-senha");

  if (nomeEl) nomeEl.textContent = usuario;
  if (inputSenha) inputSenha.value = "";
  if (modal) modal.classList.remove("oculto");
}

function fecharModalSenha() {
  usuarioSenhaEditandoId = null;
  usuarioSenhaEditandoNome = "";
  document.getElementById("modal-senha")?.classList.add("oculto");
}

async function salvarNovaSenha(event) {
  event.preventDefault();

  const novaSenha = document.getElementById("nova-senha").value.trim();

  if (!usuarioSenhaEditandoId || !novaSenha) {
    mostrarMensagemCadastro("Informe a nova senha.", "erro");
    return false;
  }

  try {
    const { error } = await sb
      .from("usuarios")
      .update({ senha: novaSenha })
      .eq("id", usuarioSenhaEditandoId)
      .select();

    if (error) throw error;

    await registrarLog(
      "Alteração de senha",
      `Senha alterada para o usuário: ${usuarioSenhaEditandoNome}`
    );

    mostrarMensagemCadastro("Senha alterada com sucesso.", "sucesso");
    fecharModalSenha();

    await carregarUsuarios();
    renderizarUsuarios();

    return false;
  } catch (erro) {
    console.error("Erro ao alterar senha:", erro);
    mostrarMensagemCadastro("Erro ao alterar senha.", "erro");
    return false;
  }
}