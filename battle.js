// HALO LINK — バトル（3人パーティ：前列が攻撃を受ける・交代・倍率・EXでフェーズ終了・シールドとブレイク・ボスのカウント）
'use strict';
const Battle = (() => {
  let B = null;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let uid = 0;
  const has = id => Save.d.passive && Save.d.passive[id];

  // ---------- 開始：enc＝敵の並び、run＝挑戦中の状態（パーティのHP・デッキ）、done＝終わったら呼ぶ ----------
  function start(enc, run, done) {
    const d = DIFF[run.diff];
    B = { run, diff:d, done, enemies:[], block:0, energy:3, maxE:3, st:{str:0, weak:0, vuln:0},
          draw:shuffle(run.deck.map(id => ({id, u:++uid}))), hand:[], disc:[], chain:0, turn:0, busy:true, sel:null, target:null, swapFree:true, downs:0 };
    B.enemies = enc.map((k, i) => {
      const e = ENEMIES[k], hp = Math.round(e.hp * d.hp);
      return {...e, key:k, i, hp, max:hp, block:0, shield:Math.round((e.shield || 0) * d.hp), maxShield:Math.round((e.shield || 0) * d.hp),
              st:{str:0, weak:0, vuln:0, poison:0}, step:0, broken:0, cnt:e.count ? d.count : 0, el:null};
    });
    $('bStage').textContent = `${d.n}　${run.layer + 1}層`;
    $('bWave').textContent = run.node.type === 'boss' ? 'BOSS' : run.node.type === 'elite' ? 'ELITE' : 'BATTLE';
    buildEnemies(); buildParty(); paintAll();
    begin();
  }
  async function begin() {
    const boss = B.enemies.some(e => e.boss);
    await banner(boss ? 'WARNING' : 'BATTLE START', boss);
    if (has('p_block')) gainBlock(6);
    if (has('p_ex')) B.run.party.forEach(m => m.ex = Math.min(EX_GAUGE, m.ex + 1));
    paintParty();
    startTurn();
  }
  const mem = id => B.run.party.find(m => m.id === id);
  const alivePt = () => B.run.party.filter(m => m.hp > 0);
  const front = () => B.run.party[0];

  // ---------- 自分のターン ----------
  async function startTurn() {
    B.turn++; B.busy = true; B.block = 0; B.chain = 0; B.swapFree = true;
    B.energy = B.maxE + (B.turn === 1 && has('p_cost') ? 1 : 0);
    B.enemies.forEach(e => { if (e.hp > 0) e.intent = e.pat[e.step % e.pat.length]; });
    paintEnemies(); paintStatus(); paintParty();
    $('bEnd').classList.remove('on');
    await turnBanner('YOUR TURN');
    await drawCards(5);
    B.busy = false; paintHand(); $('bEnd').classList.add('on');
  }
  async function drawCards(n) {
    for (let i = 0; i < n; i++) {
      if (!B.draw.length) { if (!B.disc.length) break; B.draw = shuffle(B.disc); B.disc = []; }
      if (B.hand.length >= 10) break;
      B.hand.push(B.draw.pop()); Sfx.play('draw'); paintHand(true); await sleep(80);
    }
    paintPiles();
  }

  // ---------- 倍率 ----------
  function synergy(ch) {
    const t = PARTY_DEF[ch]?.tag; if (!t) return 1;
    const n = alivePt().filter(m => PARTY_DEF[m.id].tag === t).length;
    return n >= 3 ? 1.3 : n === 2 ? 1.15 : 1;
  }
  function mults(ch, attr, e) {
    const list = [];
    if (STRONG[attr] === e.attr) list.push(['属性', 1.5]); else if (STRONG[e.attr] === attr && !['light', 'dark'].includes(attr)) list.push(['属性', .75]);
    if (B.chain > 1) list.push(['連携', +(1 + (B.chain - 1) * (has('p_chain') ? .15 : .1)).toFixed(2)]);
    const sy = synergy(ch); if (sy > 1) list.push(['シナジー', sy]);
    if (e.broken) list.push(['BREAK', 1.5]);
    if (e.st.vuln) list.push(['脆弱', 1.5]);
    if (B.st.weak) list.push(['弱体', .75]);
    return list;
  }

  // ---------- カードを使う ----------
  async function play(u, targetEnemy) {
    const k = B.hand.findIndex(x => x.u === u); if (k < 0) return;
    const c = cardById(B.hand[k].id), m = mem(c.ch);
    if (!m || m.hp <= 0) { toast(`${CHARS[c.ch].n}は戦闘不能です`); Sfx.play('back'); return; }
    if (c.c > B.energy) { toast('コストが足りません'); Sfx.play('back'); return; }
    B.busy = true; B.sel = null; closePreview();
    const tg = targetEnemy && targetEnemy.hp > 0 ? targetEnemy : pickTarget();
    B.energy -= c.c; B.chain++;
    const [it] = B.hand.splice(k, 1);
    actor(c.ch, 'aim');
    await flyCard(it, c, tg);
    paintHand(); paintStatus();
    await applyFx(c.fx, tg, c.ch, attrOf(c), c.t === 'atk');
    m.ex = Math.min(EX_GAUGE, m.ex + 1); paintParty();
    B.disc.push(it); paintPiles();
    if (await checkEnd()) return;
    B.busy = false; paintHand();
  }
  async function applyFx(fx, tg, ch, attr, isAtk) {
    for (const [k, a, b] of fx) {
      if (k === 'dmg') for (let i = 0; i < (b || 1); i++) { const t = tg && tg.hp > 0 ? tg : pickTarget(); if (!t) break; await hitEnemy(t, a, ch, attr, i === 0); await sleep(120); }
      if (k === 'dmgAll') for (let i = 0; i < (b || 1); i++) { const al = aliveE(); for (const e of al) hitEnemy(e, a, ch, attr, i === 0 && e === al[0]); await sleep(260); }
      if (k === 'block') gainBlock(a);
      if (k === 'heal') healLow(a);
      if (k === 'draw') await drawCards(a);
      if (k === 'redraw') { B.disc.push(...B.hand); B.hand = []; paintHand(); await drawCards(a); }
      if (k === 'energy') { B.energy += a; pulse($('bEnergy')); }
      if (k === 'str') { B.st.str += a; floatText(memEl(ch), `力+${a}`, '#ffb24a', 'st'); }
      if (['weak', 'vuln', 'poison'].includes(k)) { const t = tg && tg.hp > 0 ? tg : pickTarget(); if (t) addSt(t, k, a); }
      if (k === 'weakAll') aliveE().forEach(e => addSt(e, 'weak', a));
      if (k === 'vulnAll') aliveE().forEach(e => addSt(e, 'vuln', a));
      if (k === 'poisonAll') aliveE().forEach(e => addSt(e, 'poison', a));
      paintStatus(); paintEnemies(); await sleep(70);
    }
  }
  async function hitEnemy(e, base, ch, attr, showMult) {
    if (e.hp <= 0) return;
    const list = mults(ch, attr, e);
    let v = (base + B.st.str); list.forEach(([, x]) => v *= x); v = Math.max(0, Math.floor(v));
    const img = e.el.querySelector('.e-img');
    if (showMult && list.length) multStack(img, list);
    // シールド → ガード → HP の順に削る
    let left = v;
    if (e.shield > 0) {
      const u = Math.min(e.shield, left); e.shield -= u; left -= u;
      if (e.shield <= 0) breakEnemy(e);
    }
    if (left > 0 && e.block) { const u = Math.min(e.block, left); e.block -= u; left -= u; }
    e.hp = Math.max(0, e.hp - left);
    const r = img.getBoundingClientRect(); slash(r, ATTR[attr].c);
    e.el.classList.remove('hit'); void e.el.offsetWidth; e.el.classList.add('hit');
    const total = list.reduce((a, [, x]) => a * x, 1);
    floatText(img, v, total >= 1.5 ? '#ffd76a' : ATTR[attr].c, total >= 1.5 ? 'big' : '');
    Sfx.play('hit'); vib(10);
    if (e.hp <= 0) kill(e);
    paintEnemies();
  }
  function breakEnemy(e) {
    e.broken = 2; e.cnt = e.count ? B.diff.count + 1 : 0;
    const img = e.el.querySelector('.e-img'); floatText(img, 'BREAK!', '#5ff2ff', 'big');
    Sfx.play('rare', 3); vib(40);
    e.el.classList.add('broken');
  }
  function kill(e) {
    e.el.classList.add('dead');
    const r = e.el.querySelector('.e-img').getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, ATTR[e.attr].c, 24, 120);
    if (B.target === e) B.target = null;
  }
  // 倍率を積み上げて見せる
  function multStack(el, list) {
    const r = el.getBoundingClientRect(), box = document.createElement('div');
    box.className = 'mstack';
    box.innerHTML = list.map(([n, x], i) => `<span class="${x < 1 ? 'down' : ''}" style="animation-delay:${i * 90}ms">${n}<b>×${x}</b></span>`).join('');
    box.style.left = (r.left + r.width / 2) + 'px'; box.style.top = (r.top + r.height * .1) + 'px';
    document.body.appendChild(box); setTimeout(() => box.remove(), 1300);
  }
  function gainBlock(v) { B.block += v; Sfx.play('guard'); floatText(memEl(front().id), `ガード+${v}`, '#7cc4ff', 'st'); pulse($('bBlock')); paintStatus(); }
  function healLow(v) {
    const al = alivePt(); if (!al.length) return;
    const t = al.slice().sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
    const x = Math.min(t.max - t.hp, v); t.hp += x;
    floatText(memEl(t.id), `+${x}`, '#7dffb0'); Sfx.play('heal'); paintParty();
  }
  function addSt(e, k, v) {
    e.st[k] = (e.st[k] || 0) + v;
    floatText(e.el.querySelector('.e-img'), `${{weak:'弱体', vuln:'脆弱', poison:'毒'}[k]}${v}`, k === 'poison' ? '#9dff6a' : '#d0a8ff', 'st');
  }
  const aliveE = () => B.enemies.filter(e => e.hp > 0);
  function pickTarget() { const al = aliveE(); return al.includes(B.target) ? B.target : al[0]; }

  // ---------- 交代とEX ----------
  function onMember(i) {
    if (B.busy) return;
    const m = B.run.party[i];
    if (m.ex >= EX_GAUGE && m.hp > 0) { useEx(m); return; }
    if (i === 0) { toast(`${CHARS[m.id].n}：前列（攻撃を受ける） ・ EX ${m.ex}/${EX_GAUGE}`); return; }
    if (m.hp <= 0) { toast('戦闘不能の子とは交代できません'); return; }
    if (!B.swapFree && B.energy < 1) { toast('交代にはコスト1が必要です'); Sfx.play('back'); return; }
    if (!B.swapFree) B.energy--; B.swapFree = false;
    [B.run.party[0], B.run.party[i]] = [B.run.party[i], B.run.party[0]];
    Sfx.play('guard'); vib(15); buildParty(); paintParty(); paintStatus(); paintHand();
    toast(`${CHARS[B.run.party[0].id].n}が前列に出ました`);
  }
  async function useEx(m) {
    B.busy = true; B.sel = null; closePreview();
    await cutin(m.id);
    m.ex = 0; paintParty(); actor(m.id, 'joy');
    B.chain++;
    await applyFx(CHARS[m.id].ex.fx, pickTarget(), m.id, CHARS[m.id].attr, true);
    if (await checkEnd()) return;
    // EXを使うと、このフェーズは終わる
    toast('EXスキルを使ったので、ターン終了'); await sleep(500);
    B.busy = false; endTurn(true);
  }
  function cutin(ch) {
    const c = $('cut'), pc = CHARS[ch], col = ATTR[pc.attr].c;
    c.style.setProperty('--c', col);
    c.querySelector('img').src = 'x_' + ch + '.webp';
    c.querySelector('.cn').textContent = pc.n; c.querySelector('.cs').textContent = pc.ex.n; c.querySelector('.cd').textContent = pc.ex.txt;
    c.className = 'on'; Sfx.play('skill'); vib(30);
    return new Promise(res => { const done = () => { clearTimeout(t); c.onclick = null; c.className = 'on out'; setTimeout(() => { c.className = ''; res(); }, 280); }; const t = setTimeout(done, 2000); c.onclick = done; });
  }

  // ---------- 敵の番 ----------
  async function endTurn(force) {
    if (B.busy && !force) return;
    B.busy = true; B.sel = null; closePreview(); $('bEnd').classList.remove('on');
    B.disc.push(...B.hand); B.hand = []; paintHand(); paintPiles();
    ['weak', 'vuln'].forEach(k => { if (B.st[k]) B.st[k]--; });
    await sleep(200);
    await turnBanner('ENEMY TURN', true);
    for (const e of B.enemies) {
      if (e.hp <= 0) continue;
      e.block = 0;
      if (e.st.poison) { e.hp = Math.max(0, e.hp - e.st.poison); floatText(e.el.querySelector('.e-img'), e.st.poison, '#9dff6a'); e.st.poison--; paintEnemies(); if (e.hp <= 0) { kill(e); continue; } await sleep(220); }
      if (e.broken) { e.broken--; floatText(e.el.querySelector('.e-img'), 'ダウン中', '#5ff2ff', 'st'); if (!e.broken) e.el.classList.remove('broken'); e.step++; await sleep(300); continue; }
      // ボスのカウント
      if (e.count) {
        e.cnt--;
        if (e.cnt <= 0) {
          await bigAttack(e); e.cnt = B.diff.count; if (alivePt().length === 0) return lose();
          e.step++; paintEnemies(); continue;
        }
      }
      await enemyAct(e);
      if (alivePt().length === 0) return lose();
      ['weak', 'vuln'].forEach(k => { if (e.st[k]) e.st[k]--; });
      e.step++; paintEnemies(); await sleep(160);
    }
    if (await checkEnd()) return;
    startTurn();
  }
  const atkOf = (e, v) => { let x = (v + e.st.str) * B.diff.atk; if (e.st.weak) x *= .75; if (B.st.vuln) x *= 1.5; return Math.floor(x); };
  async function enemyAct(e) {
    const it = e.intent; if (!it) return;
    e.el.classList.remove('act'); void e.el.offsetWidth; e.el.classList.add('act');
    await sleep(240);
    const img = e.el.querySelector('.e-img');
    if (it.block) { e.block += it.block; floatText(img, `ガード${it.block}`, '#7cc4ff', 'st'); }
    if (it.shield) { e.shield = Math.min(e.maxShield || it.shield, e.shield + it.shield); if (!e.maxShield) e.maxShield = it.shield; floatText(img, `シールド+${it.shield}`, '#5ff2ff', 'st'); }
    if (it.str) { e.st.str += it.str; floatText(img, `力+${it.str}`, '#ffb24a', 'st'); }
    if (it.weak) { B.st.weak += it.weak; floatText(memEl(front().id), `弱体${it.weak}`, '#d0a8ff', 'st'); }
    if (it.vuln) { B.st.vuln += it.vuln; floatText(memEl(front().id), `脆弱${it.vuln}`, '#d0a8ff', 'st'); }
    const hits = (who, [v, n]) => (async () => { for (let i = 0; i < n; i++) { who().forEach(m => hitMember(m, atkOf(e, v))); await sleep(220); } })();
    if (it.atk) await hits(() => [front()].filter(m => m.hp > 0), it.atk);
    if (it.atkBack) await hits(() => { const bk = B.run.party.slice(1).filter(m => m.hp > 0); return bk.length ? [bk[Math.floor(Math.random() * bk.length)]] : [front()]; }, it.atkBack);
    if (it.atkAll) await hits(alivePt, it.atkAll);
    paintStatus(); paintEnemies();
  }
  async function bigAttack(e) {
    e.el.classList.remove('act'); void e.el.offsetWidth; e.el.classList.add('act');
    await banner('全体攻撃', true);
    alivePt().forEach(m => hitMember(m, atkOf(e, e.count.dmg)));
    await sleep(600);
  }
  function hitMember(m, v) {
    if (m.hp <= 0) return;
    let left = v;
    if (B.block) { const u = Math.min(B.block, left); B.block -= u; left -= u; if (u) { Sfx.play('guard'); pulse($('bBlock')); } }
    m.hp = Math.max(0, m.hp - left);
    const el = memEl(m.id);
    el.classList.remove('hurt'); void el.offsetWidth; el.classList.add('hurt');
    floatText(el, left > 0 ? `-${left}` : 'BLOCK', left > 0 ? '#ff6a6a' : '#7cc4ff', 'big');
    if (left > 0) { const sc = $('battle'); sc.classList.remove('shake'); void sc.offsetWidth; sc.classList.add('shake'); $('bFlash').classList.remove('on'); void $('bFlash').offsetWidth; $('bFlash').classList.add('on'); Sfx.play('enemy'); vib(35); }
    if (m.hp <= 0) { B.downs++; B.run.downs++; toast(`${CHARS[m.id].n}が倒れた`); autoFront(); }
    paintParty(); paintStatus(); paintHand();
  }
  // 前列が倒れたら、生きている後列が自動で前に出る
  function autoFront() {
    if (front().hp > 0) return;
    const i = B.run.party.findIndex(m => m.hp > 0); if (i <= 0) return;
    [B.run.party[0], B.run.party[i]] = [B.run.party[i], B.run.party[0]]; buildParty();
  }

  // ---------- 終わり ----------
  async function checkEnd() {
    if (aliveE().length) return false;
    B.busy = true; await sleep(700);
    alivePt().forEach(m => actor(m.id, 'joy'));
    if (has('p_heal')) alivePt().forEach(m => m.hp = Math.min(m.max, m.hp + 4));
    Sfx.play('win'); await banner('VICTORY', false);
    B.run.turns += B.turn;
    B.done(true);
    return true;
  }
  function lose() { B.busy = true; Sfx.play('lose'); B.run.turns += B.turn; B.done(false); }

  // ---------- 表示 ----------
  function buildEnemies() {
    const box = $('bEnemies'); box.innerHTML = '';
    box.className = B.enemies.some(e => e.boss) ? 'boss' : 'n' + B.enemies.length;
    B.enemies.forEach(e => {
      const el = h(`<div class="en${e.boss ? ' big' : ''}"><div class="e-cnt"></div><div class="e-int"></div>
        <img class="e-img" src="${e.img}.webp" alt="" style="${e.hue ? `filter:hue-rotate(${e.hue}deg)` : ''}"><div class="e-sh"></div>
        <div class="e-bar"><i class="e-attr" style="background:${ATTR[e.attr].c}"></i><div class="e-hp"><i></i><em></em><b></b></div><span class="e-blk"></span></div>
        <div class="e-st"></div><div class="e-nm">${e.n}</div></div>`);
      el.addEventListener('click', () => { if (e.hp <= 0) return; B.target = e; paintEnemies(); Sfx.play('tap'); });
      e.el = el; box.appendChild(el);
      el.animate([{opacity:0, transform:'translateY(-24px) scale(.92)'}, {opacity:1, transform:'none'}], {duration:500, delay:100 + e.i * 90, easing:'cubic-bezier(.2,.8,.2,1)', fill:'backwards'});
    });
  }
  const ICON = {
    atk:'<svg viewBox="0 0 24 24"><path d="M14 2h8v8L11 21l-3-3-3 3-2-2 3-3-3-3z" fill="currentColor"/></svg>',
    block:'<svg viewBox="0 0 24 24"><path d="M12 2l9 3v6c0 6-4 10-9 11C7 21 3 17 3 11V5z" fill="currentColor"/></svg>',
    buff:'<svg viewBox="0 0 24 24"><path d="M12 3l8 9h-5v9H9v-9H4z" fill="currentColor"/></svg>',
    debuff:'<svg viewBox="0 0 24 24"><path d="M12 21l8-9h-5V3H9v9H4z" fill="currentColor"/></svg>',
  };
  function intentHTML(e) {
    const it = e.intent; if (!it || e.broken) return e.broken ? '<span class="i-brk">DOWN</span>' : '';
    const p = [], at = (lab, a) => p.push(`<span class="i-atk">${ICON.atk}<b>${atkOf(e, a[0])}${a[1] > 1 ? '×' + a[1] : ''}</b><small>${lab}</small></span>`);
    if (it.atk) at('前列', it.atk);
    if (it.atkBack) at('後列', it.atkBack);
    if (it.atkAll) at('全員', it.atkAll);
    if (it.block || it.shield) p.push(`<span class="i-blk">${ICON.block}<b>${it.block || it.shield}</b></span>`);
    if (it.str) p.push(`<span class="i-buf">${ICON.buff}</span>`);
    if (it.weak || it.vuln) p.push(`<span class="i-deb">${ICON.debuff}</span>`);
    return p.join('');
  }
  function paintEnemies() {
    B.enemies.forEach(e => {
      const el = e.el; if (!el) return;
      el.querySelector('.e-int').innerHTML = e.hp > 0 ? intentHTML(e) : '';
      el.querySelector('.e-hp i').style.transform = `scaleX(${e.hp / e.max})`;
      el.querySelector('.e-hp em').style.transform = `scaleX(${e.maxShield ? e.shield / e.maxShield : 0})`;
      el.querySelector('.e-hp b').textContent = `${e.hp}${e.shield > 0 ? ` +${e.shield}` : ''}`;
      const bk = el.querySelector('.e-blk'); bk.textContent = e.block || ''; bk.classList.toggle('on', e.block > 0);
      el.querySelector('.e-st').innerHTML = ['weak', 'vuln', 'poison', 'str'].filter(k => e.st[k]).map(k => `<span class="s-${k}">${{weak:'弱', vuln:'脆', poison:'毒', str:'力'}[k]}${e.st[k]}</span>`).join('');
      const cn = el.querySelector('.e-cnt');
      cn.innerHTML = e.count && e.hp > 0 ? `<b>${e.cnt}</b><span>全体攻撃まで<br>シールドを割ると止まる</span>` : '';
      cn.classList.toggle('warn', e.count && e.cnt <= 1);
      el.classList.toggle('tgt', e === pickTarget() && aliveE().length > 1);
    });
  }
  // パーティ：前列が中央で大きく、後列が左右
  function buildParty() {
    const box = $('bParty');
    box.innerHTML = B.run.party.map((m, i) => `<button class="pm ${i === 0 ? 'front' : 'back b' + i}" data-i="${i}" data-id="${m.id}" style="--c:${TAG[PARTY_DEF[m.id].tag].c}">
      <div class="pm-ex"></div><img class="pm-img" alt=""><div class="pm-info"><span class="pm-tag">${TAG[PARTY_DEF[m.id].tag].n}</span><b>${CHARS[m.id].n}</b>
      <div class="pm-hp"><i></i><em></em></div></div>${i === 0 ? '<span class="pm-front">前列</span>' : ''}</button>`).join('');
    paintParty();
  }
  function paintParty() {
    B.run.party.forEach((m, i) => {
      const el = $('bParty').querySelector(`[data-id="${m.id}"]`); if (!el) return;
      const img = el.querySelector('.pm-img');
      if (!img.dataset.lock) img.src = `s_${m.id}_${m.hp <= 0 ? 'down' : 'aim'}.webp`;
      el.classList.toggle('down', m.hp <= 0);
      el.querySelector('.pm-hp i').style.transform = `scaleX(${m.hp / m.max})`;
      el.querySelector('.pm-hp em').textContent = `${m.hp}/${m.max}`;
      el.querySelector('.pm-ex').innerHTML = Array.from({length:EX_GAUGE}, (_, k) => `<i class="${k < m.ex ? 'on' : ''}"></i>`).join('');
      el.classList.toggle('ready', m.ex >= EX_GAUGE && m.hp > 0);
    });
    const syn = {}; alivePt().forEach(m => { const t = PARTY_DEF[m.id].tag; syn[t] = (syn[t] || 0) + 1; });
    $('bSyn').innerHTML = Object.entries(syn).filter(([, n]) => n >= 2).map(([t, n]) => `<span style="--c:${TAG[t].c}">${TAG[t].n}×${n} <b>+${n >= 3 ? 30 : 15}%</b></span>`).join('');
  }
  function actor(id, pose) {
    const el = $('bParty').querySelector(`[data-id="${id}"] .pm-img`); if (!el || mem(id).hp <= 0) return;
    el.dataset.lock = 1; el.src = `s_${id}_${pose}.webp`;
    const p = el.parentElement; p.classList.remove('act'); void p.offsetWidth; p.classList.add('act');
    clearTimeout(el._t); el._t = setTimeout(() => { delete el.dataset.lock; if (mem(id).hp > 0) el.src = `s_${id}_aim.webp`; }, 900);
  }
  const memEl = id => $('bParty').querySelector(`[data-id="${id}"]`) || $('bParty');
  function paintStatus() {
    const bk = $('bBlock'); bk.querySelector('b').textContent = B.block; bk.classList.toggle('on', B.block > 0);
    $('bEnergy').querySelector('b').textContent = B.energy; $('bEnergy').querySelector('small').textContent = '/' + B.maxE;
    $('bEnergy').classList.toggle('empty', B.energy <= 0);
    $('bChain').innerHTML = B.chain > 1 ? `連携 <b>×${(1 + (B.chain - 1) * (has('p_chain') ? .15 : .1)).toFixed(2)}</b>` : '';
    $('bSt').innerHTML = ['str', 'weak', 'vuln'].filter(k => B.st[k]).map(k => `<span class="s-${k}">${{str:'力', weak:'弱体', vuln:'脆弱'}[k]}${B.st[k]}</span>`).join('');
  }
  function paintPiles() { $('bDraw').textContent = B.draw.length; $('bDisc').textContent = B.disc.length; }
  function paintAll() { paintStatus(); paintPiles(); paintHand(); paintEnemies(); }

  function paintHand(anim) {
    const box = $('hand'), n = B.hand.length, W = box.clientWidth || innerWidth;
    const cw = Math.min(112, W * .29), ch = cw * 1.5, step = n > 1 ? Math.min(cw * .86, (W - cw - 16) / (n - 1)) : 0;
    const x0 = (W - (cw + step * (n - 1))) / 2;
    const prev = new Set([...box.querySelectorAll('.card')].map(e => e.dataset.u));
    box.innerHTML = B.hand.map((it, i) => {
      const c = cardById(it.id), m = mem(c.ch), mid = (n - 1) / 2, rot = (i - mid) * 3.2, y = Math.abs(i - mid) ** 2 * 2.2;
      const dead = !m || m.hp <= 0, ok = !dead && c.c <= B.energy && !B.busy, sel = B.sel === it.u;
      return cardHTML(it.id, {mod:{str:B.st.str, weak:B.st.weak}, cls:`${ok ? 'ok' : 'no'}${dead ? ' dn' : ''}${sel ? ' sel' : ''}${anim && !prev.has(String(it.u)) ? ' drawn' : ''}`})
        .replace('class="card', `data-u="${it.u}" style="left:${x0 + step * i}px;width:${cw}px;height:${ch}px;--r:${rot}deg;--y:${y}px;z-index:${sel ? 50 : i + 1}" class="card`);
    }).join('');
    box.querySelectorAll('.card').forEach(el => { const c = cardById(el.dataset.id); el.style.setProperty('--tc', TYPE[c.t].c); el.style.setProperty('--ac', ATTR[attrOf(c)].c); });
  }

  // 手札の操作：タップで選ぶ → もう一度タップ or 上にドラッグで使う
  let drag = null;
  function onDown(e) { const el = e.target.closest('#hand .card'); if (!el || B.busy) return; drag = {u:+el.dataset.u, el, x0:e.clientX, y0:e.clientY, moved:false}; el.setPointerCapture(e.pointerId); }
  function onMove(e) {
    if (!drag) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) > 12) { drag.moved = true; drag.el.classList.add('drag'); B.sel = drag.u; showPreview(drag.u); }
    if (!drag.moved) return;
    drag.el.style.transform = `translate(${dx}px,${dy}px) scale(1.08)`;
    const up = e.clientY < $('hand').getBoundingClientRect().top - 30; drag.el.classList.toggle('arm', up);
    let over = null;
    B.enemies.forEach(en => { if (en.hp > 0) { const r = en.el.getBoundingClientRect(); const hit = e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom; en.el.classList.toggle('hover', hit); if (hit) over = en; } });
    drag.over = over; drag.up = up;
  }
  function onUp() {
    if (!drag) return; const d = drag; drag = null;
    B.enemies.forEach(en => en.el && en.el.classList.remove('hover'));
    if (d.moved) { d.el.classList.remove('drag', 'arm'); d.el.style.transform = ''; if (d.up) { play(d.u, d.over); return; } B.sel = null; closePreview(); paintHand(); return; }
    if (B.sel === d.u) { play(d.u); return; }
    B.sel = d.u; Sfx.play('tap'); showPreview(d.u); paintHand();
  }
  function showPreview(u) {
    const it = B.hand.find(x => x.u === u); if (!it) return;
    const c = cardById(it.id), m = mem(c.ch), pv = $('preview');
    const tip = !m || m.hp <= 0 ? `${CHARS[c.ch].n}は戦闘不能です` : c.c > B.energy ? 'コストが足りません' : 'もう一度タップ、または上へドラッグで使う';
    pv.innerHTML = cardHTML(it.id, {mod:{str:B.st.str, weak:B.st.weak}, cls:'big'}) + `<p class="pv-hint">${tip}</p>`;
    pv.classList.add('on');
  }
  function closePreview() { $('preview').classList.remove('on'); }

  async function flyCard(it, c, tg) {
    const src = document.querySelector(`#hand .card[data-u="${it.u}"]`);
    const r = src ? src.getBoundingClientRect() : {left:innerWidth / 2 - 50, top:innerHeight - 200, width:100, height:150};
    const W = Math.min(innerWidth * .52, 230), H = W * 1.5, fr = $('bField').getBoundingClientRect();
    const cx = innerWidth / 2, cy = fr.top + fr.height * .46;
    const f = h(`<div class="flycard">${cardHTML(c.id, {cls:'big'})}</div>`);
    f.style.cssText = `left:${cx - W / 2}px;top:${cy - H / 2}px;width:${W}px;height:${H}px;--tc:${TYPE[c.t].c}`;
    document.body.appendChild(f); if (src) src.style.visibility = 'hidden';
    Sfx.play('play'); vib(12);
    const k = r.width / W, sx = r.left + r.width / 2 - cx, sy = r.top + r.height / 2 - cy;
    await f.animate([{transform:`translate(${sx}px,${sy}px) scale(${k}) rotate(-4deg)`}, {transform:'translateY(-6px) scale(1)'}], {duration:280, easing:'cubic-bezier(.2,.9,.25,1)', fill:'forwards'}).finished;
    f.classList.add('glow'); await sleep(220);
    let end = [{transform:'translateY(-6px) scale(1)', opacity:1}, {transform:'translateY(-40px) scale(.9)', opacity:0}];
    if (c.t === 'atk' && tg && tg.el) { const er = tg.el.querySelector('.e-img').getBoundingClientRect(); end = [{transform:'translateY(-6px) scale(1)', opacity:1}, {transform:`translate(${er.left + er.width / 2 - cx}px,${er.top + er.height / 2 - cy}px) scale(.35) rotate(8deg)`, opacity:0}]; }
    await f.animate(end, {duration:220, easing:'cubic-bezier(.6,0,.9,.5)', fill:'forwards'}).finished;
    f.remove();
  }
  function slash(r, col) {
    const s = document.createElement('i'); s.className = 'slash'; s.style.setProperty('--c', col);
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.transform = `translate(-50%,-50%) rotate(${-35 + Math.random() * 70}deg)`;
    document.body.appendChild(s); setTimeout(() => s.remove(), 420); burst(x, y, col, 8, 50);
  }
  async function banner(t, warn) { const b = $('bBanner'); b.innerHTML = `<span>${t}</span>`; b.className = warn ? 'warn on' : 'on'; Sfx.play(warn ? 'warn' : 'floor'); await sleep(warn ? 1300 : 900); b.className = ''; }
  async function turnBanner(t, en) { const b = $('bTurn'); b.textContent = t; b.className = en ? 'en on' : 'on'; Sfx.play('turn'); await sleep(650); b.className = ''; }
  function floatText(el, txt, col, cls = '') {
    const r = el.getBoundingClientRect(), p = document.createElement('div');
    p.className = 'ft ' + cls; p.style.color = col; p.textContent = txt;
    p.style.left = (r.left + r.width / 2 + (Math.random() - .5) * 30) + 'px'; p.style.top = (r.top + r.height * .3) + 'px';
    document.body.appendChild(p); setTimeout(() => p.remove(), 1100);
  }
  function pulse(el) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }

  function init() {
    const hand = $('hand');
    hand.addEventListener('pointerdown', onDown); hand.addEventListener('pointermove', onMove);
    hand.addEventListener('pointerup', onUp); hand.addEventListener('pointercancel', onUp);
    $('bEnd').onclick = () => { Sfx.play('ok'); endTurn(); };
    $('bParty').addEventListener('click', e => { const b = e.target.closest('.pm'); if (b) onMember(+b.dataset.i); });
    $('bField').addEventListener('click', e => { if (!e.target.closest('.en') && !e.target.closest('.pm') && B && B.sel != null) { B.sel = null; closePreview(); paintHand(); } });
    $('bRetreat').onclick = () => { if (!B || B.busy) return; Run.menu(); };
    $('bPileD').onclick = () => toast(`山札 ${B.draw.length}枚`);
    $('bPileX').onclick = () => toast(`捨て札 ${B.disc.length}枚`);
    addEventListener('resize', () => { if (B && $('battle').classList.contains('on')) paintHand(); });
  }
  return { init, start, dbg:() => B };
})();
