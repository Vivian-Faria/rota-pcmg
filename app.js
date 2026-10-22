/* Rota PCMG — plano diário, questões, caderno de erros e evolução.
   Tudo fica salvo no próprio aparelho (localStorage). Use a aba "Mais" para fazer backup. */
(function () {
  'use strict';

  /* ---------- utilidades ---------- */
  var KEY = 'rota_pcmg_v1';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var parse = function (s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  var addDays = function (s, n) { var d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  var today = function () { return ymd(new Date()); };
  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  var DOW = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  var MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
  var fmtPct = function (v) { return v == null ? '–' : (Math.round(v * 10) / 10).toString().replace('.', ',') + '%'; };
  var fmtDateShort = function (s) { var p = s.split('-'); return p[2] + '/' + p[1]; };
  var longDate = function (s) { var d = parse(s); return cap(DOW[d.getDay()]) + ', ' + d.getDate() + ' de ' + MONTHS[d.getMonth()]; };

  /* ---------- dados fixos ---------- */
  var MATERIAS = [
    'Direito Penal', 'Processual Penal', 'Legislação Especial', 'Direito Constitucional',
    'Direito Administrativo', 'Lei Orgânica e Legislação Policial', 'Português',
    'Matemática / RL / Estatística', 'Informática', 'Criminologia',
    'Criminalística e Medicina Legal', 'Direitos Humanos', 'Outras'
  ];
  // Histórico acumulado (ago–out/2026) trazido do Tec Concursos: [questões, acertos]
  var BASE = {
    'Direito Penal': [143, 76], 'Português': [113, 76], 'Criminalística e Medicina Legal': [110, 71],
    'Criminologia': [91, 52], 'Direito Constitucional': [90, 55], 'Informática': [63, 45],
    'Processual Penal': [11, 6], 'Legislação Especial': [6, 3], 'Matemática / RL / Estatística': [23, 10],
    'Direito Administrativo': [15, 8], 'Direitos Humanos': [6, 4],
    'Lei Orgânica e Legislação Policial': [7, 6], 'Outras': [126, 83]
  };
  var ASSUNTOS = [
    'Princípios de Direito Penal', 'Lei Penal', 'Teoria do Crime', 'Das Penas',
    'Crimes contra a Pessoa', 'Crimes contra o Patrimônio', 'Crimes contra a Dignidade Sexual',
    'Crimes contra a Paz Pública', 'Crimes contra a Fé Pública', 'Crimes contra a Administração Pública',
    'Jurisprudência dos Tribunais Superiores'
  ];
  var MOTIVOS = ['Não sabia o conteúdo', 'Confundi conceitos', 'Li mal o enunciado', 'Distração', 'Pegadinha da banca'];
  var MILE = [['2026-10-21', 61.5], ['2026-12-31', 68], ['2027-01-31', 73], ['2027-02-28', 77], ['2027-03-31', 80]];
  var MILE_LABELS = [['Dez/26', 68, '2026-12-31'], ['Jan/27', 73, '2027-01-31'], ['Fev/27', 77, '2027-02-28'], ['Mar/27', 80, '2027-03-31']];
  var QUOTES = [
    'Ninguém muda de vida fazendo as mesmas coisas.',
    'Bora concluir o que ninguém pode fazer por você.',
    'Constância vence motivação. Você já provou isso.',
    'Passar na PCMG é o que você sonha desde criança. Hoje é mais um tijolo.',
    'Erro registrado é ponto que você não perde de novo.',
    'Cansada também conta: versão mínima, mas sem faltar.',
    'Se não correr atrás disso, vai continuar na vida que vem levando.'
  ];

  /* ---------- estado ---------- */
  var mem = null;
  function defaults() {
    return { v: 1, settings: { oneSignalAppId: '', installDismissed: false, startDate: today() }, checks: {}, minimal: {}, logs: [], errors: [], closes: {} };
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw), d = defaults();
        s.settings = Object.assign(d.settings, s.settings || {});
        return Object.assign(d, s);
      }
    } catch (e) { /* sem storage */ }
    return mem || defaults();
  }
  var state = load();
  function save() {
    mem = state;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignora */ }
  }
  var ui = { tab: 'hoje', errFilter: '', summary: '', lastMateria: MATERIAS[0], pushStatus: '' };

  /* ---------- plano do dia ---------- */
  function dayInfo(date) {
    var map = {
      1: { foco: 'Direito Penal' },
      2: { foco: 'Processual Penal e Legislação Especial', matrl: true },
      3: { foco: 'Direito Constitucional' },
      4: { foco: 'Direito Penal' },
      5: { foco: 'Português e Lei Orgânica da PCMG', matrl: true },
      6: { foco: 'Revisão semanal' },
      0: { foco: 'Criminologia e Criminalística' }
    };
    return map[parse(date).getDay()];
  }
  function tasksFor(date, minimal) {
    var dow = parse(date).getDay(), info = dayInfo(date), t = [];
    if (dow >= 1 && dow <= 5) {
      t.push({ id: 'teoria', title: 'Teoria ativa: ' + info.foco, detail: '60 min. Aula ou lei seca; pare e resuma em 3 linhas.', core: false, skipMin: true });
      t.push({ id: 'questoes', title: minimal ? '20 questões (mínimo)' : '30 questões',
        detail: minimal ? 'Da matéria do dia: ' + info.foco + '.' : '20 de ' + info.foco + ' e 10 de matérias antigas.', core: true });
      t.push({ id: 'erros', title: 'Caderno de erros', detail: '20 min. Cada erro vira uma linha: assunto, motivo e regra certa.', core: true });
      if (info.matrl && !minimal) t.push({ id: 'matrl', title: 'Matemática e Raciocínio Lógico', detail: '15 min. De 5 a 8 questões.', core: false });
    } else if (dow === 6) {
      t.push({ id: 'revisao', title: 'Revisão semanal com o Claude (9h)', detail: 'Gere o resumo na aba Mais e cole no chat.', core: true });
      if (!minimal) {
        t.push({ id: 'longas', title: 'Bloco de questões longas', detail: '90 min. Penal e Constitucional, ou um simulado parcial.', core: true });
        t.push({ id: 'erros', title: 'Caderno de erros da semana', detail: '30 min. Revise as linhas que venceram.', core: false });
      }
    } else {
      t.push({ id: 'crim', title: minimal ? '20 questões: Criminologia ou Criminalística' : '40 questões: Criminologia e Criminalística/Med. Legal',
        detail: 'Registre na aba Questões.', core: true });
      t.push({ id: 'erros', title: 'Revisão do caderno de erros', detail: '30 min.', core: true });
      t.push({ id: 'descanso', title: 'Descanso protegido', detail: '2 h sem estudo. Perfil de motos, rua, sofá. Sem culpa.', core: false });
    }
    return t.filter(function (x) { return !(minimal && x.skipMin); });
  }
  function isChecked(date, id) { return !!(state.checks[date] && state.checks[date][id]); }
  function coreDone(date) {
    var core = tasksFor(date, !!state.minimal[date]).filter(function (t) { return t.core; });
    return core.length > 0 && core.every(function (t) { return isChecked(date, t.id); });
  }
  function streak() {
    var d = today();
    if (!coreDone(d)) d = addDays(d, -1);
    var n = 0;
    while (n < 400 && coreDone(d)) { n++; d = addDays(d, -1); }
    return n;
  }

  /* ---------- estatísticas ---------- */
  function agg(from, to, fn) {
    var f = 0, a = 0;
    state.logs.forEach(function (l) {
      if (l.date >= from && l.date <= to && (!fn || fn(l))) { f += l.feitas; a += l.acertos; }
    });
    return { f: f, a: a, pct: f ? 100 * a / f : null };
  }
  function target(date) {
    if (date <= MILE[0][0]) return MILE[0][1];
    for (var i = 1; i < MILE.length; i++) {
      if (date <= MILE[i][0]) {
        var t = (parse(date) - parse(MILE[i - 1][0])) / (parse(MILE[i][0]) - parse(MILE[i - 1][0]));
        return MILE[i - 1][1] + (MILE[i][1] - MILE[i - 1][1]) * t;
      }
    }
    return 80;
  }
  function dueReviews() {
    var t = today(), out = [];
    state.errors.forEach(function (e) {
      [1, 7, 30].forEach(function (k) {
        var due = addDays(e.date, k);
        if (!e.rev[k] && due <= t) out.push({ e: e, k: k, due: due, late: due < t });
      });
    });
    out.sort(function (a, b) { return a.due < b.due ? -1 : 1; });
    return out;
  }

  /* ---------- mensagem do mentor ---------- */
  function mentorMessage(date) {
    var h = new Date().getHours(), info = dayInfo(date), min = !!state.minimal[date];
    var core = tasksFor(date, min).filter(function (t) { return t.core; });
    var left = core.filter(function (t) { return !isChecked(date, t.id); }).length;
    var doy = Math.floor((parse(date) - new Date(parse(date).getFullYear(), 0, 0)) / 864e5);
    var quote = QUOTES[doy % QUOTES.length];
    var label, tone = '', msg;
    if (h < 12) {
      label = 'Plano do dia';
      if (left === 0) { tone = 'done'; msg = 'Essencial do dia já feito logo cedo. Registre as questões e siga o dia com a cabeça leve.'; }
      else if (min) msg = 'Hoje está pesado, e tudo bem. O mínimo é 20 questões e o caderno de erros. Faça o mínimo, mas faça.';
      else if (left < core.length) msg = 'Você já começou. Faltam ' + left + ' item(ns) essenciais. Termine antes de o dia te engolir.';
      else msg = 'Hoje é ' + DOW[parse(date).getDay()] + ': ' + info.foco + '. O essencial é questões feitas e o caderno de erros fechado. Comece pelo mais difícil.';
    } else if (h < 18) {
      label = 'Conferência';
      if (left === 0) { tone = 'done'; msg = 'Essencial do dia feito. É assim que os 80% se constroem: sem drama, todo dia.'; }
      else { tone = 'firm'; msg = 'Já passou do meio do dia e faltam ' + left + ' item(ns) essenciais. Se a manhã escapou, a versão mínima cabe em 40 minutos hoje à noite. Decida agora quando.'; }
    } else {
      label = 'Fechamento do dia';
      if (left === 0) { tone = 'done'; msg = 'Dia cumprido. Registre as questões, anote sua energia e descanse. Amanhã a gente sobe a régua.'; }
      else { tone = 'firm'; msg = 'O dia ainda não fechou: faltam ' + left + ' item(ns). Faça a versão mínima (20 questões e o caderno de erros) e vá dormir. Não precisa ser heroica, precisa ser constante.'; }
    }
    return { label: label, tone: tone, msg: msg, quote: quote };
  }

  /* ---------- telas ---------- */
  function renderHoje() {
    var d = today(), min = !!state.minimal[d], tasks = tasksFor(d, min), m = mentorMessage(d);
    var done = tasks.filter(function (t) { return isChecked(d, t.id); }).length;
    var pct = tasks.length ? Math.round(100 * done / tasks.length) : 0;
    var h = new Date().getHours(), greet = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    var st = streak(), reviews = dueReviews();
    var standalone = (window.navigator && window.navigator.standalone) || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    var html = '<div class="date">' + esc(longDate(d)) + '</div><h1>' + greet + ', Ví</h1>';
    html += '<div class="chips"><span class="chip' + (st > 0 ? ' ok' : '') + '">Sequência: ' + st + ' dia' + (st === 1 ? '' : 's') + '</span>' +
      '<span class="chip">Foco: ' + esc(dayInfo(d).foco) + '</span></div>';
    html += '<section class="card mentor ' + m.tone + '"><div class="label">' + esc(m.label) + '</div><p>' + esc(m.msg) + '</p><p class="quote">' + esc(m.quote) + '</p></section>';
    if (!standalone && !state.settings.installDismissed) {
      html += '<div class="banner"><b>Instale na tela inicial.</b> No Safari: botão Compartilhar, depois "Adicionar à Tela de Início". Só assim o iPhone libera as notificações. ' +
        '<button class="btn sm ghost" data-act="dismissInstall" style="margin-top:8px">Já instalei</button></div>';
    }
    html += '<section class="card"><div class="toggle"><span>Hoje está pesado (modo mínimo)</span><button aria-label="Modo mínimo" aria-pressed="' + min + '" data-act="minimal"></button></div>';
    html += '<ul class="omr">';
    tasks.forEach(function (t) {
      html += '<li><button class="task" data-act="toggle" data-id="' + t.id + '" aria-pressed="' + isChecked(d, t.id) + '">' +
        '<span class="bubble"></span><span class="ttext"><b>' + esc(t.title) + '</b><small>' + esc(t.detail) + '</small></span>' +
        (t.core ? '<span class="tag">essencial</span>' : '') + '</button></li>';
    });
    html += '</ul><div class="progress" aria-hidden="true"><i style="width:' + pct + '%"></i></div>' +
      '<small>' + done + ' de ' + tasks.length + ' feitos</small></section>';
    if (reviews.length) {
      html += '<section class="card"><h2>Revisões de erros de hoje</h2>';
      reviews.slice(0, 8).forEach(function (r) {
        html += '<div class="item"><div class="top"><div><b>' + esc(r.e.assunto || r.e.materia) + '</b><div class="meta">' + esc(r.e.materia) +
          ' · errou em ' + fmtDateShort(r.e.date) + ' · revisão D' + r.k + (r.late ? ' (atrasada)' : '') + '</div></div>' +
          '<button class="btn sm ghost" data-act="reviewDone" data-id="' + r.e.id + '" data-k="' + r.k + '">Revisei</button></div>' +
          '<div class="rule">' + esc(r.e.regra) + '</div></div>';
      });
      if (reviews.length > 8) html += '<small>+' + (reviews.length - 8) + ' revisões na aba Erros.</small>';
      html += '</section>';
    }
    var c = state.closes[d];
    html += '<section class="card"><h2>Fechar o dia</h2><label>Como está a sua energia?</label><div class="seg">';
    for (var i = 1; i <= 5; i++) html += '<button data-act="energy" data-v="' + i + '" aria-pressed="' + (c && c.energia === i) + '">' + i + '</button>';
    html += '</div><div class="meta muted" style="display:flex;justify-content:space-between;margin-top:4px"><small>1 = exausta</small><small>5 = inteira</small></div>' +
      '<label for="nota">O que travou ou funcionou hoje? (opcional)</label><textarea id="nota" placeholder="Uma linha basta.">' + esc(c && c.nota || '') + '</textarea>' +
      '<button class="btn accent block" data-act="closeDay" style="margin-top:12px">' + (c && c.saved ? 'Atualizar fechamento' : 'Fechar o dia') + '</button>' +
      (c && c.saved ? '<p class="muted" style="margin:8px 0 0"><small>Dia fechado às ' + esc(c.saved) + '.</small></p>' : '') + '</section>';
    return html;
  }

  function renderQuestoes() {
    var d = today(), html = '<h1>Questões</h1>';
    html += '<section class="card"><h2>Registrar questões</h2><form id="logForm">' +
      '<label for="lm">Matéria</label><select id="lm">' + MATERIAS.map(function (m) {
        return '<option' + (m === ui.lastMateria ? ' selected' : '') + '>' + esc(m) + '</option>';
      }).join('') + '</select>' +
      '<label for="la">Assunto (opcional)</label><input id="la" list="assuntos" placeholder="Ex.: Teoria do Crime" autocomplete="off">' +
      '<datalist id="assuntos">' + ASSUNTOS.map(function (a) { return '<option value="' + esc(a) + '">'; }).join('') + '</datalist>' +
      '<div class="grid2"><div><label for="lf">Feitas</label><input id="lf" type="number" inputmode="numeric" min="1" required></div>' +
      '<div><label for="lc">Acertos</label><input id="lc" type="number" inputmode="numeric" min="0" required></div></div>' +
      '<label for="ld">Data</label><input id="ld" type="date" value="' + d + '" max="' + d + '">' +
      '<button class="btn accent block" type="submit" style="margin-top:14px">Salvar</button></form></section>';
    var tot = agg(d, d);
    html += '<section class="card"><h2>Hoje</h2>';
    var todays = state.logs.filter(function (l) { return l.date === d; });
    if (!todays.length) html += '<div class="empty">Nenhuma questão registrada hoje ainda.</div>';
    else {
      html += '<div class="row between"><span class="big">' + tot.f + '</span><span class="chip">' + fmtPct(tot.pct) + ' de acerto</span></div>';
      todays.slice().reverse().forEach(function (l) {
        html += '<div class="item"><div class="top"><div><b>' + esc(l.materia) + '</b><div class="meta">' + (l.assunto ? esc(l.assunto) + ' · ' : '') +
          l.acertos + ' de ' + l.feitas + ' (' + fmtPct(100 * l.acertos / l.feitas) + ')</div></div>' +
          '<button class="btn sm ghost" data-act="delLog" data-id="' + l.id + '" aria-label="Apagar registro">Apagar</button></div></div>';
      });
    }
    html += '</section><section class="card"><h2>Últimos 7 dias</h2>';
    var any = false;
    for (var i = 0; i < 7; i++) {
      var day = addDays(d, -i), a = agg(day, day);
      if (a.f) { any = true; html += '<div class="item"><div class="top"><span>' + esc(cap(DOW[parse(day).getDay()])) + ', ' + fmtDateShort(day) + '</span><span><b>' + a.f + '</b> questões · ' + fmtPct(a.pct) + '</span></div></div>'; }
    }
    if (!any) html += '<div class="empty">Sem registros nos últimos 7 dias.</div>';
    return html + '</section>';
  }

  function renderErros() {
    var html = '<h1>Caderno de erros</h1>';
    html += '<section class="card"><h2>Novo erro</h2><form id="errForm">' +
      '<label for="em">Matéria</label><select id="em">' + MATERIAS.map(function (m) { return '<option' + (m === ui.lastMateria ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('') + '</select>' +
      '<label for="ea">Assunto</label><input id="ea" list="assuntos2" placeholder="Ex.: Crimes contra a Pessoa" autocomplete="off" required>' +
      '<datalist id="assuntos2">' + ASSUNTOS.map(function (a) { return '<option value="' + esc(a) + '">'; }).join('') + '</datalist>' +
      '<label for="eo">Por que errou?</label><select id="eo">' + MOTIVOS.map(function (m) { return '<option>' + esc(m) + '</option>'; }).join('') + '</select>' +
      '<label for="er">Regra certa, em uma linha</label><textarea id="er" required placeholder="Ex.: Homicídio qualificado exige..."></textarea>' +
      '<button class="btn accent block" type="submit" style="margin-top:14px">Guardar erro</button></form>' +
      '<p class="muted" style="margin:10px 0 0"><small>Cada erro volta para revisão em 1, 7 e 30 dias na aba Hoje.</small></p></section>';
    var errs = state.errors;
    if (errs.length) {
      var counts = {};
      errs.forEach(function (e) { counts[e.motivo] = (counts[e.motivo] || 0) + 1; });
      var max = Math.max.apply(null, Object.keys(counts).map(function (k) { return counts[k]; }));
      html += '<section class="card"><h2>Por motivo</h2><div class="bars">' + Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).map(function (k) {
        return '<div class="bar"><span>' + esc(k) + '</span><span><i style="width:' + Math.round(100 * counts[k] / max) + '%"></i></span><b>' + counts[k] + '</b></div>';
      }).join('') + '</div></section>';
    }
    html += '<section class="card"><div class="row between"><h2 style="margin:0">Meus erros (' + errs.length + ')</h2></div>' +
      '<label for="ef">Filtrar</label><select id="ef"><option value="">Todas as matérias</option>' + MATERIAS.map(function (m) { return '<option' + (ui.errFilter === m ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('') + '</select>';
    var list = errs.filter(function (e) { return !ui.errFilter || e.materia === ui.errFilter; }).slice().reverse();
    if (!list.length) html += '<div class="empty">Nenhum erro guardado ainda. Comece com os de Teoria do Crime e Crimes contra a Pessoa.</div>';
    list.forEach(function (e) {
      var t = today();
      html += '<div class="item"><div class="top"><div><b>' + esc(e.assunto) + '</b><div class="meta">' + esc(e.materia) + ' · ' + fmtDateShort(e.date) + ' · <span class="pill bad">' + esc(e.motivo) + '</span></div></div>' +
        '<button class="btn sm ghost" data-act="delErr" data-id="' + e.id + '" aria-label="Apagar erro">Apagar</button></div><div class="rule">' + esc(e.regra) + '</div><div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' +
        [1, 7, 30].map(function (k) {
          var due = addDays(e.date, k), cls = e.rev[k] ? 'ok' : (due <= t ? 'bad' : '');
          return '<span class="pill ' + cls + '">D' + k + (e.rev[k] ? ' revisado' : ' · ' + fmtDateShort(due)) + '</span>';
        }).join('') + '</div></div>';
    });
    return html + '</section>';
  }

  function chartSvg() {
    var W = 340, H = 170, L = 34, R = 10, T = 12, B = 26, pts = [], i;
    var end = today();
    for (i = 7; i >= 0; i--) {
      var e = addDays(end, -7 * i), s = addDays(e, -6), a = agg(s, e);
      pts.push({ x: 7 - i, pct: a.pct, tgt: target(e), label: fmtDateShort(e) });
    }
    var minY = 40, maxY = 100;
    var X = function (n) { return L + (W - L - R) * n / 7; };
    var Y = function (v) { return T + (H - T - B) * (1 - (Math.max(minY, Math.min(maxY, v)) - minY) / (maxY - minY)); };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Taxa de acerto por semana comparada com a meta">';
    [40, 60, 80, 100].forEach(function (v) {
      svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="var(--line)" stroke-width="1"/><text x="' + (L - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="10" fill="var(--muted)">' + v + '%</text>';
    });
    svg += '<polyline fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="5 4" points="' + pts.map(function (p) { return X(p.x) + ',' + Y(p.tgt); }).join(' ') + '"/>';
    var seg = [], lines = [];
    pts.forEach(function (p) {
      if (p.pct == null) { if (seg.length) { lines.push(seg); seg = []; } } else seg.push(p);
    });
    if (seg.length) lines.push(seg);
    lines.forEach(function (l) {
      if (l.length > 1) svg += '<polyline fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="' + l.map(function (p) { return X(p.x) + ',' + Y(p.pct); }).join(' ') + '"/>';
    });
    pts.forEach(function (p) {
      if (p.pct != null) svg += '<circle cx="' + X(p.x) + '" cy="' + Y(p.pct) + '" r="4.5" fill="var(--accent)" stroke="var(--card)" stroke-width="2"/>';
    });
    [0, 2, 4, 6, 7].forEach(function (n) {
      svg += '<text x="' + X(n) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="var(--muted)">' + pts[n].label + '</text>';
    });
    return svg + '</svg>';
  }

  function renderEvolucao() {
    var t = today(), a30 = agg(addDays(t, -29), t), a7 = agg(addDays(t, -6), t), tg = target(t);
    var shown = a30.pct != null ? a30.pct : 61.6;
    var html = '<h1>Evolução</h1><section class="card"><div class="row between" style="align-items:flex-end"><div><small>Taxa dos últimos 30 dias</small><div class="big">' + (a30.pct != null ? fmtPct(a30.pct) : '61,6%') + '</div></div>' +
      '<div style="text-align:right"><small>Meta de hoje</small><div style="font-size:24px;font-weight:800">' + fmtPct(tg) + '</div></div></div>';
    html += '<div class="meter" role="img" aria-label="Progresso até 80%"><i style="width:' + Math.min(100, shown) + '%"></i><b style="left:calc(' + Math.min(100, tg) + '% - 1px)"></b></div>' +
      '<div class="meter-legend"><span>0%</span><span>barra = você · traço = meta de hoje</span><span>100%</span></div>';
    html += '<p class="muted" style="margin:10px 0 0"><small>' + (a30.pct == null
      ? 'Sem registros ainda. O 61,6% é a base de agosto a outubro. Registre questões para começar a curva.'
      : (shown >= tg ? 'Você está na meta ou acima dela. Segure o ritmo.' : 'Faltam ' + fmtPct(tg - shown).replace('%', ' ponto(s) percentual(is)') + ' para a meta de hoje.')) + '</small></p></section>';
    html += '<div class="chips"><span class="chip">7 dias: ' + a7.f + ' questões · ' + fmtPct(a7.pct) + '</span><span class="chip">30 dias: ' + a30.f + ' questões</span></div>';
    html += '<section class="card"><h2>Semana a semana</h2>' + chartSvg() + '<small>Linha cheia: seus acertos. Tracejada: meta.</small></section>';
    html += '<section class="card"><h2>Marcos da meta</h2>';
    MILE_LABELS.forEach(function (m) {
      var ok = a30.pct != null && a30.pct >= m[1];
      html += '<div class="item"><div class="top"><span>' + m[0] + ': <b>' + m[1] + '%</b></span><span class="pill ' + (ok ? 'ok' : '') + '">' + (ok ? 'alcançado' : 'a caminho') + '</span></div></div>';
    });
    html += '</section>';
    var rows = MATERIAS.map(function (m) {
      var x = agg(addDays(t, -29), t, function (l) { return l.materia === m; });
      var b = BASE[m] || [0, 0];
      return { m: m, f: x.f, a: x.a, pct: x.pct, bf: b[0], bp: b[0] ? 100 * b[1] / b[0] : null, err: x.f - x.a, berr: b[0] - b[1] };
    }).sort(function (p, q) { return (q.f ? q.err : q.berr / 3) - (p.f ? p.err : p.berr / 3); });
    html += '<section class="card"><h2>Por matéria</h2><table><thead><tr><th>Matéria</th><th class="num">30 dias</th><th class="num">Base ago–out</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr><td>' + esc(r.m) + '</td><td class="num' + (r.f && r.f < 20 ? ' lowsample' : '') + '">' + (r.f ? fmtPct(r.pct) + '<br><small>' + r.f + ' q' + (r.f < 20 ? ' · poucas' : '') + '</small>' : '–') +
        '</td><td class="num">' + (r.bf ? fmtPct(r.bp) + '<br><small>' + r.bf + ' q' + (r.bf < 20 ? ' · poucas' : '') + '</small>' : '–') + '</td></tr>';
    });
    return html + '</tbody></table><p class="muted" style="margin:10px 0 0"><small>Ordenado por onde há mais erros. Com menos de 20 questões a taxa ainda não diz muito.</small></p></section>';
  }

  function weeklySummary() {
    var end = today(), start = addDays(end, -6), i, lines = [];
    var first = state.settings.startDate || start;
    if (first > start) start = first;
    var nDays = Math.round((parse(end) - parse(start)) / 864e5) + 1;
    var cumpridos = 0, totalT = 0, doneT = 0, rest = 0, energias = [], notas = [];
    for (i = 0; i < nDays; i++) {
      var day = addDays(start, i), min = !!state.minimal[day], tasks = tasksFor(day, min);
      totalT += tasks.length;
      tasks.forEach(function (t) { if (isChecked(day, t.id)) doneT++; });
      if (coreDone(day)) cumpridos++;
      if (isChecked(day, 'descanso')) rest++;
      var c = state.closes[day];
      if (c && c.energia) energias.push(c.energia);
      if (c && c.nota) notas.push(fmtDateShort(day) + ': ' + c.nota.slice(0, 160));
    }
    var a7 = agg(start, end), a30 = agg(addDays(end, -29), end), tg = target(end);
    lines.push('RESUMO DA SEMANA (' + fmtDateShort(start) + ' a ' + fmtDateShort(end) + ')');
    lines.push('Dias com o essencial cumprido: ' + cumpridos + ' de ' + nDays + ' · tarefas feitas: ' + doneT + ' de ' + totalT + ' · sequência atual: ' + streak() + ' dia(s)');
    lines.push('Modo mínimo usado em ' + Object.keys(state.minimal).filter(function (k) { return state.minimal[k] && k >= start && k <= end; }).length + ' dia(s)');
    lines.push('Questões na semana: ' + a7.f + ' · acerto: ' + fmtPct(a7.pct) + ' · 30 dias: ' + fmtPct(a30.pct) + ' · meta de hoje: ' + fmtPct(tg));
    lines.push('');
    lines.push('Por matéria (7 dias):');
    var byM = MATERIAS.map(function (m) {
      var x = agg(start, end, function (l) { return l.materia === m; });
      return { m: m, f: x.f, a: x.a };
    }).filter(function (r) { return r.f; }).sort(function (p, q) { return (q.f - q.a) - (p.f - p.a); });
    if (!byM.length) lines.push('- sem registros');
    byM.forEach(function (r) { lines.push('- ' + r.m + ': ' + r.a + '/' + r.f + ' (' + fmtPct(100 * r.a / r.f) + ')'); });
    var bySub = {};
    state.logs.forEach(function (l) {
      if (l.date >= start && l.date <= end && l.assunto) {
        var k = l.materia + ' > ' + l.assunto; bySub[k] = bySub[k] || { f: 0, a: 0 }; bySub[k].f += l.feitas; bySub[k].a += l.acertos;
      }
    });
    var subs = Object.keys(bySub);
    if (subs.length) {
      lines.push('');
      lines.push('Por assunto (7 dias, pior primeiro):');
      subs.sort(function (p, q) { return bySub[p].a / bySub[p].f - bySub[q].a / bySub[q].f; }).slice(0, 8).forEach(function (k) {
        lines.push('- ' + k + ': ' + bySub[k].a + '/' + bySub[k].f + ' (' + fmtPct(100 * bySub[k].a / bySub[k].f) + ')');
      });
    }
    var newErr = state.errors.filter(function (e) { return e.date >= start && e.date <= end; });
    var motivos = {};
    newErr.forEach(function (e) { motivos[e.motivo] = (motivos[e.motivo] || 0) + 1; });
    lines.push('');
    lines.push('Caderno de erros: ' + newErr.length + ' novos na semana, ' + state.errors.length + ' no total');
    Object.keys(motivos).forEach(function (k) { lines.push('- ' + k + ': ' + motivos[k]); });
    var due = dueReviews();
    lines.push('Revisões pendentes: ' + due.length + ' (atrasadas: ' + due.filter(function (r) { return r.late; }).length + ')');
    lines.push('');
    lines.push('Energia média (1 a 5): ' + (energias.length ? (energias.reduce(function (s, v) { return s + v; }, 0) / energias.length).toFixed(1).replace('.', ',') : 'sem registro') + ' · descanso protegido cumprido: ' + rest + ' vez(es)');
    if (notas.length) { lines.push('Notas:'); notas.forEach(function (n) { lines.push('- ' + n); }); }
    return lines.join('\n');
  }

  function renderMais() {
    var id = state.settings.oneSignalAppId;
    var html = '<h1>Mais</h1>';
    html += '<section class="card"><h2>Resumo da semana</h2><p class="muted">Gere o texto e cole no chat com o Claude no sábado, às 9h.</p>' +
      '<button class="btn accent block" data-act="genSummary">Gerar resumo</button>';
    if (ui.summary) html += '<textarea id="sumOut" class="mono" readonly rows="14" style="margin-top:12px">' + esc(ui.summary) + '</textarea><button class="btn block" data-act="copySummary" style="margin-top:10px">Copiar resumo</button>';
    html += '</section>';
    html += '<section class="card"><h2>Notificações</h2><p class="muted">Funcionam depois que o app for instalado na tela inicial e o OneSignal estiver configurado (veja o LEIA-ME).</p>' +
      '<label for="osid">ID do app no OneSignal</label><input id="osid" value="' + esc(id) + '" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autocomplete="off" autocapitalize="off">' +
      '<div class="grid2" style="margin-top:10px"><button class="btn ghost" data-act="saveAppId">Salvar ID</button><button class="btn accent" data-act="enablePush">Ativar avisos</button></div>' +
      '<p id="pushStatus" class="muted" style="margin:10px 0 0"><small>' + esc(ui.pushStatus || (id ? 'ID salvo. Toque em "Ativar avisos".' : 'Cole o ID do OneSignal para começar.')) + '</small></p></section>';
    html += '<section class="card"><h2>Backup</h2><p class="muted">Os dados ficam só neste aparelho. Copie o backup de vez em quando e guarde nas suas notas.</p>' +
      '<div class="grid2"><button class="btn ghost" data-act="copyBackup">Copiar backup</button><button class="btn ghost" data-act="downloadBackup">Baixar arquivo</button></div>' +
      '<label for="restoreBox">Restaurar a partir de um backup</label><textarea id="restoreBox" class="mono" placeholder="Cole aqui o texto do backup"></textarea>' +
      '<button class="btn block" data-act="restoreBackup" style="margin-top:10px">Restaurar</button></section>';
    return html + '<p class="muted" style="text-align:center"><small>Rota PCMG · versão 1</small></p>';
  }

  var ICONS = {
    hoje: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    questoes: '<path d="M5 6h14M5 12h14M5 18h9"/>',
    erros: '<path d="M6 4h12v16H6z"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/>',
    evolucao: '<path d="M4 19V5M4 19h16"/><path d="M8 15l3-4 3 2 5-7"/>',
    mais: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'
  };
  var TABS = [['hoje', 'Hoje'], ['questoes', 'Questões'], ['erros', 'Erros'], ['evolucao', 'Evolução'], ['mais', 'Mais']];

  function render() {
    var fn = { hoje: renderHoje, questoes: renderQuestoes, erros: renderErros, evolucao: renderEvolucao, mais: renderMais }[ui.tab];
    var scroll = window.scrollY;
    $('#app').innerHTML = fn();
    $('#nav').innerHTML = TABS.map(function (t) {
      return '<button class="tab" data-act="tab" data-tab="' + t[0] + '"' + (ui.tab === t[0] ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[t[0]] + '</svg>' + t[1] + '</button>';
    }).join('');
    window.scrollTo(0, scroll);
  }

  var toastTimer;
  function toast(msg) {
    var el = $('#toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta); return ok;
  }

  /* ---------- OneSignal ---------- */
  var osLoaded = false;
  function initOneSignal() {
    var id = state.settings.oneSignalAppId;
    if (!id || osLoaded) return;
    osLoaded = true;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    var s = document.createElement('script');
    s.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'; s.defer = true;
    s.onerror = function () { ui.pushStatus = 'Não consegui carregar o OneSignal. Confira a internet.'; };
    document.head.appendChild(s);
    window.OneSignalDeferred.push(function (OneSignal) {
      var base = location.pathname.replace(/[^\/]*$/, '');   // funciona na raiz (Netlify) e em subpasta (GitHub Pages)
      return OneSignal.init({
        appId: id, serviceWorkerPath: base.slice(1) + 'sw.js', serviceWorkerParam: { scope: base },
        notifyButton: { enable: false }, allowLocalhostAsSecureOrigin: true
      }).then(function () { window._os = OneSignal; });
    });
  }
  function pushNow() {
    if (!state.settings.oneSignalAppId) { setPush('Cole e salve o ID do OneSignal primeiro.'); return; }
    initOneSignal();
    var tries = 0;
    (function wait() {
      if (window._os) {
        Promise.resolve(window._os.Notifications.requestPermission()).then(function () {
          var granted = window._os.Notifications.permission;
          setPush(granted ? 'Avisos ativados neste aparelho.' : 'Permissão não concedida. No iPhone: Ajustes > Notificações > Rota PCMG.');
        }).catch(function () { setPush('Não foi possível pedir a permissão. Abra o app pelo ícone da tela inicial.'); });
      } else if (++tries < 30) setTimeout(wait, 300);
      else setPush('O OneSignal não respondeu. Abra o app pelo ícone da tela inicial e confira o ID.');
    })();
  }
  function setPush(t) { ui.pushStatus = t; var el = $('#pushStatus'); if (el) el.innerHTML = '<small>' + esc(t) + '</small>'; }

  /* ---------- ações ---------- */
  function backupText() { return JSON.stringify(state); }

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act'), d = today();
    if (act === 'tab') { ui.tab = el.getAttribute('data-tab'); render(); window.scrollTo(0, 0); return; }
    if (act === 'toggle') {
      var id = el.getAttribute('data-id');
      state.checks[d] = state.checks[d] || {};
      state.checks[d][id] = !state.checks[d][id];
      save(); render(); return;
    }
    if (act === 'minimal') { state.minimal[d] = !state.minimal[d]; save(); render(); return; }
    if (act === 'dismissInstall') { state.settings.installDismissed = true; save(); render(); return; }
    if (act === 'energy') {
      var c = state.closes[d] || (state.closes[d] = {});
      var n = $('#nota'); if (n) c.nota = n.value;
      c.energia = Number(el.getAttribute('data-v')); save(); render(); return;
    }
    if (act === 'closeDay') {
      var cc = state.closes[d] || (state.closes[d] = {});
      var nt = $('#nota'); cc.nota = nt ? nt.value.trim() : cc.nota;
      var now = new Date(); cc.saved = pad(now.getHours()) + ':' + pad(now.getMinutes());
      save(); render(); toast('Dia fechado. Bom descanso.'); return;
    }
    if (act === 'reviewDone') {
      var e = state.errors.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
      if (e) { e.rev[el.getAttribute('data-k')] = true; save(); render(); }
      return;
    }
    if (act === 'delLog') { state.logs = state.logs.filter(function (l) { return l.id !== el.getAttribute('data-id'); }); save(); render(); return; }
    if (act === 'delErr') {
      if (window.confirm('Apagar este erro do caderno?')) { state.errors = state.errors.filter(function (x) { return x.id !== el.getAttribute('data-id'); }); save(); render(); }
      return;
    }
    if (act === 'genSummary') { ui.summary = weeklySummary(); render(); return; }
    if (act === 'copySummary') { copyText(ui.summary).then(function (ok) { toast(ok ? 'Resumo copiado. Cole no chat.' : 'Não consegui copiar. Selecione o texto e copie.'); }); return; }
    if (act === 'copyBackup') { copyText(backupText()).then(function (ok) { toast(ok ? 'Backup copiado. Guarde nas suas notas.' : 'Não consegui copiar o backup.'); }); return; }
    if (act === 'downloadBackup') {
      var blob = new Blob([backupText()], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'rota-pcmg-backup-' + d + '.json'; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000); return;
    }
    if (act === 'restoreBackup') {
      var box = $('#restoreBox'), txt = box ? box.value.trim() : '';
      if (!txt) { toast('Cole o texto do backup primeiro.'); return; }
      try {
        var parsed = JSON.parse(txt);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.logs) || !Array.isArray(parsed.errors)) throw new Error('formato');
        if (!window.confirm('Isso substitui os dados atuais deste aparelho. Continuar?')) return;
        var base = defaults(); state = Object.assign(base, parsed); state.settings = Object.assign(base.settings, parsed.settings || {});
        save(); render(); toast('Backup restaurado.');
      } catch (err) { toast('Esse texto não parece um backup válido.'); }
      return;
    }
    if (act === 'saveAppId') {
      var inp = $('#osid'); state.settings.oneSignalAppId = inp ? inp.value.trim() : '';
      save(); setPush(state.settings.oneSignalAppId ? 'ID salvo. Toque em "Ativar avisos".' : 'ID removido.'); initOneSignal(); return;
    }
    if (act === 'enablePush') {
      var i2 = $('#osid'); if (i2 && i2.value.trim() && i2.value.trim() !== state.settings.oneSignalAppId) { state.settings.oneSignalAppId = i2.value.trim(); save(); }
      pushNow(); return;
    }
  });

  document.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = ev.target;
    if (f.id === 'logForm') {
      var feitas = parseInt($('#lf').value, 10), acertos = parseInt($('#lc').value, 10);
      if (!(feitas > 0) || !(acertos >= 0) || acertos > feitas) { toast('Confira os números: acertos não podem passar de feitas.'); return; }
      ui.lastMateria = $('#lm').value;
      state.logs.push({ id: uid(), date: $('#ld').value || today(), materia: ui.lastMateria, assunto: $('#la').value.trim(), feitas: feitas, acertos: acertos });
      save(); render(); toast('Registrado: ' + acertos + ' de ' + feitas + '.');
    } else if (f.id === 'errForm') {
      ui.lastMateria = $('#em').value;
      state.errors.push({ id: uid(), date: today(), materia: ui.lastMateria, assunto: $('#ea').value.trim(), motivo: $('#eo').value, regra: $('#er').value.trim(), rev: { 1: false, 7: false, 30: false } });
      save(); render(); toast('Erro guardado. Volta para revisão amanhã.');
    }
  });

  document.addEventListener('change', function (ev) {
    if (ev.target.id === 'ef') { ui.errFilter = ev.target.value; render(); }
  });

  /* ---------- início ---------- */
  render();
  initOneSignal();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* sem offline */ }); });
  }
  var shownDate = today();
  document.addEventListener('visibilitychange', function () {
    // só redesenha quando o dia virou, para não apagar o que você está digitando
    if (!document.hidden && today() !== shownDate) { shownDate = today(); render(); }
  });
  window.__rota = { state: function () { return state; }, tasksFor: tasksFor, weeklySummary: weeklySummary, target: target, agg: agg, render: render, ui: ui, today: today, streak: streak };
})();
