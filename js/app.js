/* =========================================================
   ARMAZENAMENTO — SUPABASE
   ========================================================= */
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let usuarios = [];
let produtos = [];
let usuarioLogado = null;

async function carregarUsuarios(){
  const { data, error } = await sb.from('usuarios').select('*');
  if(error){ console.error('Erro ao carregar usuários:', error); return []; }
  return data || [];
}

async function carregarProdutos(){
  const { data, error } = await sb.from('produtos').select('*').order('validade', {ascending:true});
  if(error){ console.error('Erro ao carregar produtos:', error); return []; }
  return data || [];
}

async function iniciar(){
  usuarios = await carregarUsuarios();
  produtos = await carregarProdutos();
  const sessao = localStorage.getItem('sessaoAtual');

  if(usuarios.length === 0){
    mudarAbaLogin('criar');
  }

  if(sessao){
    usuarioLogado = sessao;
    entrarNoApp();
  }
}
iniciar();

/* =========================================================
   LOGIN / CADASTRO DE USUÁRIO
   ========================================================= */
function mudarAbaLogin(qual){
  document.getElementById('aba-entrar').classList.toggle('ativa', qual==='entrar');
  document.getElementById('aba-criar').classList.toggle('ativa', qual==='criar');
  document.getElementById('form-entrar').classList.toggle('oculto', qual!=='entrar');
  document.getElementById('form-criar').classList.toggle('oculto', qual!=='criar');
  document.getElementById('msg-login').innerHTML = '';
}

function mostrarMsgLogin(texto, tipo){
  const cls = tipo === 'erro' ? 'erro-msg' : 'sucesso-msg';
  document.getElementById('msg-login').innerHTML = `<div class="${cls}">${texto}</div>`;
}

async function criarConta(ev){
  ev.preventDefault();
  const usuario = document.getElementById('criar-usuario').value.trim();
  const senha = document.getElementById('criar-senha').value;
  const senha2 = document.getElementById('criar-senha2').value;

  if(senha !== senha2){
    mostrarMsgLogin('As senhas não coincidem.', 'erro');
    return false;
  }
  if(usuarios.find(u => u.usuario.toLowerCase() === usuario.toLowerCase())){
    mostrarMsgLogin('Esse usuário já existe. Tente outro nome.', 'erro');
    return false;
  }
  const { error } = await sb.from('usuarios').insert([{ usuario, senha }]);
  if(error){
    mostrarMsgLogin('Não foi possível criar a conta. Tente novamente.', 'erro');
    console.error(error);
    return false;
  }
  usuarios = await carregarUsuarios();
  mostrarMsgLogin('Conta criada com sucesso! Faça login.', 'sucesso');
  document.getElementById('form-criar').reset();
  setTimeout(() => mudarAbaLogin('entrar'), 900);
  return false;
}

async function fazerLogin(ev){
  ev.preventDefault();
  const usuario = document.getElementById('login-usuario').value.trim();
  const senha = document.getElementById('login-senha').value;

  const encontrado = usuarios.find(u => u.usuario.toLowerCase() === usuario.toLowerCase() && u.senha === senha);
  if(!encontrado){
    mostrarMsgLogin('Usuário ou senha incorretos.', 'erro');
    return false;
  }
  usuarioLogado = encontrado.usuario;
  localStorage.setItem('sessaoAtual', usuarioLogado);
  entrarNoApp();
  return false;
}

async function fazerLogout(){
  usuarioLogado = null;
  localStorage.removeItem('sessaoAtual');
  document.getElementById('app').classList.add('oculto');
  document.getElementById('tela-login').classList.remove('oculto');
  document.getElementById('form-entrar').reset();
}

function entrarNoApp(){
  document.getElementById('tela-login').classList.add('oculto');
  document.getElementById('app').classList.remove('oculto');
  document.getElementById('nome-usuario-logado').textContent = usuarioLogado;
  mudarAba('painel');
  renderizarTudo();
  verificarAlertaSemana();
}

/* =========================================================
   NAVEGAÇÃO ENTRE ABAS
   ========================================================= */
function mudarAba(qual){
  ['painel','cadastro','busca','relatorio'].forEach(a=>{
    document.getElementById('tab-'+a).classList.toggle('oculto', a!==qual);
    document.getElementById('tab-btn-'+a).classList.toggle('ativa', a===qual);
  });
  if(qual==='busca') renderizarBusca();
}

/* =========================================================
   UTILITÁRIOS DE DATA / STATUS
   ========================================================= */
