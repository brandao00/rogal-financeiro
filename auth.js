'use strict';

(() => {
  const KEY_ACESSO = 'rogal-financeiro-acesso';
  const KEY_SESSAO = 'rogal-financeiro-sessao';

  const tela = document.getElementById('telaLogin');
  const form = document.getElementById('formLogin');
  const f = form.elements;
  const btn = document.getElementById('btnLogin');
  const msgErro = document.getElementById('loginErro');
  const enc = new TextEncoder();

  let modo = 'entrar';
  let appIniciado = false;

  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

  async function derivar(senha, saltHex) {
    const salt = Uint8Array.from(saltHex.match(/../g), (h) => parseInt(h, 16));
    const chave = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, chave, 256);
    return hex(bits);
  }

  async function novoAcesso(email, senha) {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await derivar(senha, salt);
    localStorage.setItem(KEY_ACESSO, JSON.stringify({ email, salt, hash }));
    return hash;
  }

  function lerAcesso() {
    try { return JSON.parse(localStorage.getItem(KEY_ACESSO)); } catch (e) { return null; }
  }

  const tokenSessao = (hash) => hash.slice(0, 32);

  function erro(txt) { msgErro.textContent = txt; }

  function mostrarLogin() {
    const acesso = lerAcesso();
    modo = acesso ? 'entrar' : 'criar';
    form.reset();
    erro('');
    document.getElementById('loginTitulo').textContent = modo === 'criar' ? 'Criar acesso' : 'Entrar';
    document.getElementById('loginSub').textContent = modo === 'criar'
      ? 'Primeiro acesso: defina o e-mail e a senha que você vai usar'
      : 'Acesse o controle de despesas da Rogal';
    document.getElementById('loginBotao').textContent = modo === 'criar' ? 'Criar acesso' : 'Entrar';
    document.getElementById('campoConfirmar').hidden = modo !== 'criar';
    document.getElementById('btnEsqueci').hidden = modo === 'criar';
    f.senha.autocomplete = modo === 'criar' ? 'new-password' : 'current-password';
    if (acesso) f.email.value = acesso.email;

    document.body.classList.add('bloqueado');
    tela.hidden = false;
    if (!window.crypto?.subtle) {
      erro('Este navegador bloqueou a criptografia. Abra o site por um endereço https:// ou direto pelo arquivo no computador.');
    }
  }

  function liberar(hash) {
    localStorage.setItem(KEY_SESSAO, tokenSessao(hash));
    tela.hidden = true;
    document.body.classList.remove('bloqueado');
    const email = lerAcesso().email;
    document.getElementById('acessoEmail').innerHTML = `Logado como <b>${esc(email)}</b>`;
    document.getElementById('sidebarEmail').textContent = email;
    document.getElementById('avatar').textContent = email.charAt(0).toUpperCase();
    if (!appIniciado) {
      appIniciado = true;
      iniciar();
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erro('');
    const email = f.email.value.trim().toLowerCase();
    const senha = f.senha.value;
    if (!email || !senha) { erro('Preencha o e-mail e a senha.'); return; }

    btn.disabled = true;
    try {
      if (modo === 'criar') {
        if (!/^\S+@\S+\.\S+$/.test(email)) { erro('Informe um e-mail válido.'); return; }
        if (senha.length < 6) { erro('A senha precisa ter pelo menos 6 caracteres.'); return; }
        if (senha !== f.confirmar.value) { erro('As senhas não conferem.'); return; }
        liberar(await novoAcesso(email, senha));
      } else {
        const acesso = lerAcesso();
        const hash = await derivar(senha, acesso.salt);
        if (email !== acesso.email || hash !== acesso.hash) {
          erro('E-mail ou senha incorretos.');
          f.senha.value = '';
          f.senha.focus();
          return;
        }
        liberar(hash);
      }
    } catch (err) {
      erro('Não foi possível entrar. Tente novamente.');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('btnEsqueci').addEventListener('click', () => {
    const ok = confirm(
      'Como os dados ficam guardados só neste aparelho, não existe como recuperar a senha.\n\n' +
      'Você pode redefinir o acesso, mas isso APAGA todos os lançamentos deste aparelho. ' +
      'Depois de criar o novo acesso, dá para restaurar um arquivo de backup em Ajustes.\n\nContinuar?'
    );
    if (!ok) return;
    if (prompt('Digite APAGAR para confirmar:') !== 'APAGAR') return;
    [KEY_ACESSO, KEY_SESSAO, 'rogal-financeiro-v1', 'rogal-financeiro-ultimo-backup']
      .forEach((k) => localStorage.removeItem(k));
    location.reload();
  });

  document.querySelectorAll('[data-sair]').forEach((b) => b.addEventListener('click', () => {
    localStorage.removeItem(KEY_SESSAO);
    mostrarLogin();
  }));

  document.getElementById('formSenha').addEventListener('submit', async (e) => {
    e.preventDefault();
    const s = e.target.elements;
    const acesso = lerAcesso();
    try {
      if (await derivar(s.atual.value, acesso.salt) !== acesso.hash) { toast('Senha atual incorreta'); return; }
      if (s.nova.value.length < 6) { toast('A nova senha precisa ter 6+ caracteres'); return; }
      if (s.nova.value !== s.confirmar.value) { toast('As senhas não conferem'); return; }
      localStorage.setItem(KEY_SESSAO, tokenSessao(await novoAcesso(acesso.email, s.nova.value)));
      e.target.reset();
      toast('Senha alterada');
    } catch (err) {
      toast('Não foi possível alterar a senha');
    }
  });

  const acesso = lerAcesso();
  if (acesso && localStorage.getItem(KEY_SESSAO) === tokenSessao(acesso.hash)) {
    liberar(acesso.hash);
  } else {
    mostrarLogin();
  }
})();
