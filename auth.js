'use strict';

(() => {
  const KEY_TENTATIVAS = 'rogal-tentativas';
  const KEY_BIO_RECUSADO = 'rogal-bio-recusado';
  const KEY_SAIU = 'rogal-saiu';
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

    const comBio = modo === 'entrar' && Bio.ativo();
    btnBio.hidden = !comBio;
    document.getElementById('loginOu').hidden = !comBio;
    document.getElementById('bioBotao').textContent = `Entrar com ${Bio.nome}`;
    btn.classList.toggle('sec', comBio);

    document.body.classList.add('bloqueado');
    tela.hidden = false;
    if (!window.crypto?.subtle) {
      erro('Este navegador bloqueou a criptografia. Abra o site pelo endereço https://.');
    }
    const s = segundosBloqueado();
    if (s) erro(`Muitas tentativas erradas. Tente de novo em ${textoEspera(s)}.`);

    const saiu = sessionStorage.getItem(KEY_SAIU);
    sessionStorage.removeItem(KEY_SAIU);
    if (comBio && !saiu) entrarComBio(true);
  }

  /* ---------- Face ID / biometria ---------- */

  const btnBio = document.getElementById('btnBio');
  const dlgBio = document.getElementById('dlgBio');
  let oferta = null;

  function erroBio(err) {
    if (err.message === 'confirmar') return 'Toque de novo para confirmar.';
    if (err.message === 'sem-prf') {
      return 'Este aparelho ou navegador não permite entrar sem senha neste site. No iPhone, é preciso o iOS 18 ou mais novo.';
    }
    if (err.name === 'NotAllowedError' || err.name === 'AbortError') return 'Cancelado.';
    return 'Não foi possível ativar. Tente de novo.';
  }

  async function entrarComBio(automatico) {
    erro('');
    btnBio.disabled = true;
    let acesso;
    try {
      acesso = await Bio.entrar();
    } catch (err) {
      if (!automatico) erro(`${Bio.nome} não reconhecido ou cancelado. Tente de novo ou entre com a senha.`);
      return;
    } finally {
      btnBio.disabled = false;
    }
    try {
      liberar(await Cofre.abrir(acesso.email, acesso.senha));
    } catch (err) {
      Bio.desativar();
      mostrarLogin();
      erro(`A senha foi alterada. Entre com a senha nova e ative ${Bio.nome} de novo.`);
    }
  }

  btnBio.addEventListener('click', () => entrarComBio(false));

  async function oferecerBio(email, senha, insistir) {
    if (Bio.ativo() || (!insistir && localStorage.getItem(KEY_BIO_RECUSADO)) || !await Bio.disponivel()) return;
    oferta = { email, senha };
    document.getElementById('dlgBioTitulo').textContent = `Entrar com ${Bio.nome}?`;
    document.getElementById('dlgBioErro').textContent = '';
    dlgBio.showModal();
  }

  document.getElementById('btnBioAtivar').addEventListener('click', async (e) => {
    if (!oferta) { dlgBio.close(); return; }
    const b = e.currentTarget;
    b.disabled = true;
    try {
      await Bio.ativar(oferta.email, oferta.senha);
      dlgBio.close();
      toast(`${Bio.nome} ativado`);
      atualizarBioAjuste();
    } catch (err) {
      document.getElementById('dlgBioErro').textContent = erroBio(err);
      if (err.message === 'sem-prf') {
        localStorage.setItem(KEY_BIO_RECUSADO, '1');
        b.hidden = true;
      }
    } finally {
      b.disabled = false;
    }
  });

  document.getElementById('btnBioDepois').addEventListener('click', () => {
    localStorage.setItem(KEY_BIO_RECUSADO, '1');
    dlgBio.close();
  });

  dlgBio.addEventListener('close', () => {
    oferta = null;
    Bio.cancelar();
    document.getElementById('btnBioAtivar').hidden = false;
  });

  async function atualizarBioAjuste() {
    const ativo = Bio.ativo();
    document.getElementById('bioAjuste').hidden = !ativo && !await Bio.disponivel();
    document.getElementById('bioTitulo').textContent = `Entrar com ${Bio.nome}`;
    const estado = document.getElementById('bioEstado');
    estado.textContent = ativo ? 'Ativado neste aparelho' : 'Desativado neste aparelho';
    estado.classList.toggle('on', ativo);
    document.getElementById('btnBioDesativar').hidden = !ativo;
    document.getElementById('formBio').hidden = ativo || document.getElementById('bioAjuste').hidden;
  }

  document.getElementById('btnBioDesativar').addEventListener('click', () => {
    Bio.desativar();
    atualizarBioAjuste();
    toast(`${Bio.nome} desativado`);
  });

  document.getElementById('formBio').addEventListener('submit', async (e) => {
    e.preventDefault();
    const campo = e.target.elements.senha;
    const msg = document.getElementById('bioErro');
    msg.textContent = '';
    if (!campo.value) { msg.textContent = 'Digite sua senha.'; return; }
    try {
      await Bio.ativar(Cofre.email(), campo.value);
    } catch (err) {
      msg.textContent = erroBio(err);
      return;
    }
    if (!await Cofre.conferirSenha(campo.value)) {
      Bio.desativar();
      msg.textContent = 'Senha incorreta.';
      return;
    }
    campo.value = '';
    atualizarBioAjuste();
    toast(`${Bio.nome} ativado`);
  });

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
    atualizarBioAjuste();
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
        oferecerBio(email, senha);
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
        oferecerBio(email, senha);
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

  document.querySelectorAll('[data-sair]').forEach((b) => b.addEventListener('click', () => {
    sessionStorage.setItem(KEY_SAIU, '1');
    Cofre.trancar();
  }));

  document.getElementById('formSenha').addEventListener('submit', async (e) => {
    e.preventDefault();
    const s = e.target.elements;
    if (s.nova.value.length < SENHA_MINIMA) { toast(`A nova senha precisa ter ${SENHA_MINIMA}+ caracteres`); return; }
    if (s.nova.value !== s.confirmar.value) { toast('As senhas não conferem'); return; }
    try {
      const nova = s.nova.value;
      await Cofre.trocarSenha(s.atual.value, nova);
      e.target.reset();
      toast('Senha alterada');
      if (Bio.ativo()) {
        Bio.desativar();
        atualizarBioAjuste();
        oferecerBio(Cofre.email(), nova, true);
      }
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