function hojeSemHora(){
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
}
function paraData(str){
  // str no formato yyyy-mm-dd
  const [a,m,d] = str.split('-').map(Number);
  return new Date(a, m-1, d);
}
function diasRestantes(strValidade){
  const alvo = paraData(strValidade);
  alvo.setHours(0,0,0,0);
  const diff = alvo - hojeSemHora();
  return Math.round(diff / 86400000);
}
function formatarDataBR(strValidade){
  const [a,m,d] = strValidade.split('-');
  return `${d}/${m}/${a}`;
}
function statusProduto(strValidade){
  const dias = diasRestantes(strValidade);
  if(dias < 0) return {chave:'vencido', texto:'Vencido', classe:'selo-alerta'};
  if(dias <= 7) return {chave:'semana', texto: dias===0 ? 'Vence hoje' : `Vence em ${dias}d`, classe:'selo-laranja'};
  return {chave:'ok', texto:'Dentro da validade', classe:'selo-verde'};
}
function seloHtml(strValidade){
  const s = statusProduto(strValidade);
  return `<span class="selo ${s.classe}">${s.texto}</span>`;
}

/* =========================================================
   CADASTRO / EDIÇÃO / EXCLUSÃO DE PRODUTOS
   ========================================================= */
function mostrarMsgCadastro(texto, tipo){
  const cls = tipo === 'erro' ? 'erro-msg' : 'sucesso-msg';
  document.getElementById('msg-cadastro').innerHTML = `<div class="${cls}">${texto}</div>`;
  setTimeout(()=>{ document.getElementById('msg-cadastro').innerHTML=''; }, 2500);
}

async function salvarProduto(ev){
  ev.preventDefault();
  const id = document.getElementById('produto-id').value;
  const nome = document.getElementById('p-nome').value.trim();
  const validade = document.getElementById('p-validade').value;
  const lote = document.getElementById('p-lote').value.trim();
  const quantidade = parseInt(document.getElementById('p-quantidade').value, 10);
  const codigo = document.getElementById('p-codigo').value.trim();

  if(id){
    const { error } = await sb.from('produtos')
      .update({ nome, validade, lote, quantidade, codigo })
      .eq('id', id);
    if(error){
      mostrarMsgCadastro('Não foi possível salvar as alterações.', 'erro');
      console.error(error);
      return false;
    }
    mostrarMsgCadastro('Produto atualizado com sucesso!', 'sucesso');
  } else {
    const { error } = await sb.from('produtos')
      .insert([{ nome, validade, lote, quantidade, codigo }]);
    if(error){
      mostrarMsgCadastro('Não foi possível cadastrar o produto.', 'erro');
      console.error(error);
      return false;
    }
    mostrarMsgCadastro('Produto cadastrado com sucesso!', 'sucesso');
  }

  produtos = await carregarProdutos();
  cancelarEdicao();
  renderizarTudo();
}

function editarProduto(id){
  const p = produtos.find(x => x.id === id);
  if(!p) return;
  document.getElementById('produto-id').value = p.id;
  document.getElementById('p-nome').value = p.nome;
  document.getElementById('p-validade').value = p.validade;
  document.getElementById('p-lote').value = p.lote;
  document.getElementById('p-quantidade').value = p.quantidade;
  document.getElementById('p-codigo').value = p.codigo;
  document.getElementById('titulo-cadastro').textContent = 'Editar produto';
  document.getElementById('btn-salvar-produto').textContent = 'Salvar alterações';
  document.getElementById('btn-cancelar-edicao').classList.remove('oculto');
  mudarAba('cadastro');
  window.scrollTo({top:0, behavior:'smooth'});
}

function cancelarEdicao(){
  document.getElementById('form-produto').reset();
  document.getElementById('produto-id').value = '';
  document.getElementById('titulo-cadastro').textContent = 'Cadastrar produto';
  document.getElementById('btn-salvar-produto').textContent = 'Cadastrar produto';
  document.getElementById('btn-cancelar-edicao').classList.add('oculto');
}

async function excluirProduto(id){
  if(!confirm('Tem certeza que deseja excluir este produto?')) return;
  const { error } = await sb.from('produtos').delete().eq('id', id);
  if(error){
    alert('Não foi possível excluir o produto.');
    console.error(error);
    return;
  }
  produtos = await carregarProdutos();
  renderizarTudo();
}

/* =========================================================
   RENDERIZAÇÃO — PAINEL
   ========================================================= */
function renderizarTudo(){
  renderizarPainel();
  renderizarBusca();
  document.getElementById('rel-data-ini').value = '';
  document.getElementById('rel-data-fim').value = '';
  document.getElementById('tbody-relatorio').innerHTML = '';
  document.getElementById('resumo-relatorio').innerHTML = '';
}

