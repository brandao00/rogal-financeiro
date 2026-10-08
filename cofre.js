'use strict';

// Guarda os dados criptografados (AES-GCM com chave derivada da senha) e sincroniza
// com um repositório privado do GitHub. A senha e a chave nunca saem do aparelho.
const Cofre = (() => {
  const KEY_COFRE = 'rogal-cofre-v2';
  const KEY_SYNC = 'rogal-sync';
  const KEY_LEGADO_ACESSO = 'rogal-financeiro-acesso';
  const KEY_LEGADO_DADOS = 'rogal-financeiro-v1';
  const KEY_LEGADO_SESSAO = 'rogal-financeiro-sessao';
  const ARQUIVO = 'dados.json';
  const ITERACOES = 250000;
  const VERIFICADOR = 'rogal-ok';

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  let chave = null;
  let cofre = null;
  let dadosAtuais = null;
  let fila = Promise.resolve();
  let timerEnvio = null;
  let sincronizando = null;
  let repetir = false;
  let ultimoStatus = { estado: 'local', texto: 'Só neste aparelho' };

  const api = { aoAtualizar: null, aoStatus: null };

  /* ---------- Criptografia ---------- */

  function b64(buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }
  const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const aleatorio = (n) => crypto.getRandomValues(new Uint8Array(n));

  async function derivar(senha, saltB64) {
    const base = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: deB64(saltB64), iterations: ITERACOES, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function cifrar(k, obj) {
    const iv = aleatorio(12);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(JSON.stringify(obj)));
    return { iv: b64(iv), ct: b64(ct) };
  }

  async function decifrar(k, pacote) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(pacote.iv) }, k, deB64(pacote.ct));
    return JSON.parse(dec.decode(pt));
  }

  async function confere(k, verif) {
    try { return (await decifrar(k, verif)) === VERIFICADOR; } catch (e) { return false; }
  }

  async function hashLegado(senha, saltHex) {
    const salt = Uint8Array.from(saltHex.match(/../g), (h) => parseInt(h, 16));
    const base = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, base, 256);
    return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /* ---------- Armazenamento local ---------- */

  const lerJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const copia = (o) => JSON.parse(JSON.stringify(o));
  const lerSync = () => lerJSON(KEY_SYNC);

  function gravarLocal() {
    const k = chave;
    const c = cofre;
    const dados = copia(dadosAtuais);
    fila = fila.then(async () => {
      c.dados = await cifrar(k, dados);
      if (c === cofre) localStorage.setItem(KEY_COFRE, JSON.stringify(c));
    }).catch(() => {});
    return fila;
  }

  /* ---------- Mesclagem entre aparelhos ---------- */

  const versao = (l) => l.atualizado || l.criado || 0;

  function mesclar(a, b) {
    const excluidos = { ...(a.excluidos || {}) };
    for (const [id, t] of Object.entries(b.excluidos || {})) excluidos[id] = Math.max(excluidos[id] || 0, t);

    const mapa = new Map();
    for (const l of [...(a.lancamentos || []), ...(b.lancamentos || [])]) {
      const atual = mapa.get(l.id);
      if (!atual || versao(l) > versao(atual)) mapa.set(l.id, l);
    }
    const lancamentos = [...mapa.values()]
      .filter((l) => !(excluidos[l.id] >= versao(l)))
      .sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));

    const cat = (b.catAtualizado || 0) > (a.catAtualizado || 0) ? b : a;
    const exclOrdenados = {};
    Object.keys(excluidos).sort().forEach((id) => { exclOrdenados[id] = excluidos[id]; });

    return { lancamentos, categorias: cat.categorias, catAtualizado: cat.catAtualizado || 0, excluidos: exclOrdenados };
  }

  const canonico = (d) => JSON.stringify(mesclar(d, { lancamentos: [], excluidos: {} }));

  /* ---------- GitHub ---------- */

  function erroGitHub(status) {
    if (status === 401) return new Error('Token inválido ou expirado. Gere um novo token no GitHub.');
    if (status === 403) return new Error('O token não tem permissão de escrita. Marque "Contents: Read and write".');
    if (status === 404) return new Error('Repositório não encontrado ou o token não tem acesso a ele.');
    return new Error(`O GitHub respondeu com erro ${status}. Tente de novo em instantes.`);
  }

  async function gh(cfg, caminho, opcoes = {}) {
    return fetch(`https://api.github.com/repos/${encodeURIComponent(cfg.usuario)}/${encodeURIComponent(cfg.repo)}${caminho}`, {
      ...opcoes,
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${cfg.token}`, ...(opcoes.headers || {}) },
    });
  }

  async function baixarRemoto(cfg, nome = ARQUIVO) {
    const r = await gh(cfg, `/contents/${nome}`);
    if (r.status === 404) return null;
    if (!r.ok) throw erroGitHub(r.status);
    const j = await r.json();
    let conteudo = j.content;
    if (j.encoding === 'none' || !conteudo) {
      const b = await gh(cfg, `/git/blobs/${j.sha}`);
      if (!b.ok) throw erroGitHub(b.status);
      conteudo = (await b.json()).content;
    }
    return { sha: j.sha, pacote: JSON.parse(atob(conteudo.replace(/\s/g, ''))) };
  }

  async function enviarRemoto(cfg, pacote, sha, nome = ARQUIVO, mensagem = 'Atualização dos dados (criptografados)') {
    const r = await gh(cfg, `/contents/${nome}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: mensagem,
        content: btoa(JSON.stringify(pacote)),
        ...(sha ? { sha } : {}),
      }),
    });
    if (r.status === 409 || r.status === 422) return false;
    if (!r.ok) throw erroGitHub(r.status);
    return true;
  }

  async function empacotar(dados) {
    return { app: 'rogal-financeiro', v: 2, cifrado: true, email: cofre.email, salt: cofre.salt, verif: cofre.verif, dados: await cifrar(chave, dados) };
  }

  /* ---------- Sincronização ---------- */

  function status(estado, texto) {
    ultimoStatus = { estado, texto };
    if (api.aoStatus) api.aoStatus(estado, texto);
  }

  function aplicar(dados) {
    dadosAtuais = dados;
    gravarLocal();
    if (api.aoAtualizar) api.aoAtualizar(copia(dados));
  }

  async function executarSync({ substituir = false } = {}) {
    const cfg = lerSync();
    if (!cfg || !chave) { status('local', 'Só neste aparelho'); return; }
    if (!navigator.onLine) { status('offline', 'Sem internet — salvo no aparelho'); return; }

    status('sincronizando', 'Sincronizando…');
    try {
      for (let tentativa = 0; tentativa < 4; tentativa++) {
        const remoto = await baixarRemoto(cfg);
        let dados = dadosAtuais;
        let doRemoto = null;

        if (remoto && !substituir) {
          if (remoto.pacote.salt !== cofre.salt) {
            throw new Error('A senha foi alterada em outro aparelho. Toque em sair e entre com a nova senha.');
          }
          doRemoto = await decifrar(chave, remoto.pacote.dados);
          dados = mesclar(dadosAtuais, doRemoto);
          if (canonico(dados) !== canonico(dadosAtuais)) aplicar(dados);
        }

        if (doRemoto && canonico(dados) === canonico(doRemoto)) break;
        if (await enviarRemoto(cfg, await empacotar(dados), remoto?.sha)) break;
      }
      cfg.ultima = Date.now();
      localStorage.setItem(KEY_SYNC, JSON.stringify(cfg));
      status('ok', 'Salvo na nuvem');
    } catch (e) {
      if (!navigator.onLine || e instanceof TypeError) status('offline', 'Sem conexão — salvo no aparelho');
      else status('erro', e.message);
    }
  }

  function sincronizar(opcoes) {
    if (sincronizando) { repetir = true; return sincronizando; }
    sincronizando = executarSync(opcoes).finally(() => {
      sincronizando = null;
      if (repetir) { repetir = false; sincronizar(); }
    });
    return sincronizando;
  }

  function agendarEnvio() {
    if (!lerSync()) return;
    clearTimeout(timerEnvio);
    status('sincronizando', 'Sincronizando…');
    timerEnvio = setTimeout(() => { timerEnvio = null; sincronizar(); }, 1500);
  }

  /* ---------- API pública ---------- */

  api.temAcesso = () => !!(lerJSON(KEY_COFRE) || lerJSON(KEY_LEGADO_ACESSO));
  api.email = () => (cofre || lerJSON(KEY_COFRE) || lerJSON(KEY_LEGADO_ACESSO) || {}).email || '';
  api.sync = () => { const c = lerSync(); return c ? { usuario: c.usuario, repo: c.repo, ultima: c.ultima } : null; };
  api.status = () => ultimoStatus;
  api.mesclar = mesclar;

  api.criar = async (email, senha, dados) => {
    const salt = b64(aleatorio(16));
    chave = await derivar(senha, salt);
    cofre = { v: 2, email, salt, verif: await cifrar(chave, VERIFICADOR), dados: null };
    dadosAtuais = copia(dados);
    await gravarLocal();
    return copia(dadosAtuais);
  };

  api.abrir = async (email, senha) => {
    const salvo = lerJSON(KEY_COFRE);
    const legado = lerJSON(KEY_LEGADO_ACESSO);

    if (!salvo && legado) {
      if (email !== legado.email || await hashLegado(senha, legado.salt) !== legado.hash) throw new Error('senha');
      const dados = await api.criar(email, senha, lerJSON(KEY_LEGADO_DADOS) || {});
      [KEY_LEGADO_ACESSO, KEY_LEGADO_DADOS, KEY_LEGADO_SESSAO].forEach((k) => localStorage.removeItem(k));
      return dados;
    }

    if (salvo && email === salvo.email) {
      const k = await derivar(senha, salvo.salt);
      if (await confere(k, salvo.verif)) {
        chave = k;
        cofre = salvo;
        dadosAtuais = await decifrar(k, salvo.dados);
        return copia(dadosAtuais);
      }
    }

    // A senha pode ter sido trocada em outro aparelho: tenta com os dados da nuvem.
    const cfg = lerSync();
    if (cfg && navigator.onLine) {
      let remoto = null;
      try { remoto = await baixarRemoto(cfg); } catch (e) { /* sem acesso à nuvem */ }
      if (remoto && remoto.pacote.email === email) {
        const k = await derivar(senha, remoto.pacote.salt);
        if (await confere(k, remoto.pacote.verif)) {
          chave = k;
          cofre = { v: 2, email, salt: remoto.pacote.salt, verif: remoto.pacote.verif, dados: null };
          dadosAtuais = await decifrar(k, remoto.pacote.dados);
          await gravarLocal();
          return copia(dadosAtuais);
        }
      }
    }
    throw new Error('senha');
  };

  api.gravar = (dados) => {
    if (!chave) return;
    dadosAtuais = copia(dados);
    gravarLocal();
    agendarEnvio();
  };

  api.conferirSenha = async (senha) => confere(await derivar(senha, cofre.salt), cofre.verif);

  api.trocarSenha = async (atual, nova) => {
    if (!await api.conferirSenha(atual)) throw new Error('Senha atual incorreta');
    if (lerSync()) await sincronizar();
    const salt = b64(aleatorio(16));
    chave = await derivar(nova, salt);
    cofre = { v: 2, email: cofre.email, salt, verif: await cifrar(chave, VERIFICADOR), dados: null };
    await gravarLocal();
    if (lerSync()) await sincronizar({ substituir: true });
  };

  api.conectar = async ({ usuario, repo, token }, senha) => {
    if (!await api.conferirSenha(senha)) throw new Error('Senha incorreta.');
    const cfg = { usuario: usuario.trim(), repo: repo.trim(), token: token.trim() };

    let r;
    try { r = await gh(cfg, ''); } catch (e) { throw new Error('Sem conexão com o GitHub. Verifique a internet.'); }
    if (!r.ok) throw erroGitHub(r.status);
    const info = await r.json();
    if (!info.private) throw new Error('Esse repositório está PÚBLICO. Por segurança, deixe-o privado (Settings → Danger Zone → Change visibility).');
    if (info.permissions && !info.permissions.push) throw erroGitHub(403);

    const remoto = await baixarRemoto(cfg);
    if (remoto && remoto.pacote.salt !== cofre.salt) {
      const k = await derivar(senha, remoto.pacote.salt);
      if (!await confere(k, remoto.pacote.verif)) {
        throw new Error('Os dados na nuvem foram salvos com outra senha. Use aqui a mesma senha do outro aparelho.');
      }
      const doRemoto = await decifrar(k, remoto.pacote.dados);
      chave = k;
      cofre = { v: 2, email: remoto.pacote.email, salt: remoto.pacote.salt, verif: remoto.pacote.verif, dados: null };
      aplicar(mesclar(dadosAtuais, doRemoto));
    }

    localStorage.setItem(KEY_SYNC, JSON.stringify(cfg));
    await sincronizar();
    if (ultimoStatus.estado === 'erro') throw new Error(ultimoStatus.texto);
  };

  api.desconectar = () => {
    localStorage.removeItem(KEY_SYNC);
    status('local', 'Só neste aparelho');
  };

  api.sincronizar = () => sincronizar();

  // Outros arquivos JSON (só ASCII) no repositório de sincronização.
  api.lerNuvem = async (nome) => {
    const cfg = lerSync();
    if (!cfg) throw new Error('sem-sync');
    const r = await baixarRemoto(cfg, nome);
    return r && { sha: r.sha, json: r.pacote };
  };
  api.gravarNuvem = async (nome, json, sha, mensagem) => {
    const cfg = lerSync();
    if (!cfg) throw new Error('sem-sync');
    return enviarRemoto(cfg, json, sha, nome, mensagem);
  };

  api.empacotar = async (dados) => empacotar(dados);

  api.desempacotar = async (pacote, pedirSenha) => {
    if (pacote.salt === cofre.salt) return decifrar(chave, pacote.dados);
    const senha = await pedirSenha();
    if (!senha) throw new Error('cancelado');
    const k = await derivar(senha, pacote.salt);
    if (!await confere(k, pacote.verif)) throw new Error('Senha do backup incorreta.');
    return decifrar(k, pacote.dados);
  };

  // Termina de salvar/enviar o que estiver pendente e tranca o app.
  api.trancar = async () => {
    try {
      await fila;
      if (timerEnvio) {
        clearTimeout(timerEnvio);
        await Promise.race([sincronizar(), new Promise((r) => setTimeout(r, 4000))]);
      }
    } finally {
      location.reload();
    }
  };

  api.apagarTudo = () => {
    Object.keys(localStorage).filter((k) => k.startsWith('rogal')).forEach((k) => localStorage.removeItem(k));
  };

  window.addEventListener('online', () => { if (chave) sincronizar(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && chave) sincronizar();
  });
  setInterval(() => {
    if (chave && document.visibilityState === 'visible' && !timerEnvio) sincronizar();
  }, 60000);

  return api;
})();
