'use strict';

(() => {
  const KEY_TENTATIVAS = 'rogal-tentativas';
  const BLOQUEIO_INATIVO = 10 * 60 * 1000;
  const BLOQUEIO_FUNDO = 5 * 60 * 1000;
  const SENHA_MINIMA = 8;

  const tela = document.getElementById('telaLogin');
  const form = document.getElementById('formLogin');
  const f = form.elements;
  const btn = document.getElementById('btnLogin');
  const msgErro = document.getElementById('loginErro');

  let modo = 'entrar';
  let liberado = false;

  function erro(txt) { msgErro.textContent = txt; }

  /* ---------- Limite de tentativas ---------- */

  function lerTentativas() {
    try { return JSON.parse(localStorage.getItem(KEY_TENTATIVAS)) || { falhas: 0, ate: 0 }; } catch (e) { return { falhas: 0, ate: 0 }; }
  }

  function segundosBloqueado() {
    return Math.max(0, Math.ceil((lerTentativas().ate - Date.now()) / 1000));
  }

  function registrarFalha() {
    const t = lerTentativas();
    t.falhas++;
    if (t.falhas % 5 === 0) {
      const espera = Math.min(3600, 30 * 2 ** (t.falhas / 5 - 1));
      t.ate = Date.now() + espera * 1000;
    }
    localStorage.setItem(KEY_TENTATIVAS, JSON.stringify(t));
  }

  function textoEspera(s) {
    return s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`;
  }

  /* ---------- Telas ---------- */

  function mostrarLogin() {
    modo = Cofre.temAcesso() ? 'entrar' : 'criar';
    form.reset();
    erro('');
    document.getElementById('loginTitulo').textContent = modo === 'criar' ? 'Criar acesso' : 'Entrar';
    document.getElementById('loginSub').textContent = modo === 'criar'
      ? 'Primeiro acesso neste aparelho. Se já usa em outro, use o mesmo e-mail e senha.'
      : 'Acesse o controle de despesas da Rogal';
    document.getElementById('loginBotao').textContent = modo === 'criar' ? 'Criar acesso' : 'Entrar';
    document.getElementById('campoConfirmar').hidden = modo !== 'criar';
    document.getElementById('btnEsqueci').hidden = modo === 'criar';
    f.senha.autocomplete = modo === 'criar' ? 'new-password' : 'current-password';
    f.senha.placeholder = modo === 'criar' ? `Mínimo ${SENHA_MINIMA} caracteres` : '••••••••';
    if (modo === 'entrar') f.email.value = Cofre.email();

    document.body.classList.add('bloqueado');
    tela.hidden = false;
    if (!window.crypto?.subtle) {
      erro('Este navegador bloqueou a criptografia. Abra o site pelo endereço https://.');
    }
    const s = segundosBloqueado();
    if (s) erro(`Muitas tentativas erradas. Tente de novo em ${textoEspera(s)}.`);
  }

  function liberar(dados) {
    localStorage.removeItem(KEY_TENTATIVAS);
    tela.hidden = true;
    document.body.classList.remove('bloqueado');
    const email = Cofre.email();
    document.getElementById('acessoEmail').innerHTML = `Logado como <b>${esc(email)}</b>`;
    document.getElementById('sidebarEmail').textContent = email;
    document.getElementById('avatar').textContent = email.charAt(0).toUpperCase();
    liberado = true;
    iniciar(dados);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erro('');
    const espera = segundosBloqueado();
    if (espera) { erro(`Muitas tentativas erradas. Tente de novo em ${textoEspera(espera)}.`); return; }

    const email = f.email.value.trim().toLowerCase();
    const senha = f.senha.value;
    if (!email || !senha) { erro('Preencha o e-mail e a senha.'); return; }

    btn.disabled = true;
    try {
      if (modo === 'criar') {
        if (!/^\S+@\S+\.\S+$/.test(email)) { erro('Informe um e-mail válido.'); return; }
        if (senha.length < SENHA_MINIMA) { erro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`); return; }
        if (senha !== f.confirmar.value) { erro('As senhas não conferem.'); return; }
        liberar(await Cofre.criar(email, senha, {}));
      } else {
        let dados;
        try {
          dados = await Cofre.abrir(email, senha);
        } catch (err) {
          registrarFalha();
          const s = segundosBloqueado();
          erro(s ? `Muitas tentativas erradas. Tente de novo em ${textoEspera(s)}.` : 'E-mail ou senha incorretos.');
          f.senha.value = '';
          f.senha.focus();
          return;
        }
        liberar(dados);
      }
    } catch (err) {
      erro('Não foi possível entrar. Tente novamente.');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('btnEsqueci').addEventListener('click', () => {
    const ok = confirm(
      'A senha não pode ser recuperada: ela é a chave que criptografa os seus dados.\n\n' +
      'Você pode redefinir o acesso, mas isso APAGA os dados deste aparelho. ' +
      'Os dados da nuvem (se a sincronização estava ativa) continuam lá, mas só abrem com a senha antiga.\n\nContinuar?'
    );
    if (!ok) return;
    if (prompt('Digite APAGAR para confirmar:') !== 'APAGAR') return;
    Cofre.apagarTudo();
    location.reload();
  });

  document.querySelectorAll('[data-sair]').forEach((b) => b.addEventListener('click', () => Cofre.trancar()));

  document.getElementById('formSenha').addEventListener('submit', async (e) => {
    e.preventDefault();
    const s = e.target.elements;
    if (s.nova.value.length < SENHA_MINIMA) { toast(`A nova senha precisa ter ${SENHA_MINIMA}+ caracteres`); return; }
    if (s.nova.value !== s.confirmar.value) { toast('As senhas não conferem'); return; }
    try {
      await Cofre.trocarSenha(s.atual.value, s.nova.value);
      e.target.reset();
      toast('Senha alterada');
    } catch (err) {
      toast(err.message === 'Senha atual incorreta' ? err.message : 'Não foi possível alterar a senha');
    }
  });

  /* ---------- Bloqueio automático ---------- */

  let ultimaAtividade = Date.now();
  let escondidoEm = 0;
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((ev) =>
    document.addEventListener(ev, () => { ultimaAtividade = Date.now(); }, { passive: true, capture: true }));

  setInterval(() => {
    if (liberado && Date.now() - ultimaAtividade > BLOQUEIO_INATIVO) Cofre.trancar();
  }, 30000);

  document.addEventListener('visibilitychange', () => {
    if (!liberado) return;
    if (document.visibilityState === 'hidden') escondidoEm = Date.now();
    else if (escondidoEm && Date.now() - escondidoEm > BLOQUEIO_FUNDO) Cofre.trancar();
  });

  mostrarLogin();
})();