function renderizarPainel(){
  const total = produtos.length;
  let vencidos = 0, semana = 0, ok = 0;
  produtos.forEach(p=>{
    const s = statusProduto(p.validade).chave;
    if(s==='vencido') vencidos++;
    else if(s==='semana') semana++;
    else ok++;
  });
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-ok').textContent = ok;
  document.getElementById('stat-semana').textContent = semana;
  document.getElementById('stat-vencidos').textContent = vencidos;

  const contagemNav = semana + vencidos;
  const btnPainel = document.getElementById('tab-btn-painel');
  const existente = btnPainel.querySelector('.badge-contagem');
  if(existente) existente.remove();
  if(contagemNav > 0){
    btnPainel.insertAdjacentHTML('beforeend', ` <span class="badge-contagem">${contagemNav}</span>`);
  }

  const listaSemana = produtos
    .filter(p => statusProduto(p.validade).chave !== 'ok')
    .sort((a,b) => diasRestantes(a.validade) - diasRestantes(b.validade));

  const corpo = document.getElementById('tbody-painel-semana');
  if(listaSemana.length === 0){
    corpo.innerHTML = `<tr><td colspan="6"><div class="vazio"><div class="icone-vazio">✅</div>Nenhum produto vencendo esta semana.</div></td></tr>`;
  } else {
    corpo.innerHTML = listaSemana.map(linhaTabela).join('');
  }
}

function linhaTabela(p, comAcoes){
  return `<tr>
    <td><strong>${escapeHtml(p.nome)}</strong></td>
    <td>${escapeHtml(p.lote)}</td>
    <td>${escapeHtml(p.codigo)}</td>
    <td>${p.quantidade}</td>
    <td>${formatarDataBR(p.validade)}</td>
    <td>${seloHtml(p.validade)}</td>
    ${comAcoes ? `<td class="acoes-tabela">
      <button class="btn btn-secundario btn-pequeno" onclick="editarProduto('${p.id}')">Editar</button>
      <button class="btn btn-perigo btn-pequeno" onclick="excluirProduto('${p.id}')">Excluir</button>
    </td>` : ''}
  </tr>`;
}

function escapeHtml(txt){
  const d = document.createElement('div');
  d.textContent = txt ?? '';
  return d.innerHTML;
}

/* =========================================================
   RENDERIZAÇÃO — BUSCA
   ========================================================= */
function renderizarBusca(){
  const termo = (document.getElementById('campo-busca').value || '').trim().toLowerCase();
  let lista = [...produtos].sort((a,b) => diasRestantes(a.validade) - diasRestantes(b.validade));

  if(termo){
    lista = lista.filter(p =>
      p.nome.toLowerCase().includes(termo) ||
      p.codigo.toLowerCase().includes(termo)
    );
  }

  const corpo = document.getElementById('tbody-busca');
  if(lista.length === 0){
    corpo.innerHTML = `<tr><td colspan="7"><div class="vazio"><div class="icone-vazio">📦</div>${produtos.length===0 ? 'Nenhum produto cadastrado ainda.' : 'Nenhum produto encontrado para essa busca.'}</div></td></tr>`;
  } else {
    corpo.innerHTML = lista.map(p => linhaTabela(p, true)).join('');
  }
}

/* =========================================================
   RELATÓRIO POR PERÍODO
   ========================================================= */
