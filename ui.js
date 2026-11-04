// HALO LINK — 画面（タイトル・ホーム・ステージ・パック・デッキ・図鑑・結果）
'use strict';
const UI = (() => {
  let cur = 'title';
  const IMG_PRELOAD = ['bg_home', 'bg_gacha', 'bg_battle', 'k_mika', 'k_hina', 'k_miyako', 'g_atk', 'g_def'];

  // ---------- 画面の切り替え ----------
  async function go(id, arg) {
    if (id === cur && id !== 'battle') return;
    await Wipe.play(() => {
      document.querySelectorAll('.scr').forEach(s => s.classList.toggle('on', s.id === id));
      cur = id; document.body.dataset.scr = id;
      $('nav').classList.toggle('hide', id === 'battle' || id === 'title');
      document.querySelectorAll('#nav [data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === id));
      if (id === 'home') home();
      if (id === 'stage') stage();
      if (id === 'pack') pack();
      if (id === 'deck') deck();
      if (id === 'book') book();
      if (id === 'battle') Battle.start(arg);
      hud();
      enter(document.getElementById(id));
    });
  }
  // 画面に入るとき、要素を上から順に滑り込ませる
  function enter(root) {
    [...root.querySelectorAll('.in')].slice(0, 14).forEach((e, i) =>
      e.animate([{opacity:0, transform:'translateY(14px)'}, {opacity:1, transform:'none'}], {duration:460, delay:60 + i * 45, easing:'cubic-bezier(.2,.8,.2,1)', fill:'backwards'}));
  }
  function hud() {
    const s = Save.d, wait = Save.freeTick();
    document.querySelectorAll('[data-hud=ticket]').forEach(e => e.textContent = s.ticket);
    document.querySelectorAll('[data-hud=free]').forEach(e => e.textContent = s.free.n);
    document.querySelectorAll('[data-hud=pt]').forEach(e => e.textContent = s.pt);
    const n = s.free.n + s.ticket; const bd = $('navBadge'); bd.textContent = n; bd.classList.toggle('on', n > 0);
    return wait;
  }
  function refresh() { hud(); if (cur === 'pack') pack(); if (cur === 'book') book(); if (cur === 'home') home(); }

  // ---------- タイトル（画像の先読み） ----------
  async function title() {
    const list = [...IMG_PRELOAD, ...Object.keys(CHARS).map(k => 't_' + k)];
    let done = 0;
    await Promise.all(list.map(n => new Promise(r => { const i = new Image(); i.onload = i.onerror = () => { done++; $('tBar').style.transform = `scaleX(${done / list.length})`; r(); }; i.src = n + '.webp'; })));
    $('tStart').classList.add('on');
    $('title').onclick = () => { Sfx.play('ok'); go('home'); };
  }

  // ---------- ホーム ----------
  function home() {
    const s = Save.d, ch = s.partner, pc = CHARS[ch], a = Save.aff(ch);
    const crown = CARDS.find(c => c.ch === ch && c.rar === 4);
    const hasCrown = crown && s.owned[crown.id];
    // ♛を持っていれば、そのメモロビを背景にする
    $('hBg').style.backgroundImage = `url(${hasCrown ? crown.art : 'bg_home'}.webp)`;
    $('home').classList.toggle('lobby', !!hasCrown);
    $('hChar').src = 't_' + ch + '.webp';
    $('hName').innerHTML = `<i style="background:${ATTR[pc.attr].c}"></i>${pc.n}`;
    $('hAff').innerHTML = `<span>好感度</span><b>Lv${a.lv}</b><i><i style="transform:scaleX(${a.lv >= 10 ? 1 : a.exp / Save.affNeed(a.lv)})"></i></i>`;
    $('hPack').classList.toggle('on', s.free.n + s.ticket > 0);
    $('hPackN').textContent = s.free.n + s.ticket;
    const next = STAGES.find(st => !s.cleared[st.id]) || STAGES[STAGES.length - 1];
    $('hNext').textContent = next.id + '　' + next.n;
    setTimeout(talk, 700);
  }
  function talk() {
    const pc = CHARS[Save.d.partner], t = $('hTalk');
    t.querySelector('p').textContent = pc.lines[Math.floor(Math.random() * pc.lines.length)];
    t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
    clearTimeout(talk.t); talk.t = setTimeout(() => t.classList.remove('on'), 4200);
  }

  // ---------- ステージ ----------
  function stage() {
    const s = Save.d;
    $('stList').innerHTML = STAGES.map((st, i) => {
      const open = i === 0 || s.cleared[STAGES[i - 1].id], n = s.cleared[st.id] || 0;
      const faces = [...new Set(st.waves.flat())].slice(0, 3).map(k => `<img src="${ENEMIES[k].img}.webp" alt="" style="${ENEMIES[k].hue ? `filter:hue-rotate(${ENEMIES[k].hue}deg)` : ''}">`).join('');
      return `<button class="st in ${open ? '' : 'lock'} ${st.boss ? 'boss' : ''}" data-st="${i}" ${open ? '' : 'disabled'}>
        <div class="st-no">${st.id}</div><div class="st-body"><b>${st.n}</b>
        <small>${st.waves.length}WAVE ・ ${n ? `クリア${n}回` : `初回報酬：パック券×${st.first.ticket}`}</small></div>
        <div class="st-faces">${faces}</div>${n ? '<span class="st-clr">CLEAR</span>' : ''}${open ? '' : '<span class="st-lock">LOCK</span>'}</button>`;
    }).join('');
    const pc = CHARS[s.partner];
    $('stParty').innerHTML = `<img src="ic_${s.partner}.webp" alt=""><div><small>PARTNER</small><b>${pc.n}</b><p>${pc.passive.txt}</p></div><span class="st-deck">DECK ${s.deck.length}/${DECK_SIZE}</span>`;
  }

  // ---------- パック ----------
  let packTimer = null;
  function pack() {
    const s = Save.d;
    Pack.carousel($('pkView'), cover => { if (Pack.canOpen()) Pack.open(cover).then(hud); else { toast('開けられるパックがありません'); Sfx.play('back'); } });
    $('pkOpen').disabled = !Pack.canOpen();
    $('pkOpen').querySelector('small').textContent = s.free.n > 0 ? `無料 ${s.free.n}/${PACK.freeMax}` : s.ticket > 0 ? `パック券 ${s.ticket}枚` : '開けられるパックがありません';
    clearInterval(packTimer);
    const tick = () => {
      const w = Save.freeTick();
      $('pkTimer').textContent = w ? `次の無料パックまで ${fmt(w)}` : '無料パックは満タンです';
      $('pkOpen').disabled = !Pack.canOpen();
    };
    tick(); packTimer = setInterval(() => { if (cur === 'pack') tick(); else clearInterval(packTimer); }, 1000);
    // 収録率
    const owned = CARDS.filter(c => s.owned[c.id]).length;
    $('pkRate').innerHTML = `<b>${owned}</b>/${CARDS.length} 種類 ・ ポイント ${s.pt}`;
  }
  const fmt = ms => { const t = Math.ceil(ms / 1000), hh = Math.floor(t / 3600), mm = Math.floor(t % 3600 / 60), ss = t % 60; return `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`; };

  // ---------- デッキ ----------
  let deckTab = 'all';
  function deck() {
    const s = Save.d;
    // パートナー
    const chars = Save.ownedChars();
    $('dkPartner').innerHTML = chars.map(ch => `<button class="pp ${ch === s.partner ? 'on' : ''}" data-pp="${ch}" style="--c:${ATTR[CHARS[ch].attr].c}"><img src="ic_${ch}.webp" alt=""><span>Lv${Save.aff(ch).lv}</span></button>`).join('');
    const pc = CHARS[s.partner];
    $('dkPinfo').innerHTML = `<b>${pc.n}</b><p><em>常時</em>${pc.passive.txt}</p><p><em>EX</em>${pc.ex.n}：${pc.ex.txt}</p>`;
    // デッキの中身
    const cnt = {}; s.deck.forEach(id => cnt[id] = (cnt[id] || 0) + 1);
    const ids = Object.keys(cnt).sort((a, b) => cardById(a).c - cardById(b).c || a.localeCompare(b));
    $('dkCount').innerHTML = `<b class="${s.deck.length === DECK_SIZE ? 'ok' : 'ng'}">${s.deck.length}</b>/${DECK_SIZE}`;
    $('dkList').innerHTML = ids.map(id => { const c = cardById(id); return `<button class="dr r${c.rar}" data-rm="${id}" style="--tc:${TYPE[c.t].c}">
      <i class="dr-art" style="background-image:url(${c.art}.webp)"></i><span class="dr-c">${c.c}</span><span class="dr-n">${c.n}</span><span class="dr-x">×${cnt[id]}</span><span class="dr-m">−</span></button>`; }).join('') || '<p class="empty">下のカードをタップして入れてください</p>';
    // 持っているカード
    const tabs = ['all', 'yohei', ...Object.keys(CHARS), 'guest'];
    $('dkTabs').innerHTML = tabs.map(t => `<button class="${t === deckTab ? 'on' : ''}" data-tab="${t}">${t === 'all' ? 'すべて' : chName(t)}</button>`).join('');
    const own = CARDS.filter(c => s.owned[c.id] && (deckTab === 'all' || c.ch === deckTab));
    $('dkOwn').innerHTML = own.map(c => {
      const inD = cnt[c.id] || 0, max = Math.min(s.owned[c.id], copyMax(c));
      return `<div class="dkc ${inD >= max ? 'full' : ''}" data-add="${c.id}">${cardHTML(c.id, {n:s.owned[c.id]})}<span class="dkc-in">${inD ? `デッキ ${inD}` : ''}</span></div>`;
    }).join('');
  }
  function deckAdd(id) {
    const s = Save.d, c = cardById(id), inD = s.deck.filter(x => x === id).length, max = Math.min(s.owned[id] || 0, copyMax(c));
    if (s.deck.length >= DECK_SIZE) { toast('デッキは20枚までです'); Sfx.play('back'); return; }
    if (inD >= max) { toast(inD >= (s.owned[id] || 0) ? '持っている枚数を超えています' : c.rar === 4 ? '♛カードは1枚までです' : `このカードは${copyMax(c)}枚までです`); Sfx.play('back'); return; }
    s.deck.push(id); Save.put(); Sfx.play('ok'); deck();
  }
  function deckRm(id) { const s = Save.d, i = s.deck.lastIndexOf(id); if (i >= 0) s.deck.splice(i, 1); Save.put(); Sfx.play('back'); deck(); }
  // おまかせ：パートナーのカードを優先して、強い順に20枚
  function deckAuto() {
    const s = Save.d, pool = [];
    CARDS.forEach(c => { const n = Math.min(s.owned[c.id] || 0, copyMax(c)); for (let i = 0; i < n; i++) pool.push(c); });
    pool.sort((a, b) => (b.ch === s.partner) - (a.ch === s.partner) || b.rar - a.rar);
    const pick = pool.slice(0, DECK_SIZE);
    // 守りのカードが少なすぎないように整える
    s.deck = pick.map(c => c.id); Save.put(); Sfx.play('ok'); deck(); toast('おまかせで組みました');
  }

  // ---------- 図鑑 ----------
  let bookTab = 'all';
  function book() {
    const s = Save.d;
    const tabs = ['all', 'yohei', ...Object.keys(CHARS), 'guest'];
    $('bkTabs').innerHTML = tabs.map(t => `<button class="${t === bookTab ? 'on' : ''}" data-tab="${t}">${t === 'all' ? 'すべて' : chName(t)}</button>`).join('');
    const list = CARDS.filter(c => bookTab === 'all' || c.ch === bookTab);
    $('bkGrid').innerHTML = list.map(c => `<div class="bkc" data-card="${c.id}">${cardHTML(c.id, {n:s.owned[c.id] || 0, lock:!s.owned[c.id]})}</div>`).join('');
    const owned = CARDS.filter(c => s.owned[c.id]).length;
    $('bkRate').innerHTML = `<b>${owned}</b>/${CARDS.length}　<span>ポイント ${s.pt}</span>`;
  }
  function cardDetail(id) {
    const s = Save.d, c = cardById(id), have = s.owned[id] || 0, cost = PACK.cost[c.rar];
    const ov = $('detail');
    ov.innerHTML = `<div class="dt-bg"></div><div class="dt-card" id="dtCard">${cardHTML(id, {cls:'big', lock:!have})}</div>
      <div class="dt-info"><small>${whoOf(c)} ・ ${TYPE[c.t].n} ・ ${RAR[c.rar]}</small><b>${have ? c.n : '？？？'}</b>
      <p>${have ? fxText(c.fx) : 'パックから入手できます'}</p>
      <div class="dt-btns">${c.rar === 4 && have ? '<button class="btn sub" id="dtLobby">メモロビを見る</button>' : ''}
      <button class="btn ${s.pt >= cost ? 'main' : 'sub'}" id="dtTrade" ${s.pt >= cost ? '' : 'disabled'}>ポイント交換 ${cost}pt</button>
      <button class="btn sub" id="dtClose">閉じる</button></div><span class="dt-have">所持 ${have}</span></div>`;
    ov.classList.add('on'); Sfx.play('flip');
    tilt($('dtCard').firstElementChild);
    $('dtClose').onclick = () => { ov.classList.remove('on'); Sfx.play('back'); };
    $('dtTrade').onclick = () => { if (s.pt < cost) return; s.pt -= cost; s.owned[id] = have + 1; Save.put(); Sfx.play('rare', c.rar); toast(`${c.n} を入手しました`); cardDetail(id); if (cur === 'book') book(); };
    const lb = $('dtLobby'); if (lb) lb.onclick = () => lobby(c);
  }
  // メモロビを全画面で（ゆっくり上下に動く）
  function lobby(c) {
    const ov = $('lobbyView');
    ov.innerHTML = `${c.vid ? `<video class="lv-vid" src="${c.vid}.mp4" poster="${c.art}.webp" autoplay muted playsinline loop></video>` : `<div class="lv-img" style="background-image:url(${c.art}.webp)"></div>`}<div class="lv-cap"><small>${whoOf(c)}</small><b>${c.n}</b></div><p class="lv-tip">タップで閉じる</p>`;
    ov.classList.add('on'); const v = ov.querySelector('video'); if (v) v.play().catch(() => {}); ov.onclick = () => { ov.classList.remove('on'); ov.innerHTML = ''; };
  }

  // ---------- 結果 ----------
  function result(win, r, retry) {
    const o = $('over');
    let body = '';
    if (win) {
      const pc = CHARS[r.partner];
      const lvTxt = r.up ? `<em class="up">LEVEL UP!</em>` : '';
      body = `<div class="rw-aff"><img src="ic_${r.partner}.webp" alt=""><div><small>${pc.n}の好感度 +${r.aff}</small><b>Lv${r.a1.lv}</b>${lvTxt}<i><i id="rwBar"></i></i></div></div>
        ${r.ticket ? `<div class="rw"><span>パック券</span><b>+${r.ticket}</b><em>初回クリア</em></div>` : ''}
        <div class="rw"><span>パックポイント</span><b>+${r.pt}</b></div>`;
    }
    o.innerHTML = `<div class="ov ${win ? 'win' : 'lose'}"><h2>${win ? 'VICTORY' : 'DEFEAT'}</h2>${win ? body : '<p>耀平は倒れてしまった</p>'}
      <div class="ov-btns"><button class="btn main" data-r>${win ? 'もう一度' : 'やり直す'}</button><button class="btn sub" data-h>${win ? 'ステージへ' : 'もどる'}</button></div></div>`;
    o.classList.add('on');
    if (win) { const a = r.a1, w = a.lv >= 10 ? 1 : a.exp / Save.affNeed(a.lv); requestAnimationFrame(() => setTimeout(() => $('rwBar').style.transform = `scaleX(${w})`, 300)); }
    o.querySelector('[data-r]').onclick = () => { o.classList.remove('on'); retry(); };
    o.querySelector('[data-h]').onclick = () => { o.classList.remove('on'); go('stage'); };
  }

  // ---------- つなぎこみ ----------
  function init() {
    $('nav').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { Sfx.play('tap'); go(b.dataset.go); } });
    $('hChar').onclick = () => { talk(); Sfx.play('tap'); const el = $('hChar'); el.classList.remove('poke'); void el.offsetWidth; el.classList.add('poke'); };
    $('hGo').onclick = () => { Sfx.play('ok'); go('stage'); };
    $('hPack').onclick = () => { Sfx.play('ok'); go('pack'); };
    $('stList').addEventListener('click', e => {
      const b = e.target.closest('[data-st]'); if (!b) return;
      if (Save.d.deck.length !== DECK_SIZE) { toast(`デッキを${DECK_SIZE}枚にしてください`); go('deck'); return; }
      Sfx.play('ok'); go('battle', STAGES[+b.dataset.st]);
    });
    $('stEdit').onclick = () => go('deck');
    $('pkOpen').onclick = () => { const c = $('pkView').querySelector('.pc-item.cur'); if (Pack.canOpen()) Pack.open(Pack.COVERS[c ? +c.dataset.i : 0]).then(hud); };
    $('dkPartner').addEventListener('click', e => { const b = e.target.closest('[data-pp]'); if (!b) return; Save.d.partner = b.dataset.pp; Save.put(); Sfx.play('ok'); deck(); });
    $('dkList').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) deckRm(b.dataset.rm); });
    $('dkOwn').addEventListener('click', e => { const b = e.target.closest('[data-add]'); if (b) deckAdd(b.dataset.add); });
    $('dkTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { deckTab = b.dataset.tab; deck(); } });
    $('dkAuto').onclick = deckAuto;
    $('bkTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { bookTab = b.dataset.tab; book(); } });
    $('bkGrid').addEventListener('click', e => { const b = e.target.closest('[data-card]'); if (b) cardDetail(b.dataset.card); });
    // 押したときの音と振動
    document.addEventListener('pointerdown', e => { const b = e.target.closest('button,.dkc,.bkc'); if (b && !b.disabled) { b.classList.add('prs'); setTimeout(() => b.classList.remove('prs'), 140); } }, {passive:true});
    Battle.init();
    title();
  }
  return { init, go, refresh, result, hud, detail:cardDetail };
})();
UI.init();
