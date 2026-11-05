// HALO LINK — 挑戦（マップ・事件・休憩・報酬・精算・掃討）
'use strict';
const Run = (() => {
  const LAYERS = 8;   // 7層＋ボス
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];

  // ---------- 出発：3人とデッキを作る ----------
  function starterDeck(ids) {
    // 1人あたり：◆を各2枚（無ければ1枚）＋◆◆を1枚 → だいたい15枚
    const deck = [];
    ids.forEach(ch => {
      CARDS.filter(c => c.ch === ch && c.rar === 1).forEach(c => deck.push(c.id, c.id));
      const r2 = CARDS.find(c => c.ch === ch && c.rar === 2); if (r2) deck.push(r2.id);
    });
    return deck;
  }
  function makeMap() {
    const map = [];
    for (let l = 0; l < LAYERS; l++) {
      if (l === LAYERS - 1) { map.push([{type:'boss'}]); continue; }
      const n = l === 0 ? 2 : 2 + rnd(2), row = [];
      for (let i = 0; i < n; i++) {
        let t = 'battle';
        const r = Math.random();
        if (l === 0) t = 'battle';
        else if (l === LAYERS - 2) t = 'rest';
        else if (r < .2) t = 'event'; else if (r < .34) t = 'rest'; else if (r < .5 && l >= 3) t = 'elite';
        row.push({type:t});
      }
      map.push(row);
    }
    return map;
  }
  function begin(diff) {
    const s = Save.d, ids = s.team.slice(0, 3);
    s.run = { diff, layer:-1, pos:null, map:makeMap(), deck:starterDeck(ids), badge:0, turns:0, downs:0, cleared:0,
              party:ids.map(id => ({id, hp:PARTY_DEF[id].hp, max:PARTY_DEF[id].hp, ex:0})) };
    Save.put();
    UI.go('map');
  }
  const cur = () => Save.d.run;

  // ---------- マップの表示 ----------
  const ICON = {battle:'⚔', elite:'☠', event:'？', rest:'✚', boss:'♛'};
  const LABEL = {battle:'戦闘', elite:'強敵', event:'事件', rest:'休憩', boss:'ボス'};
  function paintMap() {
    const r = cur(); if (!r) return;
    const d = DIFF[r.diff];
    $('mDiff').textContent = d.n;
    $('mBadge').textContent = r.badge;
    $('mDeck').textContent = r.deck.length;
    $('mParty').innerHTML = r.party.map(m => `<div class="mp ${m.hp <= 0 ? 'down' : ''}"><img src="ic_${m.id}.webp" alt=""><i><i style="transform:scaleX(${m.hp / m.max})"></i></i><span>${m.hp}/${m.max}</span></div>`).join('');
    // 下から上へ進む
    const next = r.layer + 1;
    $('mMap').innerHTML = r.map.map((row, l) => `<div class="mrow ${l === next ? 'next' : l < next ? 'past' : ''}" data-l="${l}">${row.map((n, i) => {
      const can = l === next && (r.pos == null || Math.abs(i / Math.max(1, row.length - 1) - r.pos) <= .6 || row.length === 1);
      const here = l === r.layer && Math.abs(i / Math.max(1, row.length - 1) - r.pos) < .01;
      return `<button class="mn t-${n.type} ${can ? 'can' : ''} ${here ? 'here' : ''} ${n.done ? 'done' : ''}" data-l="${l}" data-i="${i}" ${can ? '' : 'disabled'}><b>${ICON[n.type]}</b><small>${LABEL[n.type]}</small></button>`;
    }).join('')}</div>`).reverse().join('');
    // 次の層が見えるようにスクロール
    requestAnimationFrame(() => { const el = $('mMap').querySelector('.mrow.next'); if (el) el.scrollIntoView({block:'center'}); });
  }
  function onNode(l, i) {
    const r = cur(), row = r.map[l], n = row[i];
    r.layer = l; r.pos = row.length === 1 ? .5 : i / (row.length - 1); r.node = n; n.done = true; Save.put();
    Sfx.play('ok');
    if (n.type === 'battle' || n.type === 'elite' || n.type === 'boss') {
      const tier = n.type === 'boss' ? 'boss' : n.type === 'elite' ? 'elite' : l < 3 ? 'easy' : 'mid';
      UI.go('battle', () => Battle.start(pick(ENC[tier]), r, win => afterBattle(win, n.type)));
    } else if (n.type === 'rest') rest();
    else event();
  }

  // ---------- 戦闘のあと ----------
  async function afterBattle(win, type) {
    const r = cur();
    if (!win) { finish(false); return; }
    r.cleared++;
    r.badge += type === 'boss' ? 0 : type === 'elite' ? 4 : 2;
    Save.put();
    if (type === 'boss') { finish(true); return; }
    await cardReward(type === 'elite' ? 3 : 2);
    UI.go('map');
  }
  // 3枚から1枚選ぶ。パーティの子のカードから。持っているレアほど出やすい
  function rewardPool(minRar) {
    const r = cur(), ids = r.party.map(m => m.id), s = Save.d;
    return CARDS.filter(c => ids.includes(c.ch) && (c.rar <= 2 || s.owned[c.id]) && c.rar >= (minRar || 1));
  }
  function cardReward(weightRare) {
    return new Promise(res => {
      const pool = rewardPool(), opts = [];
      for (let k = 0; k < 3 && pool.length; k++) {
        const w = pool.flatMap(c => Array(c.rar >= 3 ? weightRare : c.rar === 2 ? 2 : 1).fill(c));
        const c = pick(w); opts.push(c.id); pool.splice(pool.indexOf(c), 1);
      }
      const ov = $('rv');
      ov.innerHTML = `<div class="rv-box"><h3>REWARD</h3><p>デッキに加えるカードを1枚選ぶ</p><div class="rv-cards">${opts.map(id => `<div class="rv-c" data-id="${id}">${cardHTML(id)}</div>`).join('')}</div>
        <button class="btn sub" id="rvSkip">選ばない</button></div>`;
      ov.className = 'on';
      ov.querySelector('.rv-cards').onclick = e => { const c = e.target.closest('[data-id]'); if (!c) return; cur().deck.push(c.dataset.id); Save.put(); Sfx.play('ok'); toast(`${cardById(c.dataset.id).n} をデッキに入れました`); ov.className = ''; res(); };
      $('rvSkip').onclick = () => { ov.className = ''; Sfx.play('back'); res(); };
    });
  }

  // ---------- 休憩 ----------
  function rest() {
    const r = cur(), ov = $('rv');
    ov.innerHTML = `<div class="rv-box rest"><h3>REST</h3><p>ひと休みしよう</p>
      <button class="rv-opt" data-o="heal"><b>回復する</b><small>全員のHPを最大の30%回復</small></button>
      <button class="rv-opt" data-o="revive"><b>起こす</b><small>倒れた子をHP50%で復活（いなければ全員HP+5）</small></button>
      <button class="rv-opt" data-o="remove"><b>カードを外す</b><small>デッキからカードを1枚取り除く</small></button></div>`;
    ov.className = 'on';
    ov.onclick = async e => {
      const b = e.target.closest('[data-o]'); if (!b) return; ov.onclick = null;
      const o = b.dataset.o;
      if (o === 'heal') r.party.forEach(m => { if (m.hp > 0) m.hp = Math.min(m.max, m.hp + Math.ceil(m.max * .3)); });
      if (o === 'revive') { const dn = r.party.filter(m => m.hp <= 0); if (dn.length) dn.forEach(m => m.hp = Math.ceil(m.max * .5)); else r.party.forEach(m => m.hp = Math.min(m.max, m.hp + 5)); }
      Sfx.play('heal'); ov.className = ''; Save.put();
      if (o === 'remove') await removeCard();
      UI.go('map'); paintMap();
    };
  }
  function removeCard() {
    return new Promise(res => {
      const r = cur(), ov = $('rv'), cnt = {};
      r.deck.forEach(id => cnt[id] = (cnt[id] || 0) + 1);
      ov.innerHTML = `<div class="rv-box"><h3>REMOVE</h3><p>外すカードを選ぶ</p><div class="rv-grid">${Object.keys(cnt).map(id => `<div class="rv-c" data-id="${id}">${cardHTML(id, {n:cnt[id]})}</div>`).join('')}</div><button class="btn sub" id="rvSkip">やめる</button></div>`;
      ov.className = 'on';
      ov.querySelector('.rv-grid').onclick = e => { const c = e.target.closest('[data-id]'); if (!c) return; r.deck.splice(r.deck.indexOf(c.dataset.id), 1); Save.put(); Sfx.play('back'); ov.className = ''; res(); };
      $('rvSkip').onclick = () => { ov.className = ''; res(); };
    });
  }

  // ---------- 事件 ----------
  function event() {
    const r = cur(), ev = pick(EVENTS), ov = $('rv');
    ov.innerHTML = `<div class="rv-box ev"><h3>EVENT</h3><b class="ev-n">${ev.n}</b><p>${ev.txt}</p>${ev.opts.map((o, i) => `<button class="rv-opt" data-o="${i}"><b>${o.t}</b></button>`).join('')}</div>`;
    ov.className = 'on';
    ov.onclick = async e => {
      const b = e.target.closest('[data-o]'); if (!b) return; ov.onclick = null;
      const fx = ev.opts[+b.dataset.o].fx; ov.className = '';
      if (fx === 'healAll10') { r.party.forEach(m => { if (m.hp > 0) m.hp = Math.min(m.max, m.hp + 10); }); Sfx.play('heal'); }
      if (fx === 'badge3') { r.badge += 3; Sfx.play('coin'); }
      if (fx === 'maxhp4') { r.party.forEach(m => { m.max += 4; if (m.hp > 0) m.hp += 4; }); Sfx.play('ok'); }
      if (fx === 'card') { Save.put(); await cardReward(3); }
      if (fx === 'gamble') {
        if (Math.random() < .5) { const pool = rewardPool(3); if (pool.length) { const c = pick(pool); r.deck.push(c.id); toast(`★ ${c.n} を手に入れた！`); Sfx.play('rare', 3); } else { r.badge += 5; toast('記章+5'); } }
        else { const f = r.party.find(m => m.hp > 0); if (f) f.hp = Math.max(1, f.hp - 10); toast('罠だった… 前列が10ダメージ'); Sfx.play('enemy'); }
      }
      if (fx === 'remove5') { if (r.badge >= 5) { r.badge -= 5; Save.put(); await removeCard(); } else toast('記章が足りません'); }
      Save.put(); UI.go('map'); paintMap();
    };
  }

  // ---------- 終わり（クリア・全滅・精算） ----------
  function finish(win, settled) {
    const s = Save.d, r = cur(), d = DIFF[r.diff];
    let rank = '';
    let badge = r.badge;
    let ticket = 0;
    if (win) {
      rank = r.downs === 0 && r.turns <= 40 ? 'S' : r.downs <= 1 ? 'A' : 'B';
      badge += d.badge * (rank === 'S' ? 2 : rank === 'A' ? 1.5 : 1);
      ticket = d.ticket + (rank === 'S' ? 1 : 0);
      s.cleared['run_' + d.id] = (s.cleared['run_' + d.id] || 0) + 1;
      s.bestRank = s.bestRank || {}; if (!s.bestRank[d.id] || 'SAB'.indexOf(rank) < 'SAB'.indexOf(s.bestRank[d.id])) s.bestRank[d.id] = rank;
    } else if (!settled) badge = Math.floor(badge * .5);
    badge = Math.round(badge);
    s.badge = (s.badge || 0) + badge; s.ticket += ticket;
    const ups = r.party.map(m => ({id:m.id, up:Save.addAff(m.id, win ? 40 : 15)}));
    s.run = null; Save.put();
    UI.runResult({win, settled, rank, badge, ticket, ups, diff:d});
  }
  function settle() { if (!cur()) return; finish(false, true); }
  // 掃討：クリア済みの難易度の基本報酬をすぐもらう
  function sweep(di) {
    const s = Save.d, d = DIFF[di];
    if (!s.cleared['run_' + d.id]) { toast('一度クリアすると掃討できます'); return; }
    s.badge = (s.badge || 0) + d.badge; s.ticket += d.ticket; Save.put();
    Sfx.play('coin'); toast(`掃討完了：記章+${d.badge}、パック券+${d.ticket}`); UI.refresh();
  }
  // 戦闘中のメニュー
  function menu() {
    const ov = $('rv');
    ov.innerHTML = `<div class="rv-box"><h3>MENU</h3><button class="rv-opt" data-o="back"><b>戦闘に戻る</b></button><button class="rv-opt" data-o="settle"><b>精算して終わる</b><small>ここまでの記章を受け取って挑戦を終える</small></button></div>`;
    ov.className = 'on';
    ov.onclick = e => { const b = e.target.closest('[data-o]'); if (!b) return; ov.onclick = null; ov.className = ''; if (b.dataset.o === 'settle') settle(); };
  }

  function init() {
    $('mMap').addEventListener('click', e => { const b = e.target.closest('.mn.can'); if (b) onNode(+b.dataset.l, +b.dataset.i); });
    $('mSettle').onclick = () => { const n = Date.now(); if (n - (init.t || 0) < 2000) settle(); else { init.t = n; toast('もう一度押すと精算して終わります'); } };
    $('mDeckBtn').onclick = () => {
      const r = cur(), cnt = {}; r.deck.forEach(id => cnt[id] = (cnt[id] || 0) + 1);
      const ov = $('rv'); ov.innerHTML = `<div class="rv-box"><h3>DECK</h3><p>${r.deck.length}枚</p><div class="rv-grid">${Object.keys(cnt).map(id => `<div class="rv-c">${cardHTML(id, {n:cnt[id]})}</div>`).join('')}</div><button class="btn sub" id="rvSkip">閉じる</button></div>`;
      ov.className = 'on'; $('rvSkip').onclick = () => ov.className = '';
    };
  }
  return { init, begin, paintMap, settle, sweep, menu, cur };
})();