function atalhoData(dias){
  const ini = hojeSemHora();
  const fim = new Date(ini);
  fim.setDate(fim.getDate() + dias);
  document.getElementById('rel-data-ini').value = paraInputDate(ini);
  document.getElementById('rel-data-fim').value = paraInputDate(fim);
  gerarRelatorio();
}
function paraInputDate(d){
  const a = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${a}-${m}-${dd}`;
}

function gerarRelatorio(){
  const ini = document.getElementById('rel-data-ini').value;
  const fim = document.getElementById('rel-data-fim').value;
  const corpo = document.getElementById('tbody-relatorio');
  const resumo = document.getElementById('resumo-relatorio');

  if(!ini || !fim){
    resumo.innerHTML = `<div class="erro-msg">Selecione a data inicial e a data final.</div>`;
    corpo.innerHTML = '';
    return;
  }
  if(paraData(ini) > paraData(fim)){
    resumo.innerHTML = `<div class="erro-msg">A data inicial não pode ser depois da data final.</div>`;
    corpo.innerHTML = '';
    return;
  }

  const dIni = paraData(ini);
  const dFim = paraData(fim);
  const lista = produtos
    .filter(p => {
      const dv = paraData(p.validade);
      return dv >= dIni && dv <= dFim;
    })
    .sort((a,b) => diasRestantes(a.validade) - diasRestantes(b.validade));

  const totalQtd = lista.reduce((s,p)=> s + (p.quantidade||0), 0);
  resumo.innerHTML = `<div class="sucesso-msg">Período de ${formatarDataBR(ini)} até ${formatarDataBR(fim)}: <strong>${lista.length}</strong> produto(s) encontrados, totalizando <strong>${totalQtd}</strong> unidades.</div>`;

  if(lista.length === 0){
    corpo.innerHTML = `<tr><td colspan="6"><div class="vazio"><div class="icone-vazio">🗓️</div>Nenhum produto vence nesse período.</div></td></tr>`;
  } else {
    corpo.innerHTML = lista.map(linhaTabela).join('');
  }
}

/* =========================================================
   ALERTA POP-UP DE VENCIMENTO SEMANAL
   ========================================================= */
function verificarAlertaSemana(){
  const vencendo = produtos.filter(p => statusProduto(p.validade).chave !== 'ok')
    .sort((a,b) => diasRestantes(a.validade) - diasRestantes(b.validade));

  if(vencendo.length === 0) return;

  document.getElementById('modal-subtitulo').textContent =
    `${vencendo.length} produto(s) vencido(s) ou vencendo nos próximos 7 dias`;

  const lista = vencendo.map(p => {
    const s = statusProduto(p.validade);
    return `<div class="item-alerta">
      <div>
        <div class="nome">${escapeHtml(p.nome)}</div>
        <div class="meta">Lote ${escapeHtml(p.lote)} · ${p.quantidade} un. · Vence em ${formatarDataBR(p.validade)}</div>
      </div>
      <span class="selo ${s.classe}">${s.texto}</span>
    </div>`;
  }).join('');

  document.getElementById('modal-lista').innerHTML = lista;
  document.getElementById('modal-alerta').classList.remove('oculto');
}
function fecharModal(){
  document.getElementById('modal-alerta').classList.add('oculto');
}

/* =========================================================
   SCANNER DE CÓDIGO DE BARRAS (câmera)
   ========================================================= */
let leitorCodigoBarras = null;
let streamCameraAtual = null;

async function abrirScanner(){
  document.getElementById('modal-scanner').classList.remove('oculto');
  const statusEl = document.getElementById('scanner-status');
  statusEl.textContent = 'Iniciando câmera...';
  statusEl.className = 'scanner-status';

  if(typeof ZXing === 'undefined'){
    statusEl.textContent = 'Não foi possível carregar o leitor. Verifique sua internet.';
    statusEl.className = 'scanner-status erro';
    return;
  }

  try{
    leitorCodigoBarras = new ZXing.BrowserMultiFormatReader();
    const videoEl = document.getElementById('scanner-video');

    const dispositivos = await ZXing.BrowserMultiFormatReader.listVideoInputDevices();
    // prioriza câmera traseira em celulares
    const traseira = dispositivos.find(d => /back|traseira|rear|environment/i.test(d.label));
    const idCamera = traseira ? traseira.deviceId : (dispositivos[0] ? dispositivos[0].deviceId : undefined);

    statusEl.textContent = 'Aponte para o código de barras...';

    leitorCodigoBarras.decodeFromVideoDevice(idCamera, videoEl, (resultado, erro, controls) => {
      streamCameraAtual = controls;
      if(resultado){
        const codigoLido = resultado.getText();
        document.getElementById('p-codigo').value = codigoLido;
        statusEl.textContent = 'Código lido: ' + codigoLido;
        statusEl.className = 'scanner-status sucesso';
        if(navigator.vibrate) navigator.vibrate(120);
        setTimeout(fecharScanner, 700);
      }
    });
  }catch(e){
    console.error(e);
    let motivo = 'Verifique as permissões do navegador.';
    if(e && e.name === 'NotAllowedError') motivo = 'Permissão de câmera negada. Libere o acesso à câmera para este site.';
    else if(e && e.name === 'NotFoundError') motivo = 'Nenhuma câmera foi encontrada neste dispositivo.';
    else if(e && e.name === 'NotReadableError') motivo = 'A câmera já está sendo usada por outro aplicativo.';
    else if(e && e.message) motivo = e.message;
    statusEl.textContent = 'Não foi possível acessar a câmera. ' + motivo;
    statusEl.className = 'scanner-status erro';
  }
}

function fecharScanner(){
  try{
    if(leitorCodigoBarras){
      leitorCodigoBarras.reset();
      leitorCodigoBarras = null;
    }
  }catch(e){ /* ignora */ }
  document.getElementById('modal-scanner').classList.add('oculto');
}
