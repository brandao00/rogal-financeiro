'use strict';

// Notificações de lembrete. Cada aparelho que ativa guarda a sua inscrição de push em
// push.json no repositório privado. Os lembretes vão para lembretes.json já criptografados
// para cada aparelho (RFC 8291): o robô do GitHub Actions só assina e entrega na hora certa,
// sem conseguir ler o texto.
const Avisos = (() => {
  const VAPID_PUBLICA = 'BKRJwj23LTEXXqUnI7dIQhJlMQA0FIhzA0wa4VFhj9hIM4paSjIgtijKNzrwVGOd5G2DYCafRjxBIo3UpfsRYAQ';
  const KEY_ATIVO = 'rogal-avisos';
  const ARQ_PUSH = 'push.json';
  const ARQ_LEMBRETES = 'lembretes.json';
  const ARQ_TESTE = 'teste.json';
  const JANELA = 6 * 3600 * 1000;
  const enc = new TextEncoder();
  const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const ua = navigator.userAgent;
  const ios = /iPhone|iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const instalado = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const aparelho = ios ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : 'Outro';

  /* ---------- Bytes e criptografia ---------- */

  const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const deB64u = (s) => Uint8Array.from(
    atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

  function juntar(...partes) {
    const saida = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
    let pos = 0;
    for (const p of partes) { saida.set(p, pos); pos += p.length; }
    return saida;
  }

  async function hkdf(sal, ikm, info, bytes) {
    const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: sal, info }, k, bytes * 8));
  }

  async function hash(texto) {
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(texto)));
    return [...h].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Corpo "aes128gcm" de uma mensagem de Web Push (RFC 8188 + RFC 8291).
  async function cifrarPush(inscricao, texto) {
    const uaPub = deB64u(inscricao.p256dh);
    const auth = deB64u(inscricao.auth);
    const par = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
    const uaChave = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const segredo = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaChave }, par.privateKey, 256));

    const ikm = await hkdf(auth, segredo, juntar(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
    const sal = crypto.getRandomValues(new Uint8Array(16));
    const cek = await hkdf(sal, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdf(sal, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

    const chave = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, chave, juntar(enc.encode(texto), new Uint8Array([2])));
    return b64u(juntar(sal, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPub.length]), asPub, new Uint8Array(ct)));
  }

  const cifrarPara = (inscricoes, aviso) => Promise.all(inscricoes.map(async (s) => ({
    endpoint: s.endpoint,
    corpo: await cifrarPush(s, JSON.stringify({ t: aviso.titulo, b: aviso.corpo, tag: aviso.id })),
  })));

  /* ---------- Lista de lembretes ---------- */

  function textoPrazo(l) {
    const [y, m, d] = l.data.split('-').map(Number);
    const [ly, lm, ld] = l.lembrete.slice(0, 10).split('-').map(Number);
    const dias = Math.round((new Date(y, m - 1, d) - new Date(ly, lm - 1, ld)) / 86400000);
    const verbo = l.tipo === 'entrada' ? 'recebe' : 'vence';
    if (dias === 0) return `${verbo} hoje`;
    if (dias === 1) return `${verbo} amanhã`;
    if (dias < 0) return `venceu dia ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
    return `${verbo} dia ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  }

  function montarLista(dados) {
    const limite = Date.now() - JANELA;
    return (dados?.lancamentos || [])
      .filter((l) => l.status === 'pendente' && l.lembrete)
      .map((l) => ({
        id: l.id,
        quando: new Date(l.lembrete).getTime(),
        titulo: l.tipo === 'entrada' ? 'Valor a receber' : 'Conta a pagar',
        corpo: `${l.descricao} · ${fmtBRL.format(l.valor || 0)} · ${textoPrazo(l)}`,
      }))
      .filter((x) => Number.isFinite(x.quando) && x.quando > limite)
      .sort((a, b) => a.quando - b.quando);
  }

  /* ---------- Envio para a nuvem ---------- */

  let ultimosDados = null;
  let timer = null;
  let rodando = null;
  let memo = { lista: '', em: 0 };

  async function publicar() {
    if (!Cofre.sync() || !navigator.onLine || !ultimosDados) return;
    const lista = montarLista(ultimosDados);
    const chaveLista = JSON.stringify(lista);
    if (chaveLista === memo.lista && Date.now() - memo.em < 10 * 60 * 1000) return;

    const push = await Cofre.lerNuvem(ARQ_PUSH);
    const inscricoes = push?.json?.inscricoes || [];
    const assinatura = await hash(JSON.stringify({ lista, aparelhos: inscricoes.map((s) => s.endpoint) }));
    const atual = await Cofre.lerNuvem(ARQ_LEMBRETES);

    if ((!inscricoes.length && !atual) || atual?.json?.assinatura === assinatura) {
      memo = { lista: chaveLista, em: Date.now() };
      return;
    }

    const lembretes = [];
    for (const aviso of lista) {
      lembretes.push({ chave: `${aviso.id}@${aviso.quando}`, quando: aviso.quando, envios: await cifrarPara(inscricoes, aviso) });
    }
    if (await Cofre.gravarNuvem(ARQ_LEMBRETES, { v: 1, assinatura, lembretes }, atual?.sha, 'Lembretes (criptografados)')) {
      memo = { lista: chaveLista, em: Date.now() };
    }
  }

  function rodar() {
    if (rodando) return rodando;
    rodando = publicar().catch(() => {}).finally(() => { rodando = null; });
    return rodando;
  }

  function agendar(dados) {
    ultimosDados = dados;
    clearTimeout(timer);
    timer = setTimeout(rodar, 2000);
  }

  async function atualizarAparelhos(mudar) {
    for (let i = 0; i < 3; i++) {
      const atual = await Cofre.lerNuvem(ARQ_PUSH);
      const inscricoes = mudar(atual?.json?.inscricoes || []);
      if (await Cofre.gravarNuvem(ARQ_PUSH, { inscricoes }, atual?.sha, 'Aparelhos com notificação')) return;
    }
    throw new Error('Não foi possível salvar. Tente de novo.');
  }

  async function inscrever(reg) {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: deB64u(VAPID_PUBLICA) });
    const j = sub.toJSON();
    const anterior = localStorage.getItem(KEY_ATIVO);
    const nova = { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, aparelho, criado: Date.now() };
    await atualizarAparelhos((lista) => [...lista.filter((s) => s.endpoint !== j.endpoint && s.endpoint !== anterior), nova]);
    localStorage.setItem(KEY_ATIVO, j.endpoint);
  }

  /* ---------- API pública ---------- */

  // '' quando dá para ativar; senão, o motivo.
  function motivoSemSuporte() {
    if (ios && !instalado()) return 'icone';
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'navegador';
    return '';
  }

  const ativo = () => !!localStorage.getItem(KEY_ATIVO) && window.Notification?.permission === 'granted';

  async function ativar() {
    if (motivoSemSuporte()) throw new Error(motivoSemSuporte());
    if (!Cofre.sync()) throw new Error('sem-sync');
    const permissao = await Notification.requestPermission();
    if (permissao !== 'granted') throw new Error('negado');
    await inscrever(await navigator.serviceWorker.ready);
    memo = { lista: '', em: 0 };
    await rodar();
  }

  async function desativar() {
    const endpoint = localStorage.getItem(KEY_ATIVO);
    localStorage.removeItem(KEY_ATIVO);
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    } catch (e) { /* já estava desinscrito */ }
    if (Cofre.sync() && endpoint) await atualizarAparelhos((lista) => lista.filter((s) => s.endpoint !== endpoint));
    memo = { lista: '', em: 0 };
    await rodar();
  }

  async function testar() {
    const endpoint = localStorage.getItem(KEY_ATIVO);
    const push = await Cofre.lerNuvem(ARQ_PUSH);
    const meu = (push?.json?.inscricoes || []).filter((s) => s.endpoint === endpoint);
    if (!meu.length) throw new Error('Este aparelho não está inscrito. Desative e ative de novo.');
    const atual = await Cofre.lerNuvem(ARQ_TESTE);
    const envios = await cifrarPara(meu, { id: 'teste', titulo: 'Teste do Rogal', corpo: 'Tudo certo! As notificações estão funcionando.' });
    await Cofre.gravarNuvem(ARQ_TESTE, { quando: Date.now(), envios }, atual?.sha, 'Teste de notificação');
  }

  // A inscrição de push pode mudar (ex.: o iPhone renova); confere ao abrir o app.
  async function conferir() {
    if (!ativo() || !Cofre.sync() || motivoSemSuporte()) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub || sub.endpoint !== localStorage.getItem(KEY_ATIVO)) {
        await inscrever(reg);
        memo = { lista: '', em: 0 };
        rodar();
      }
    } catch (e) { /* tenta de novo na próxima abertura */ }
  }

  return { ios, motivoSemSuporte, ativo, ativar, desativar, testar, agendar, conferir };
})();
