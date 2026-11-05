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
      $('nav').classList.toggle('hide', id === 'battle' || id === 'title' || id === 'map');
      document.querySelectorAll('#nav [data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === id));
      if (id === 'home') home();
      if (id === 'stage') stage();
      if (id === 'pack') pack();
      if (id === 'deck') deck();
      if (id === 'book') book();
      if (id === 'map') Run.paintMap();
      if (id === 'battle' && typeof arg === 'function') arg();
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
  // タップはすぐ受け付ける。先読みは裏で続け、最長2.5秒で「TAP TO START」を出す
  function title() {
    let started = false;
    const start = () => { if (started) return; started = true; try { Sfx.play('ok'); } catch (e) {} go('home'); };
    $('title').addEventListener('click', start);
    $('title').addEventListener('touchend', e => { e.preventDefault(); start(); });
    const show = () => $('tStart').classList.add('on');
    setTimeout(show, 2500);
    const list = IMG_PRELOAD.slice(0, 4);
    let done = 0;
    list.forEach(n => { const i = new Image(); i.onload = i.onerror = () => { done++; $('tBar').style.transform = `scaleX(${done / list.length})`; if (done === list.length) show(); }; i.src = n + '.webp'; });
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
    $('hNext').textContent = s.run ? `挑戦の続き（${DIFF[s.run.diff].n}・${s.run.layer + 2}層目）` : '作戦を選んで出撃';
    setTimeout(talk, 700);
  }
  function talk() {
    const pc = CHARS[Save.d.partner], t = $('hTalk');
    t.querySelector('p').textContent = pc.lines[Math.floor(Math.random() * pc.lines.length)];
    t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
    clearTimeout(talk.t); talk.t = setTimeout(() => t.classList.remove('on'), 4200);
  }

  // ---------- 作戦（難易度・編成・特性・掃討） ----------
  let diffSel = 0;
  function stage() {
    const s = Save.d;
    $('stDiff').innerHTML = DIFF.map((d, i) => {
      const open = i === 0 || s.cleared['run_' + DIFF[i - 1].id], best = s.bestRank && s.bestRank[d.id];
      return `<button class="df ${i === diffSel ? 'on' : ''} ${open ? '' : 'lock'}" data-df="${i}" ${open ? '' : 'disabled'}><b>${d.n}</b><small>敵HP×${d.hp} ・ 攻撃×${d.atk}</small>${best ? `<em class="rk r${best}">${best}</em>` : ''}${open ? '' : '<span>LOCK</span>'}</button>`;
    }).join('');
    const d = DIFF[diffSel];
    $('stInfo').innerHTML = `<p>マップを進み、最後のボスを倒すとクリア。ボスはシールドを割らないと、カウント${d.count}で全員に大ダメージ。</p>
      <div class="st-rw"><span>クリア報酬</span><b>記章 ${d.badge}〜${d.badge * 2}</b><b>パック券 ${d.ticket}〜${d.ticket + 1}</b></div>`;
    const team = s.team.map(id => `<div class="tm"><img src="s_${id}_aim.webp" alt=""><span style="--c:${TAG[PARTY_DEF[id].tag].c}">${TAG[PARTY_DEF[id].tag].n}</span><b>${CHARS[id].n}</b></div>`).join('');
    $('stParty').innerHTML = `<div class="tms">${team}</div>`;
    $('stGo').innerHTML = s.run ? `<b>続きから</b><small>${DIFF[s.run.diff].n}・${s.run.layer + 2}層目</small>` : `<b>出撃</b><small>${d.n}</small>`;
    $('stSweep').disabled = !s.cleared['run_' + d.id];
    $('stBadge').textContent = s.badge || 0;
    s.passive = s.passive || {};
    $('stPass').innerHTML = PASSIVES.map(p => `<button class="ps ${s.passive[p.id] ? 'on' : ''}" data-ps="${p.id}"><b>${p.n}</b><small>${p.txt}</small><em>${s.passive[p.id] ? '解放済み' : `記章 ${p.cost}`}</em></button>`).join('');
  }

  // ---------- パック ----------
  let packTimer = null;
  function pack() {
    const s = Save.d;
    Pack.carousel($('pkView'), cover => { if (Pack.canOpen()) Pack.open(cover).then(hud); else { toast('開けられるパックがありません'); Sfx.play('back'); } });
    $('pkOpen').disabled = !Pack.canOpen();
    $('pkOpen').querySelector('small').textContent = PACK.unlimited ? 'テスト中：無制限' : s.free.n > 0 ? `無料 ${s.free.n}/${PACK.freeMax}` : s.ticket > 0 ? `パック券 ${s.ticket}枚` : '開けられるパックがありません';
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

  // ---------- 編成（3人を選ぶ。左が前列） ----------
  function deck() {
    const s = Save.d, chars = Object.keys(PARTY_DEF).filter(ch => CARDS.some(c => c.ch === ch && s.owned[c.id]));
    $('dkTeam').innerHTML = [0, 1, 2].map(i => { const id = s.team[i]; return id ? `<button class="tslot ${i === 0 ? 'f' : ''}" data-ts="${i}"><img src="s_${id}_aim.webp" alt=""><b>${CHARS[id].n}</b><span style="--c:${TAG[PARTY_DEF[id].tag].c}">${TAG[PARTY_DEF[id].tag].n}</span><em>${i === 0 ? '前列' : '後列'}</em></button>` : `<button class="tslot empty" data-ts="${i}">＋</button>`; }).join('');
    // シナジー
    const syn = {}; s.team.forEach(id => { const t = PARTY_DEF[id].tag; syn[t] = (syn[t] || 0) + 1; });
    $('dkSyn').innerHTML = Object.entries(syn).map(([t, n]) => `<span style="--c:${TAG[t].c}" class="${n >= 2 ? 'on' : ''}">${TAG[t].n}×${n}${n >= 2 ? `　ダメージ+${n >= 3 ? 30 : 15}%` : ''}</span>`).join('');
    $('dkPool').innerHTML = chars.map(ch => {
      const p = PARTY_DEF[ch], inT = s.team.includes(ch), a = Save.aff(ch);
      return `<button class="pool ${inT ? 'in' : ''}" data-pool="${ch}"><img src="s_${ch}_aim.webp" alt=""><div><b>${CHARS[ch].n}</b><small><i style="background:${TAG[p.tag].c}"></i>${TAG[p.tag].n} ・ HP${p.hp} ・ 好感度Lv${a.lv}</small><p>EX：${CHARS[ch].ex.n}（${CHARS[ch].ex.txt}）</p></div>${inT ? '<em>編成中</em>' : ''}</button>`;
    }).join('') + '<p class="empty">パックでカードを手に入れた子が、ここに並びます。</p>';
    // 最初のデッキ
    const cnt = {}; Run_starter(s.team).forEach(id => cnt[id] = (cnt[id] || 0) + 1);
    $('dkStart').innerHTML = Object.keys(cnt).map(id => `<div class="dkc">${cardHTML(id, {n:cnt[id]})}</div>`).join('');
  }
  const Run_starter = ids => { const d = []; ids.forEach(ch => { CARDS.filter(c => c.ch === ch && c.rar === 1).forEach(c => d.push(c.id, c.id)); const r2 = CARDS.find(c => c.ch === ch && c.rar === 2); if (r2) d.push(r2.id); }); return d; };
  let slotSel = null;
  function poolTap(ch) {
    const s = Save.d;
    if (s.run) { toast('挑戦中は編成を変えられません（精算すると変えられます）'); return; }
    const at = s.team.indexOf(ch);
    if (at >= 0) { if (slotSel != null && slotSel !== at) { [s.team[slotSel], s.team[at]] = [s.team[at], s.team[slotSel]]; slotSel = null; Save.put(); deck(); } return; }
    const k = slotSel != null ? slotSel : s.team.length < 3 ? s.team.length : 2;
    s.team[k] = ch; slotSel = null; s.partner = s.team[0]; Save.put(); Sfx.play('ok'); deck();
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

  function runResult(r) {
    const o = $('over');
    o.innerHTML = `<div class="ov ${r.win ? 'win' : 'lose'}"><h2>${r.win ? 'CLEAR' : r.settled ? 'SETTLE' : 'FAILED'}</h2>
      ${r.win ? `<div class="rk-big r${r.rank}">${r.rank}<small>RANK</small></div>` : `<p>${r.settled ? 'ここまでの報酬を受け取りました' : '全員倒れてしまった（記章は半分）'}</p>`}
      <div class="rw"><span>記章</span><b>+${r.badge}</b></div>${r.ticket ? `<div class="rw"><span>パック券</span><b>+${r.ticket}</b></div>` : ''}
      <div class="rw-team">${r.ups.map(u => `<div><img src="ic_${u.id}.webp" alt=""><small>好感度 Lv${Save.aff(u.id).lv}</small>${u.up ? '<em>UP!</em>' : ''}</div>`).join('')}</div>
      <div class="ov-btns"><button class="btn main" data-h>作戦へ</button></div></div>`;
    o.classList.add('on'); Sfx.play(r.win ? 'win' : 'lose');
    o.querySelector('[data-h]').onclick = () => { o.classList.remove('on'); go('stage'); };
  }

  // ---------- つなぎこみ ----------
  function init() {
    title();   // 何より先にスタートできるようにする
    const safe = (fn) => { try { fn(); } catch (e) { console.warn(e); } };
    safe(() => Battle.init());
    safe(() => Run.init());
    safe(() => bind());
  }
  function bind() {
    $('nav').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { Sfx.play('tap'); go(b.dataset.go); } });
    $('hChar').onclick = () => { talk(); Sfx.play('tap'); const el = $('hChar'); el.classList.remove('poke'); void el.offsetWidth; el.classList.add('poke'); };
    $('hGo').onclick = () => { Sfx.play('ok'); go('stage'); };
    $('hPack').onclick = () => { Sfx.play('ok'); go('pack'); };
    $('stDiff').addEventListener('click', e => { const b = e.target.closest('[data-df]'); if (!b) return; diffSel = +b.dataset.df; Sfx.play('tap'); stage(); });
    $('stGo').onclick = () => { const s = Save.d; if (s.run) { Sfx.play('ok'); go('map'); return; } if (s.team.length < 3) { toast('3人を編成してください'); go('deck'); return; } Run.begin(diffSel); };
    $('stEdit').onclick = () => go('deck');
    $('stSweep').onclick = () => { Run.sweep(diffSel); stage(); };
    $('stPass').addEventListener('click', e => { const b = e.target.closest('[data-ps]'); if (!b) return; const s = Save.d, p = PASSIVES.find(x => x.id === b.dataset.ps); if (s.passive[p.id]) return; if ((s.badge || 0) < p.cost) { toast('記章が足りません'); Sfx.play('back'); return; } s.badge -= p.cost; s.passive[p.id] = 1; Save.put(); Sfx.play('rare', 3); toast(`${p.n} を解放しました`); stage(); });
    $('pkOpen').onclick = () => { const c = $('pkView').querySelector('.pc-item.cur'); if (Pack.canOpen()) Pack.open(Pack.COVERS[c ? +c.dataset.i : 0]).then(hud); };
    $('dkTeam').addEventListener('click', e => { const b = e.target.closest('[data-ts]'); if (!b) return; slotSel = +b.dataset.ts; Sfx.play('tap'); $('dkTeam').querySelectorAll('.tslot').forEach(x => x.classList.toggle('pick', +x.dataset.ts === slotSel)); toast(slotSel === 0 ? '前列に入れる子を選んでください' : '後列に入れる子を選んでください'); });
    $('dkPool').addEventListener('click', e => { const b = e.target.closest('[data-pool]'); if (b) poolTap(b.dataset.pool); });
    $('bkTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { bookTab = b.dataset.tab; book(); } });
    $('bkGrid').addEventListener('click', e => { const b = e.target.closest('[data-card]'); if (b) cardDetail(b.dataset.card); });
    // 押したときの音と振動
    document.addEventListener('pointerdown', e => { const b = e.target.closest('button,.dkc,.bkc'); if (b && !b.disabled) { b.classList.add('prs'); setTimeout(() => b.classList.remove('prs'), 140); } }, {passive:true});
  }
  return { init, go, refresh, result, hud, detail:cardDetail, runResult };
})();
UI.init();
