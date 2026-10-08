'use strict';

const KEY_BACKUP = 'rogal-financeiro-ultimo-backup';

const CAT_PADRAO = {
  saida: [
    'Aluguel', 'Água / Luz / Internet', 'Telefone', 'Salários / Pró-labore', 'Impostos / Taxas',
    'Contador', 'Combustível', 'Veículos / Manutenção', 'Material de escritório',
    'Sistemas / Assinaturas', 'Tarifas bancárias', 'Alimentação', 'Marketing', 'Outros',
  ],
  entrada: ['Aporte / Transferência', 'Reembolso', 'Outras receitas'],
};
// Categorias da primeira versão (de obras); são trocadas pelas novas se o usuário nunca as alterou.
const CAT_ANTIGAS = {
  saida: ['Material', 'Mão de obra', 'Empreiteiro', 'Aluguel de equipamentos', 'Frete / Transporte',
    'Combustível', 'Impostos / Taxas', 'Projetos / Documentação', 'Administrativo', 'Outros'],
  entrada: ['Recebimento de cliente', 'Medição', 'Adiantamento', 'Venda de imóvel', 'Outros'],
};
const FORMAS = ['Pix', 'Dinheiro', 'Transferência', 'Boleto', 'Cartão de crédito', 'Cartão de débito', 'Débito automático', 'Cheque'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const CORES = ['#ef4444', '#f97316', '#eab308', '#ec4899', '#8b5cf6', '#3b82f6'];
const TITULOS = { resumo: 'Visão geral', lancamentos: 'Lançamentos', contas: 'Contas a pagar', mais: 'Ajustes' };

const svgIcone = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONES = {
  casa: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  raio: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
  celular: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  pessoas: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M21.5 20a6.5 6.5 0 0 0-4-6"/>',
  predio: '<path d="M3 21h18"/><path d="M5 21V10M9.5 21V10M14.5 21V10M19 21V10"/><path d="M2 10 12 3l10 7z"/>',
  calculadora: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18.5h.01M12 18.5h.01M16 18.5h.01"/>',
  bomba: '<path d="M3 22h12"/><path d="M4 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18"/><path d="M4 10h10"/><path d="M14 13h2a2 2 0 0 1 2 2v3a2 2 0 0 0 4 0V9l-3-3"/>',
  carro: '<path d="M5 17H3v-5l2.5-5h13L21 12v5h-2"/><path d="M3 12h18"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/><path d="M9.5 17h5"/>',
  clipe: '<path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  cartao: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  talheres: '<path d="M3 2v7a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V2"/><path d="M6 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3zm0 0v7"/>',
  megafone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  etiqueta: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  entrada: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCirculo: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  lista: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  pizza: '<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
};
const REGRAS_ICONE = [
  [/aluguel|condominio|iptu/, 'casa'],
  [/luz|agua|internet|energia/, 'raio'],
  [/telefone|celular/, 'celular'],
  [/salario|pro-labore|funcionario|folha/, 'pessoas'],
  [/imposto|taxa|tributo/, 'predio'],
  [/contador|contab/, 'calculadora'],
  [/combust|gasolina|diesel/, 'bomba'],
  [/veiculo|carro|manutenc|oficina/, 'carro'],
  [/escritorio|material|papel/, 'clipe'],
  [/sistema|assinatura|software/, 'monitor'],
  [/banc|tarifa|cartao|juros/, 'cartao'],
  [/aliment|refeic|comida|lanche/, 'talheres'],
  [/marketing|propaganda|anuncio/, 'megafone'],
];

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ---------- Dados ---------- */

function normalizar(d = {}) {
  const cats = (tipo) => {
    const salvas = d.categorias?.[tipo];
    const antigas = JSON.stringify(salvas) === JSON.stringify(CAT_ANTIGAS[tipo]);
    return salvas?.length && !antigas ? salvas : [...CAT_PADRAO[tipo]];
  };
  return {
    lancamentos: Array.isArray(d.lancamentos) ? d.lancamentos : [],
    categorias: { entrada: cats('entrada'), saida: cats('saida') },
    catAtualizado: d.catAtualizado || 0,
    excluidos: d.excluidos && typeof d.excluidos === 'object' ? d.excluidos : {},
  };
}

function salvar() {
  Cofre.gravar(db);
}

let db = normalizar();
let periodo = mesAtual();
let editandoLanc = null;

/* ---------- Utilidades ---------- */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl = (n) => fmtBRL.format(n || 0);
const pad = (n) => String(n).padStart(2, '0');
const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoje = () => isoLocal(new Date());
const soma = (arr) => arr.reduce((s, l) => s + Number(l.valor || 0), 0);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function mesAtual() {
  const d = new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

function fmtData(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtDataCurta(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const ano = y !== new Date().getFullYear() ? ` ${y}` : '';
  return `${pad(d)} ${MESES_CURTOS[m - 1]}${ano}`;
}

function diasAte(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const h = new Date();
  h.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - h) / 86400000);
}

function rotuloDia(iso) {
  const dif = diasAte(iso);
  if (dif === 0) return 'Hoje';
  if (dif === -1) return 'Ontem';
  if (dif === 1) return 'Amanhã';
  const [y, m, d] = iso.split('-').map(Number);
  return `${fmtDataCurta(iso)} · ${DIAS[new Date(y, m - 1, d).getDay()]}`;
}

function textoVencimento(l) {
  const dif = diasAte(l.data);
  const verbo = l.tipo === 'entrada' ? 'Recebe' : 'Vence';
  if (dif < 0) return `Atrasado há ${plural(-dif, 'dia', 'dias')}`;
  if (dif === 0) return `${verbo} hoje`;
  if (dif === 1) return `${verbo} amanhã`;
  if (dif <= 7) return `${verbo} em ${dif} dias`;
  return `${verbo} em ${fmtDataCurta(l.data)}`;
}

function parseValor(s) {
  s = String(s || '').replace(/[R$\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

function valorParaInput(n) {
  return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function valorGrande(n) {
  const [int, cent] = Math.abs(n).toFixed(2).split('.');
  return `<span class="moeda">${n < 0 ? '−' : ''}R$</span>${Number(int).toLocaleString('pt-BR')}<span class="cent">,${cent}</span>`;
}

const semAnimacao = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Conta do valor anterior até o novo (efeito de contador).
function animarNumero(el, valor, formatar) {
  const de = Number(el.dataset.valor ?? 0);
  el.dataset.valor = valor;
  cancelAnimationFrame(el._anim);
  if (de === valor || semAnimacao()) { el.innerHTML = formatar(valor); return; }
  const inicio = performance.now();
  const duracao = 750;
  const passo = (agora) => {
    const t = Math.min(1, (agora - inicio) / duracao);
    const suave = 1 - Math.pow(1 - t, 3);
    el.innerHTML = formatar(t === 1 ? valor : Math.round((de + (valor - de) * suave) * 100) / 100);
    if (t < 1) el._anim = requestAnimationFrame(passo);
  };
  el._anim = requestAnimationFrame(passo);
}

function addMeses(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1 + n, 1);
  const ultimoDia = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  dt.setDate(Math.min(d, ultimoDia));
  return isoLocal(dt);
}

function iconeDe(l) {
  if (l.tipo === 'entrada') return svgIcone(ICONES.entrada);
  const cat = semAcento(l.categoria);
  const regra = REGRAS_ICONE.find(([re]) => re.test(cat));
  return svgIcone(ICONES[regra ? regra[1] : 'etiqueta']);
}

const noPeriodo = (l) => !periodo || l.data.startsWith(`${periodo.ano}-${pad(periodo.mes)}`);
const pendente = (l) => l.status === 'pendente';
const atrasado = (l) => pendente(l) && l.data < hoje();
const classeValor = (n) => (n < 0 ? 'neg' : n > 0 ? 'pos' : '');
const ordenarDesc = (a, b) => b.data.localeCompare(a.data) || (b.criado || 0) - (a.criado || 0);
const ordenarAsc = (a, b) => a.data.localeCompare(b.data) || (a.criado || 0) - (b.criado || 0);

function vazio(txt, icone = 'checkCirculo') {
  return `<div class="vazio">${svgIcone(ICONES[icone])}<span>${txt}</span></div>`;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.innerHTML = `${svgIcone(ICONES.check)}<span>${esc(msg)}</span>`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- Navegação ---------- */

function irPara(aba) {
  const titulo = $('#pgTitulo');
  if (document.body.dataset.aba !== aba) {
    titulo.classList.remove('trocou');
    void titulo.offsetWidth;
    titulo.classList.add('trocou');
  }
  document.body.dataset.aba = aba;
  titulo.textContent = TITULOS[aba];
  $$('.tab').forEach((t) => t.classList.toggle('ativa', t.id === `tab-${aba}`));
  $$('[data-tab]').forEach((b) => b.classList.toggle('ativo', b.dataset.tab === aba));
  window.scrollTo(0, 0);
}

function mudarMes(delta) {
  if (!periodo) {
    periodo = mesAtual();
  } else {
    let { ano, mes } = periodo;
    mes += delta;
    if (mes < 1) { mes = 12; ano--; }
    if (mes > 12) { mes = 1; ano++; }
    periodo = { ano, mes };
  }
  renderTudo();
}

/* ---------- Render ---------- */

function renderTudo() {
  renderPeriodo();
  renderCategorias();
  renderResumo();
  renderLancamentos();
  renderContas();
  renderUltimoBackup();
}

function renderPeriodo() {
  $('#mesLabel').textContent = periodo ? `${MESES[periodo.mes - 1]} ${periodo.ano}` : 'Todo o período';
  $('#btnTudo').classList.toggle('ativo', !periodo);
}

function linhaHTML(l, modo = 'lista') {
  const emAtraso = atrasado(l);
  const sinal = l.tipo === 'entrada' ? '+' : '−';
  let sub;
  let extra = '';

  if (modo === 'conta') {
    sub = `<span class="${emAtraso ? 'txt-atraso' : ''}">${textoVencimento(l)}</span> · ${esc(l.categoria)}`;
    extra = `<button class="btn-pagar" data-pagar="${l.id}">${svgIcone(ICONES.check)}${l.tipo === 'entrada' ? 'Recebi' : 'Paguei'}</button>`;
  } else {
    const partes = modo === 'data' ? [fmtDataCurta(l.data), l.categoria] : [l.categoria, l.forma];
    sub = partes.filter(Boolean).map(esc).join(' · ');
    if (pendente(l)) extra = `<span class="tag ${emAtraso ? 'atrasado' : 'pendente'}">${emAtraso ? 'Atrasado' : 'Pendente'}</span>`;
  }

  return `<div class="linha ${l.tipo}${emAtraso ? ' em-atraso' : ''}" data-id="${l.id}" tabindex="0">
    <div class="linha-icone">${iconeDe(l)}</div>
    <div class="linha-info">
      <div class="linha-titulo">${esc(l.descricao) || '(sem descrição)'}</div>
      <div class="linha-sub">${sub}</div>
    </div>
    <div class="linha-dir">
      <div class="linha-valor">${sinal}${brl(l.valor)}</div>
      ${extra}
    </div>
  </div>`;
}

function donutHTML(saidas) {
  const porCategoria = {};
  saidas.forEach((l) => {
    const c = l.categoria || 'Sem categoria';
    porCategoria[c] = (porCategoria[c] || 0) + Number(l.valor);
  });
  let itens = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);
  if (!itens.length) return vazio('Nenhuma despesa neste período.', 'pizza');
  if (itens.length > 6) {
    const resto = itens.slice(5).reduce((s, [, v]) => s + v, 0);
    itens = [...itens.slice(0, 5), ['Outras', resto]];
  }

  const total = itens.reduce((s, [, v]) => s + v, 0);
  const R = 50;
  const C = 2 * Math.PI * R;
  let acumulado = 0;
  const arcos = itens.map(([, v], i) => {
    const tam = (v / total) * C;
    const folga = itens.length > 1 ? Math.min(2.5, tam / 2) : 0;
    const arco = `<circle cx="60" cy="60" r="${R}" stroke="${CORES[i]}" style="--i:${i}" stroke-dasharray="${tam - folga} ${C - tam + folga}" stroke-dashoffset="${-acumulado}"/>`;
    acumulado += tam;
    return arco;
  }).join('');

  return `<div class="donut-wrap">
    <div class="donut">
      <svg viewBox="0 0 120 120"><circle class="donut-fundo" cx="60" cy="60" r="${R}"/>${arcos}</svg>
      <div class="donut-centro"><span>Total</span><b>${brl(total)}</b></div>
    </div>
    <ul class="legenda">
      ${itens.map(([c, v], i) => `<li>
        <i style="background:${CORES[i]}"></i>
        <span class="legenda-nome">${esc(c)}</span>
        <span class="legenda-pct">${Math.round((v / total) * 100)}%</span>
        <b>${brl(v)}</b>
      </li>`).join('')}
    </ul>
  </div>`;
}

function renderResumo() {
  const doPeriodo = db.lancamentos.filter(noPeriodo);
  const pagosPeriodo = doPeriodo.filter((l) => l.status === 'pago');
  const entradas = soma(pagosPeriodo.filter((l) => l.tipo === 'entrada'));
  const saidas = soma(pagosPeriodo.filter((l) => l.tipo === 'saida'));
  const saldo = entradas - saidas;

  $('#heroRotulo').textContent = periodo ? 'Saldo do mês' : 'Saldo de todo o período';
  animarNumero($('#rSaldo'), saldo, valorGrande);
  $('#rSaldo').classList.toggle('neg', saldo < 0);
  animarNumero($('#rEntradas'), entradas, brl);
  animarNumero($('#rSaidas'), saidas, brl);

  const badge = $('#heroBadge');
  badge.hidden = true;
  if (periodo) {
    const ant = periodo.mes === 1 ? { ano: periodo.ano - 1, mes: 12 } : { ano: periodo.ano, mes: periodo.mes - 1 };
    const prefixo = `${ant.ano}-${pad(ant.mes)}`;
    const saidasAnt = soma(db.lancamentos.filter((l) => l.tipo === 'saida' && l.status === 'pago' && l.data.startsWith(prefixo)));
    if (saidasAnt > 0 && saidas > 0) {
      const pct = Math.round(((saidas - saidasAnt) / saidasAnt) * 100);
      badge.hidden = false;
      badge.className = `hero-badge ${pct > 0 ? 'subiu' : 'caiu'}`;
      badge.textContent = `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}% de gastos vs ${MESES_CURTOS[ant.mes - 1]}`;
    }
  }

  const pagos = db.lancamentos.filter((l) => l.status === 'pago');
  const caixa = soma(pagos.filter((l) => l.tipo === 'entrada')) - soma(pagos.filter((l) => l.tipo === 'saida'));
  const aPagar = db.lancamentos.filter((l) => pendente(l) && l.tipo === 'saida');
  const emAtraso = aPagar.filter(atrasado);

  animarNumero($('#rPagar'), soma(aPagar), brl);
  $('#rPagarQtd').textContent = aPagar.length ? plural(aPagar.length, 'conta pendente', 'contas pendentes') : 'Nenhuma conta';
  animarNumero($('#rAtrasado'), soma(emAtraso), brl);
  $('#rAtrasadoQtd').textContent = emAtraso.length ? plural(emAtraso.length, 'conta vencida', 'contas vencidas') : 'Tudo em dia';
  $('#tileAtraso').classList.toggle('alerta', emAtraso.length > 0);
  animarNumero($('#rCaixa'), caixa, brl);
  $('#rCaixa').className = classeValor(caixa);

  $$('[data-contador]').forEach((c) => {
    c.hidden = !emAtraso.length;
    c.textContent = emAtraso.length;
  });

  $('#graficoCategorias').innerHTML = donutHTML(doPeriodo.filter((l) => l.tipo === 'saida'));

  const proximas = db.lancamentos.filter(pendente).sort(ordenarAsc).slice(0, 5);
  $('#listaVencimentos').innerHTML = proximas.length
    ? proximas.map((l) => linhaHTML(l, 'conta')).join('')
    : vazio('Nenhuma conta pendente.');

  const ultimos = doPeriodo.filter((l) => l.data <= hoje()).sort(ordenarDesc).slice(0, 5);
  $('#listaUltimos').innerHTML = ultimos.length
    ? ultimos.map((l) => linhaHTML(l, 'data')).join('')
    : vazio('Nenhum lançamento neste período. Toque no + para adicionar.', 'lista');
}

function renderLancamentos() {
  const busca = semAcento($('#fBusca').value.trim());
  const tipo = $('#fTipo').value;
  const categoria = $('#fCategoria').value;
  const status = $('#fStatus').value;

  const lista = db.lancamentos
    .filter(noPeriodo)
    .filter((l) => !tipo || l.tipo === tipo)
    .filter((l) => !status || l.status === status)
    .filter((l) => !categoria || l.categoria === categoria)
    .filter((l) => !busca || semAcento([l.descricao, l.categoria, l.forma, l.obs].join(' ')).includes(busca))
    .sort(ordenarDesc);

  const ent = soma(lista.filter((l) => l.tipo === 'entrada'));
  const sai = soma(lista.filter((l) => l.tipo === 'saida'));
  $('#totaisFiltro').innerHTML = lista.length ? `<div class="totais">
    <div><span>Entradas</span><b class="pos">${brl(ent)}</b></div>
    <div><span>Saídas</span><b class="neg">${brl(sai)}</b></div>
    <div><span>Saldo</span><b class="${classeValor(ent - sai)}">${brl(ent - sai)}</b></div>
  </div>` : '';

  if (!lista.length) {
    $('#listaLancamentos').innerHTML = `<div class="painel">${vazio(db.lancamentos.length
      ? 'Nenhum lançamento encontrado com esses filtros.'
      : 'Nenhum lançamento ainda. Toque no + para adicionar o primeiro.', 'lista')}</div>`;
    return;
  }

  const grupos = new Map();
  lista.forEach((l) => {
    if (!grupos.has(l.data)) grupos.set(l.data, []);
    grupos.get(l.data).push(l);
  });
  $('#listaLancamentos').innerHTML = [...grupos].map(([data, ls]) => {
    const tot = soma(ls.filter((l) => l.tipo === 'entrada')) - soma(ls.filter((l) => l.tipo === 'saida'));
    return `<div class="grupo">
      <div class="grupo-topo"><span>${rotuloDia(data)}</span><span class="${classeValor(tot)}">${tot > 0 ? '+' : tot < 0 ? '−' : ''}${brl(Math.abs(tot))}</span></div>
      <div class="painel linhas">${ls.map((l) => linhaHTML(l)).join('')}</div>
    </div>`;
  }).join('');
}

function renderContas() {
  const pend = db.lancamentos.filter(pendente).sort(ordenarAsc);
  const saidas = pend.filter((l) => l.tipo === 'saida');
  const atrasadas = saidas.filter(atrasado);
  const semana = saidas.filter((l) => diasAte(l.data) >= 0 && diasAte(l.data) <= 7);
  const depois = saidas.filter((l) => diasAte(l.data) > 7);
  const receber = pend.filter((l) => l.tipo === 'entrada');

  $('#resumoContas').innerHTML = `<div class="hero hero-contas">
    <div class="hero-topo"><span class="eyebrow">Total a pagar</span></div>
    <div class="hero-valor">${valorGrande(soma(saidas))}</div>
    <div class="hero-stats tres">
      <div class="hero-stat"><div><span>Em atraso</span><b class="${atrasadas.length ? 'neg' : ''}">${brl(soma(atrasadas))}</b></div></div>
      <div class="hero-stat"><div><span>Próximos 7 dias</span><b>${brl(soma(semana))}</b></div></div>
      <div class="hero-stat"><div><span>Mais adiante</span><b>${brl(soma(depois))}</b></div></div>
    </div>
  </div>`;

  const grupos = [];
  if (atrasadas.length) grupos.push(['Em atraso', atrasadas, 'alerta']);
  if (semana.length) grupos.push(['Próximos 7 dias', semana]);
  const porMes = new Map();
  depois.forEach((l) => {
    const chave = l.data.slice(0, 7);
    if (!porMes.has(chave)) porMes.set(chave, []);
    porMes.get(chave).push(l);
  });
  porMes.forEach((ls, chave) => {
    const [y, m] = chave.split('-').map(Number);
    grupos.push([`${MESES[m - 1]} ${y}`, ls]);
  });
  if (receber.length) grupos.push(['A receber', receber]);

  $('#listaContas').innerHTML = grupos.length
    ? grupos.map(([titulo, ls, classe]) => `<div class="grupo ${classe || ''}">
        <div class="grupo-topo"><span>${titulo} <em>${ls.length}</em></span><span>${brl(soma(ls))}</span></div>
        <div class="painel linhas">${ls.map((l) => linhaHTML(l, 'conta')).join('')}</div>
      </div>`).join('')
    : `<div class="painel">${vazio('Nenhuma conta pendente. Tudo pago!')}</div>`;
}

function renderCategorias() {
  for (const tipo of ['saida', 'entrada']) {
    const el = tipo === 'saida' ? $('#catSaida') : $('#catEntrada');
    el.innerHTML = db.categorias[tipo].map((c, i) =>
      `<span>${esc(c)}<button data-rm-cat="${tipo}" data-idx="${i}" title="Remover">&times;</button></span>`).join('');
  }

  const usadas = db.lancamentos.map((l) => l.categoria).filter(Boolean);
  const todas = [...new Set([...db.categorias.saida, ...db.categorias.entrada, ...usadas])]
    .sort((a, b) => a.localeCompare(b));
  const fCat = $('#fCategoria');
  const atual = fCat.value;
  fCat.innerHTML = `<option value="">Categoria</option>${todas.map((c) => `<option>${esc(c)}</option>`).join('')}`;
  fCat.value = todas.includes(atual) ? atual : '';
}

function renderUltimoBackup() {
  const ult = localStorage.getItem(KEY_BACKUP);
  $('#ultimoBackup').innerHTML = ult
    ? `Último backup: <b>${fmtData(ult)}</b>`
    : '<span class="txt-atraso">Você ainda não fez nenhum backup.</span>';
}

/* ---------- Lançamento (modal) ---------- */

function atualizarFormPorTipo(tipo, categoriaAtual) {
  const f = $('#formLanc').elements;
  const cats = [...db.categorias[tipo]];
  if (categoriaAtual && !cats.includes(categoriaAtual)) cats.push(categoriaAtual);
  f.categoria.innerHTML = cats.map((c) => `<option>${esc(c)}</option>`).join('');
  if (categoriaAtual) f.categoria.value = categoriaAtual;
  $('#optPago').textContent = tipo === 'entrada' ? 'Recebido' : 'Pago';
  $('#optPendente').textContent = tipo === 'entrada' ? 'A receber' : 'A pagar';
  $('#formLanc').dataset.tipo = tipo;
}

const medidor = document.createElement('canvas').getContext('2d');
function ajustarCampoValor() {
  const input = $('#formLanc').elements.valor;
  const estilo = getComputedStyle(input);
  const texto = input.value || input.placeholder;
  medidor.font = `${estilo.fontWeight} ${estilo.fontSize} ${estilo.fontFamily}`;
  const largura = medidor.measureText(texto).width + (parseFloat(estilo.letterSpacing) || 0) * texto.length;
  input.style.width = `${Math.ceil(largura) + 6}px`;
}

function abrirLancamento(l = null) {
  const form = $('#formLanc');
  const f = form.elements;
  form.reset();
  editandoLanc = l?.id || null;

  const tipo = l?.tipo || 'saida';
  $('#tituloLanc').textContent = l ? 'Editar lançamento' : 'Novo lançamento';
  f.tipo.value = tipo;
  atualizarFormPorTipo(tipo, l?.categoria);
  f.descricao.value = l?.descricao || '';
  f.valor.value = l ? valorParaInput(l.valor) : '';
  f.data.value = l?.data || hoje();
  f.forma.value = l?.forma || 'Pix';
  f.status.value = l?.status || 'pago';
  f.obs.value = l?.obs || '';
  f.parcelas.value = 1;
  $('#campoParcelas').hidden = !!l;
  $('#btnExcluirLanc').hidden = !l;
  ajustarCampoValor();

  $('#dlgLanc').showModal();
  if (!l && window.matchMedia('(min-width: 900px)').matches) f.valor.focus();
}

function salvarLancamento(e) {
  e.preventDefault();
  const f = e.target.elements;
  const valor = parseValor(f.valor.value);
  if (!(valor > 0)) { toast('Informe um valor válido'); f.valor.focus(); return; }
  if (!f.descricao.value.trim()) { toast('Informe a descrição'); f.descricao.focus(); return; }
  if (!f.data.value) { toast('Informe a data'); f.data.focus(); return; }

  const base = {
    tipo: f.tipo.value,
    descricao: f.descricao.value.trim(),
    valor,
    data: f.data.value,
    categoria: f.categoria.value,
    forma: f.forma.value,
    status: f.status.value,
    obs: f.obs.value.trim(),
  };

  if (editandoLanc) {
    Object.assign(db.lancamentos.find((x) => x.id === editandoLanc), base, { atualizado: Date.now() });
    toast('Lançamento atualizado');
  } else {
    const n = Math.max(1, Math.min(120, parseInt(f.parcelas.value, 10) || 1));
    const agora = Date.now();
    for (let i = 0; i < n; i++) {
      db.lancamentos.push({
        ...base,
        id: uid(),
        criado: agora + i,
        atualizado: agora + i,
        data: addMeses(base.data, i),
        descricao: n > 1 ? `${base.descricao} (${i + 1}/${n})` : base.descricao,
        status: i === 0 ? base.status : 'pendente',
      });
    }
    toast(n > 1 ? `${n} lançamentos adicionados` : 'Lançamento adicionado');
  }
  salvar();
  $('#dlgLanc').close();
  renderTudo();
}

function excluirLancamento() {
  if (!editandoLanc || !confirm('Excluir este lançamento?')) return;
  db.lancamentos = db.lancamentos.filter((l) => l.id !== editandoLanc);
  db.excluidos[editandoLanc] = Date.now();
  salvar();
  $('#dlgLanc').close();
  renderTudo();
  toast('Lançamento excluído');
}

function marcarPago(id) {
  const l = db.lancamentos.find((x) => x.id === id);
  if (!l) return;
  const acao = l.tipo === 'entrada' ? 'recebido' : 'pago';
  if (!confirm(`Marcar "${l.descricao}" (${brl(l.valor)}) como ${acao}?`)) return;
  l.status = 'pago';
  l.atualizado = Date.now();
  salvar();
  $$(`.linha[data-id="${id}"]`).forEach((el) => el.classList.add('saindo'));
  setTimeout(renderTudo, semAnimacao() ? 0 : 320);
  toast(`Marcado como ${acao}`);
}

/* ---------- Backup / exportação ---------- */

function baixar(nome, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function fazerBackup() {
  const pacote = await Cofre.empacotar(db);
  baixar(`rogal-backup-${hoje()}.json`, JSON.stringify(pacote), 'application/json');
  localStorage.setItem(KEY_BACKUP, hoje());
  renderUltimoBackup();
  toast('Backup criptografado baixado');
}

// Substitui os dados atuais pelos do backup, registrando as exclusões para os outros aparelhos.
function aplicarBackup(d) {
  const agora = Date.now();
  const novos = new Set(d.lancamentos.map((l) => l.id));
  const excluidos = { ...db.excluidos };
  db.lancamentos.forEach((l) => { if (!novos.has(l.id)) excluidos[l.id] = agora; });
  d.lancamentos.forEach((l) => { delete excluidos[l.id]; });
  db = normalizar({
    ...d,
    lancamentos: d.lancamentos.map((l) => ({ ...l, atualizado: agora })),
    catAtualizado: agora,
    excluidos,
  });
  salvar();
  renderTudo();
  toast('Backup restaurado');
}

function restaurarBackup(arquivo) {
  const leitor = new FileReader();
  leitor.onload = async () => {
    let d;
    try {
      d = JSON.parse(leitor.result);
      if (d.cifrado) {
        d = await Cofre.desempacotar(d, async () => prompt('Esse backup foi feito com outra senha. Digite a senha da época do backup:'));
      }
      if (!Array.isArray(d.lancamentos)) throw new Error('formato');
    } catch (e) {
      if (e.message !== 'cancelado') alert(e.message === 'Senha do backup incorreta.' ? e.message : 'Arquivo de backup inválido.');
      return;
    }
    if (!confirm(`Restaurar backup com ${d.lancamentos.length} lançamento(s)?\n\nOs dados atuais serão SUBSTITUÍDOS.`)) return;
    aplicarBackup(d);
  };
  leitor.readAsText(arquivo);
}

function exportarCSV() {
  const campo = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const linhas = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Forma de pagamento', 'Situação', 'Valor', 'Observação']];
  [...db.lancamentos].sort(ordenarAsc).forEach((l) => {
    linhas.push([
      fmtData(l.data),
      l.tipo === 'entrada' ? 'Entrada' : 'Saída',
      l.descricao,
      l.categoria,
      l.forma,
      l.status === 'pago' ? (l.tipo === 'entrada' ? 'Recebido' : 'Pago') : 'Pendente',
      (l.tipo === 'saida' ? -l.valor : l.valor).toFixed(2).replace('.', ','),
      l.obs,
    ]);
  });
  const csv = '\ufeff' + linhas.map((r) => r.map(campo).join(';')).join('\r\n');
  baixar(`rogal-lancamentos-${hoje()}.csv`, csv, 'text/csv;charset=utf-8');
  toast('Planilha exportada');
}

/* ---------- Sincronização entre aparelhos ---------- */

function renderSync(estado = Cofre.status().estado, texto = Cofre.status().texto) {
  $$('[data-sync]').forEach((el) => {
    el.dataset.estado = estado;
    el.title = texto;
    $('span', el).textContent = el.classList.contains('sync-curto')
      ? { ok: 'Na nuvem', sincronizando: 'Salvando', offline: 'Offline', erro: 'Erro', local: 'Só aqui' }[estado]
      : texto;
  });

  const cfg = Cofre.sync();
  $('#formSync').hidden = !!cfg;
  $('#syncConectado').hidden = !cfg;
  if (cfg) {
    const quando = cfg.ultima
      ? new Date(cfg.ultima).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : 'ainda não';
    $('#syncInfo').innerHTML = `Conectado a <b>${esc(cfg.usuario)}/${esc(cfg.repo)}</b> · última sincronização: ${quando}`;
  }
  $('#syncErro').textContent = estado === 'erro' ? texto : '';
}

function iniciarSync() {
  $('#formSync').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const btn = $('button', e.target);
    if (!f.usuario.value.trim() || !f.repo.value.trim() || !f.token.value.trim() || !f.senha.value) {
      $('#syncErro').textContent = 'Preencha todos os campos.';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Conectando…';
    let falha = '';
    try {
      await Cofre.conectar({ usuario: f.usuario.value, repo: f.repo.value, token: f.token.value }, f.senha.value);
      f.token.value = '';
      f.senha.value = '';
      $('#sidebarEmail').textContent = Cofre.email();
      toast('Sincronização ativada');
    } catch (err) {
      Cofre.desconectar();
      falha = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Conectar';
      renderSync();
      if (falha) $('#syncErro').textContent = falha;
    }
  });

  $('#btnSyncAgora').addEventListener('click', async () => {
    await Cofre.sincronizar();
    renderSync();
    if (Cofre.status().estado === 'ok') toast('Sincronizado');
  });

  $('#btnSyncSair').addEventListener('click', () => {
    if (!confirm('Desconectar a sincronização neste aparelho?\n\nOs dados continuam aqui e na nuvem, mas param de se atualizar entre os aparelhos.')) return;
    Cofre.desconectar();
    renderSync();
  });

  $$('[data-sync]').forEach((el) => el.addEventListener('click', () => irPara('mais')));
  renderSync();
  Cofre.sincronizar();
}

/* ---------- Eventos ---------- */

function iniciar(dados) {
  db = normalizar(dados);
  Cofre.aoAtualizar = (novos) => {
    db = normalizar(novos);
    renderTudo();
  };
  Cofre.aoStatus = renderSync;
  iniciarSync();

  $('#formLanc').elements.forma.innerHTML = FORMAS.map((f) => `<option>${f}</option>`).join('');

  const agora = new Date();
  $('#pgData').textContent = `${DIAS[agora.getDay()]}, ${agora.getDate()} de ${MESES[agora.getMonth()].toLowerCase()}`;

  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => irPara(b.dataset.tab)));
  $$('[data-novo]').forEach((b) => b.addEventListener('click', () => abrirLancamento()));

  $('#mesAnt').addEventListener('click', () => mudarMes(-1));
  $('#mesProx').addEventListener('click', () => mudarMes(1));
  $('#mesLabel').addEventListener('click', () => { periodo = mesAtual(); renderTudo(); });
  $('#btnTudo').addEventListener('click', () => { periodo = periodo ? null : mesAtual(); renderTudo(); });

  ['#fBusca', '#fTipo', '#fCategoria', '#fStatus'].forEach((s) =>
    $(s).addEventListener('input', renderLancamentos));

  document.addEventListener('click', (e) => {
    const pagar = e.target.closest('[data-pagar]');
    if (pagar) { marcarPago(pagar.dataset.pagar); return; }

    const linha = e.target.closest('.linha[data-id]');
    if (linha) { abrirLancamento(db.lancamentos.find((l) => l.id === linha.dataset.id)); return; }

    const ir = e.target.closest('[data-ir]');
    if (ir) { irPara(ir.dataset.ir); return; }

    const rm = e.target.closest('[data-rm-cat]');
    if (rm) {
      const tipo = rm.dataset.rmCat;
      const nome = db.categorias[tipo][rm.dataset.idx];
      if (db.categorias[tipo].length <= 1) { toast('Mantenha pelo menos uma categoria'); return; }
      if (!confirm(`Remover a categoria "${nome}"?\n(Lançamentos antigos continuam com ela.)`)) return;
      db.categorias[tipo].splice(rm.dataset.idx, 1);
      db.catAtualizado = Date.now();
      salvar();
      renderCategorias();
    }
  });

  document.addEventListener('keydown', (e) => {
    const linha = e.target.closest?.('.linha[data-id]');
    if (linha && e.key === 'Enter') abrirLancamento(db.lancamentos.find((l) => l.id === linha.dataset.id));
  });

  $$('input[name="tipo"]').forEach((r) =>
    r.addEventListener('change', () => atualizarFormPorTipo(r.value)));
  $('#formLanc').elements.valor.addEventListener('input', ajustarCampoValor);
  $('#formLanc').addEventListener('submit', salvarLancamento);
  $('#btnExcluirLanc').addEventListener('click', excluirLancamento);

  $$('dialog').forEach((dlg) => {
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    $$('[data-fechar]', dlg).forEach((b) => b.addEventListener('click', () => dlg.close()));
  });

  $$('.add-cat').forEach((form) => form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('input', form);
    const nome = input.value.trim();
    const lista = db.categorias[form.dataset.tipo];
    if (!nome) return;
    if (lista.some((c) => c.toLowerCase() === nome.toLowerCase())) { toast('Essa categoria já existe'); return; }
    lista.push(nome);
    db.catAtualizado = Date.now();
    salvar();
    input.value = '';
    renderCategorias();
    toast('Categoria adicionada');
  }));

  $('#btnBackup').addEventListener('click', fazerBackup);
  $('#btnRestaurar').addEventListener('click', () => $('#arqBackup').click());
  $('#arqBackup').addEventListener('change', (e) => {
    if (e.target.files[0]) restaurarBackup(e.target.files[0]);
    e.target.value = '';
  });
  $('#btnCSV').addEventListener('click', exportarCSV);
  $('#btnApagarTudo').addEventListener('click', () => {
    if (!confirm('Apagar TODOS os lançamentos e categorias?')) return;
    if (prompt('Essa ação não pode ser desfeita. Digite APAGAR para confirmar:') !== 'APAGAR') return;
    const agora = Date.now();
    const excluidos = { ...db.excluidos };
    db.lancamentos.forEach((l) => { excluidos[l.id] = agora; });
    db = normalizar({ excluidos, catAtualizado: agora });
    salvar();
    renderTudo();
    toast('Dados apagados');
  });

  renderTudo();

  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

/* ---------- Efeitos visuais ---------- */

document.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  const el = e.target.closest('.hero, .tile, .login-card');
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${e.clientX - r.left}px`);
  el.style.setProperty('--my', `${e.clientY - r.top}px`);
}, { passive: true });

document.addEventListener('pointerdown', (e) => {
  const alvo = e.target.closest('.btn, .nav-novo, button.tile, .btn-pagar, .chip');
  if (!alvo || semAnimacao()) return;
  const r = alvo.getBoundingClientRect();
  const tam = Math.max(r.width, r.height) * 2;
  const onda = document.createElement('span');
  onda.className = 'onda';
  onda.style.cssText = `width:${tam}px;height:${tam}px;left:${e.clientX - r.left - tam / 2}px;top:${e.clientY - r.top - tam / 2}px`;
  alvo.appendChild(onda);
  onda.addEventListener('animationend', () => onda.remove());
}, { passive: true });

// Sem isso o Safari do iPhone ignora o efeito de toque (:active).
document.addEventListener('touchstart', () => {}, { passive: true });
