'use strict';

// Entrar com Face ID / digital. Uma passkey com a extensão PRF entrega um segredo que só
// sai do aparelho depois da biometria; esse segredo cifra a senha, guardada só neste aparelho.
const Bio = (() => {
  const KEY = 'rogal-bio';
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const aleatorio = (n) => crypto.getRandomValues(new Uint8Array(n));
  const ler = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };

  const ua = navigator.userAgent;
  const nome = /iPhone|iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'Face ID'
    : /Android/.test(ua) ? 'digital'
    : /Windows/.test(ua) ? 'Windows Hello'
    : /Macintosh/.test(ua) ? 'Touch ID' : 'biometria';

  let preparo = null;

  async function disponivel() {
    if (!window.PublicKeyCredential || !window.isSecureContext) return false;
    try {
      if (PublicKeyCredential.getClientCapabilities) {
        const cap = await PublicKeyCredential.getClientCapabilities();
        if (cap['extension:prf'] === false) return false;
      }
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (e) {
      return false;
    }
  }

  async function chaveDe(segredo) {
    const base = await crypto.subtle.importKey('raw', segredo, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: enc.encode('rogal-bio-v1') },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function segredo(id, sal) {
    const a = await navigator.credentials.get({
      publicKey: {
        challenge: aleatorio(32),
        allowCredentials: [{ type: 'public-key', id }],
        userVerification: 'required',
        timeout: 60000,
        extensions: { prf: { eval: { first: sal } } },
      },
    });
    const s = a.getClientExtensionResults().prf?.results?.first;
    if (!s) throw new Error('sem-prf');
    return s;
  }

  // Se o navegador não devolver o segredo na criação, é preciso uma segunda leitura da
  // biometria; quando ela exige um novo toque, lança 'confirmar' e retoma na próxima chamada.
  async function ativar(email, senha) {
    if (!preparo || preparo.email !== email || preparo.senha !== senha) {
      preparo = null;
      const sal = aleatorio(32);
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge: aleatorio(32),
          rp: { name: 'Rogal Despesas' },
          user: { id: aleatorio(16), name: email, displayName: email },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
          timeout: 60000,
          extensions: { prf: { eval: { first: sal } } },
        },
      });
      const prf = cred.getClientExtensionResults().prf;
      if (!prf || prf.enabled === false) throw new Error('sem-prf');
      preparo = { email, senha, id: new Uint8Array(cred.rawId), sal, s: prf.results?.first };
    }

    if (!preparo.s) {
      try {
        preparo.s = await segredo(preparo.id, preparo.sal);
      } catch (e) {
        if (e.name === 'NotAllowedError') throw new Error('confirmar');
        preparo = null;
        throw e;
      }
    }

    const iv = aleatorio(12);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chaveDe(preparo.s), enc.encode(senha));
    localStorage.setItem(KEY, JSON.stringify({
      email, id: b64(preparo.id), sal: b64(preparo.sal), iv: b64(iv), ct: b64(ct),
    }));
    preparo = null;
  }

  async function entrar() {
    const b = ler();
    const s = await segredo(deB64(b.id), deB64(b.sal));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(b.iv) }, await chaveDe(s), deB64(b.ct));
    return { email: b.email, senha: dec.decode(pt) };
  }

  return {
    nome,
    disponivel,
    ativar,
    entrar,
    ativo: () => !!ler(),
    cancelar: () => { preparo = null; },
    desativar: () => { preparo = null; localStorage.removeItem(KEY); },
  };
})();
