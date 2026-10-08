// Robô dos lembretes (GitHub Actions, a cada 5 min). Lê lembretes.json do repositório
// privado de dados e entrega os que já chegaram na hora. As mensagens vêm prontas e
// criptografadas pelo app para cada aparelho; aqui só se assina o envio (VAPID).
// Este repositório é público: nada de conteúdo ou endereço completo nos logs.
import crypto from 'node:crypto';

const { DADOS_REPO, DADOS_TOKEN, VAPID_PUBLIC, VAPID_PRIVATE } = process.env;
const ASSUNTO = 'https://brandao00.github.io/rogal-financeiro/';
const JANELA = 6 * 3600 * 1000;
const GUARDAR_ENVIADOS = 30 * 24 * 3600 * 1000;

if (!DADOS_REPO || !DADOS_TOKEN || !VAPID_PUBLIC || !VAPID_PRIVATE) {
  console.error('Faltam os segredos DADOS_TOKEN e/ou VAPID_PRIVATE (Settings → Secrets and variables → Actions).');
  process.exit(1);
}

function gh(nome, opcoes = {}) {
  return fetch(`https://api.github.com/repos/${DADOS_REPO}/contents/${nome}`, {
    ...opcoes,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${DADOS_TOKEN}`,
      'User-Agent': 'rogal-lembretes',
      ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
}

async function ler(nome) {
  const r = await gh(nome);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status} ao ler ${nome}`);
  const j = await r.json();
  return { sha: j.sha, json: JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')) };
}

async function gravar(nome, json, sha, message) {
  const content = Buffer.from(JSON.stringify(json)).toString('base64');
  const r = await gh(nome, { method: 'PUT', body: JSON.stringify({ message, content, ...(sha ? { sha } : {}) }) });
  if (!r.ok) console.log(`Aviso: não deu para gravar ${nome} (${r.status}).`);
}

async function apagar(nome, sha) {
  const r = await gh(nome, { method: 'DELETE', body: JSON.stringify({ message: 'Teste enviado', sha }) });
  if (!r.ok) console.log(`Aviso: não deu para apagar ${nome} (${r.status}).`);
}

const chavePrivada = (() => {
  const pub = Buffer.from(VAPID_PUBLIC, 'base64url');
  return crypto.createPrivateKey({
    format: 'jwk',
    key: {
      kty: 'EC', crv: 'P-256', d: VAPID_PRIVATE,
      x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33, 65).toString('base64url'),
    },
  });
})();

function vapid(endpoint) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const corpo = `${b64({ typ: 'JWT', alg: 'ES256' })}.${b64({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: ASSUNTO,
  })}`;
  const assinatura = crypto.sign('sha256', Buffer.from(corpo), { key: chavePrivada, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${corpo}.${assinatura.toString('base64url')}, k=${VAPID_PUBLIC}`;
}

async function entregar(envio) {
  try {
    const r = await fetch(envio.endpoint, {
      method: 'POST',
      headers: {
        Authorization: vapid(envio.endpoint),
        TTL: '21600',
        Urgency: 'high',
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
      },
      body: Buffer.from(envio.corpo, 'base64url'),
    });
    if (r.ok) return true;
    console.log(`Falha ${r.status} em ${new URL(envio.endpoint).host}`);
  } catch (e) {
    console.log(`Falha de rede em ${new URL(envio.endpoint).host}`);
  }
  return false;
}

const agora = Date.now();
const [lembretes, teste, enviadosArq] = await Promise.all([ler('lembretes.json'), ler('teste.json'), ler('enviados.json')]);
const enviados = enviadosArq?.json || {};
const fila = [...(lembretes?.json?.lembretes || [])];
if (teste) fila.push({ ...teste.json, chave: `teste@${teste.json.quando}` });

let entregues = 0;
let falhas = 0;
let mudou = false;
for (const l of fila) {
  if (l.quando > agora || l.quando < agora - JANELA || enviados[l.chave]) continue;
  for (const envio of l.envios || []) {
    if (await entregar(envio)) entregues++;
    else falhas++;
  }
  enviados[l.chave] = agora;
  mudou = true;
}

for (const [chave, quando] of Object.entries(enviados)) {
  if (quando < agora - GUARDAR_ENVIADOS) { delete enviados[chave]; mudou = true; }
}

if (mudou) await gravar('enviados.json', enviados, enviadosArq?.sha, 'Lembretes enviados');
if (teste && teste.json.quando <= agora) await apagar('teste.json', teste.sha);

console.log(`${entregues} notificação(ões) entregue(s), ${falhas} falha(s).`);
