// HALO LINK — バトル（耀平がカードで戦う。パートナーのEXスキル、敵の行動予告、属性の弱点）
'use strict';
const Battle = (() => {
  let B = null;
  const EX_MAX = 6;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let uid = 0;

  // ---------- 開始 ----------
  function start(stage) {
    const s = Save.d, pc = CHARS[s.partner];
    B = { stage, wave:0, partner:s.partner, pc, maxHp:Save.maxHp(), hp:Save.maxHp(), block:0, energy:3, maxEnergy:3,
          st:{str:0, weak:0, vuln:0}, draw:[], hand:[], disc:[], gauge:0, turn:0, busy:true, sel:null, target:null, enemies:[] };
    B.draw = shuffle(s.deck.map(id => ({id, u:++uid})));
    $('bStage').textContent = stage.id + '　' + stage.n;
    $('bExIc').src = 'ic_' + B.partner + '.webp';
    paintAll();
    startWave();
  }
  async function startWave() {
    B.busy = true;
    const keys = B.stage.waves[B.wave];
    B.enemies = keys.map((k, i) => { const d = ENEMIES[k]; return {...d, key:k, i, hp:d.hp, max:d.hp, block:0, st:{str:0, weak:0, vuln:0, poison:0}, step:0, el:null}; });
    B.target = null;
    $('bWave').textContent = `${B.wave + 1}/${B.stage.waves.length}`;
    buildEnemies();
    // ウェーブが変わったら、カードを全部山札に戻して切り直す
    if (B.wave > 0) { B.draw = shuffle([...B.draw, ...B.hand, ...B.disc]); B.hand = []; B.disc = []; B.st = {str:0, weak:0, vuln:0}; B.block = 0; }
    const boss = B.enemies.some(e => e.boss);
    await banner(boss ? 'WARNING' : (B.stage.waves.length > 1 ? `WAVE ${B.wave + 1}` : 'BATTLE START'), boss);
    // パートナーの常時効果（戦闘開始時）
    const p = B.pc.passive;
    if (p.t === 'startBlock') gainBlock(p.v);
    if (p.t === 'startWeak') B.enemies.forEach(e => addSt(e, 'weak', p.v));
    B.turn = 0;
    startTurn();
  }

  // ---------- 自分のターン ----------
  async function startTurn() {
    B.turn++; B.busy = true;
    B.block = 0;
    const p = B.pc.passive;
    B.energy = B.maxEnergy + (p.t === 'firstEnergy' && B.turn === 1 ? p.v : 0);
    if (p.t === 'regen') heal(p.v, true);
    B.enemies.forEach(e => { if (e.hp > 0) e.intent = e.pat[e.step % e.pat.length]; });
    paintEnemies(); paintStatus();
    $('bEnd').classList.remove('on');
    await turnBanner('YOUR TURN');
    await drawCards(5 + (p.t === 'startDraw' && B.turn === 1 ? p.v : 0));
    B.busy = false; paintHand(); $('bEnd').classList.add('on');
  }
  async function drawCards(n) {
    for (let i = 0; i < n; i++) {
      if (!B.draw.length) { if (!B.disc.length) break; B.draw = shuffle(B.disc); B.disc = []; }
      if (B.hand.length >= 10) break;
      B.hand.push(B.draw.pop()); Sfx.play('draw');
      paintHand(true); await sleep(85);
    }
    paintPiles();
  }

  // ---------- カードを使う ----------
  function canPlay(cid) { const c = cardById(cid); return !B.busy && c.c <= B.energy; }
  async function play(u, targetEnemy) {
    const k = B.hand.findIndex(x => x.u === u); if (k < 0) return;
    const c = cardById(B.hand[k].id);
    if (c.c > B.energy) { toast('エネルギーが足りません'); Sfx.play('back'); return; }
    B.busy = true; B.sel = null; closePreview();
    const tg = targetEnemy || pickTarget();
    B.energy -= c.c;
    const [it] = B.hand.splice(k, 1);
    // カードが中央へ飛んで光る
    await flyCard(it, c, tg);
    paintHand(); paintStatus();
    await applyFx(c.fx, tg, c);
    // パートナーのカードは2、ほかの子のカードは1、EXゲージが溜まる
    if (c.ch !== 'yohei') { B.gauge = Math.min(EX_MAX, B.gauge + (c.ch === B.partner ? 2 : 1)); paintGauge(); }
    B.disc.push(it); paintPiles();
    if (await checkWave()) return;
    B.busy = false; paintHand();
  }
  async function flyCard(it, c, tg) {
    const src = document.querySelector(`#hand .card[data-u="${it.u}"]`);
    const r = src ? src.getBoundingClientRect() : {left:innerWidth / 2 - 50, top:innerHeight - 200, width:100, height:150};
    const W = Math.min(innerWidth * .58, 250), H = W * 1.5;
    const fr = $('bField').getBoundingClientRect();
    const cx = innerWidth / 2, cy = fr.top + fr.height * .5;
    const f = h(`<div class="flycard">${cardHTML(c.id, {cls:'big'})}</div>`);
    f.style.cssText = `left:${cx - W / 2}px;top:${cy - H / 2}px;width:${W}px;height:${H}px`;
    document.body.appendChild(f); if (src) src.style.visibility = 'hidden';
    Sfx.play('play'); vib(12);
    const k = r.width / W, sx = r.left + r.width / 2 - cx, sy = r.top + r.height / 2 - cy;
    // 手札の位置・大きさ → 中央に原寸（縮小から戻すだけなので、ぼやけない）
    await f.animate([{transform:`translate(${sx}px,${sy}px) scale(${k}) rotate(-4deg)`}, {transform:'translateY(-6px) scale(1)'}],
      {duration:300, easing:'cubic-bezier(.2,.9,.25,1)', fill:'forwards'}).finished;
    f.classList.add('glow');
    await sleep(260);
    // アタックは敵の方へ、ほかは光って消える
    let end = [{transform:'translateY(-6px) scale(1)', opacity:1}, {transform:'translateY(-40px) scale(.9)', opacity:0}];
    if (c.t === 'atk' && tg && tg.el) { const er = tg.el.querySelector('.e-img').getBoundingClientRect(); end = [{transform:'translateY(-6px) scale(1)', opacity:1}, {transform:`translate(${er.left + er.width / 2 - cx}px,${er.top + er.height / 2 - cy}px) scale(.35) rotate(8deg)`, opacity:0}]; }
    await f.animate(end, {duration:240, easing:'cubic-bezier(.6,0,.9,.5)', fill:'forwards'}).finished;
    f.remove();
  }

  // 効果を順に処理する（演出つき）
  async function applyFx(fx, tg, c) {
    const attr = c ? attrOf(c) : B.pc.attr;
    const isAtk = c ? c.t === 'atk' : true;
    for (const [k, a, b] of fx) {
      if (k === 'dmg') { for (let i = 0; i < (b || 1); i++) { const t = tg && tg.hp > 0 ? tg : pickTarget(); if (!t) break; hitEnemy(t, a, attr, isAtk); await sleep(150); } }
      if (k === 'dmgAll') { for (let i = 0; i < (b || 1); i++) { alive().forEach(e => hitEnemy(e, a, attr, isAtk)); await sleep(190); } }
      if (k === 'block') gainBlock(a);
      if (k === 'heal') heal(a);
      if (k === 'draw') await drawCards(a);
      if (k === 'redraw') { B.disc.push(...B.hand); B.hand = []; paintHand(); await drawCards(a); }
      if (k === 'energy') { B.energy += a; pulse($('bEnergy')); }
      if (k === 'str') { B.st.str += a; floatText($('bHp'), `力+${a}`, '#ffb24a'); }
      if (['weak', 'vuln', 'poison'].includes(k)) { const t = tg && tg.hp > 0 ? tg : pickTarget(); if (t) addSt(t, k, a); }
      if (k === 'weakAll') alive().forEach(e => addSt(e, 'weak', a));
      if (k === 'vulnAll') alive().forEach(e => addSt(e, 'vuln', a));
      if (k === 'poisonAll') alive().forEach(e => addSt(e, 'poison', a));
      paintStatus(); paintEnemies();
      await sleep(90);
    }
  }
  function dmgTo(e, base, attr, isAtk) {
    let v = base + B.st.str + (isAtk && B.pc.passive.t === 'atkUp' ? B.pc.passive.v : 0);
    let mark = '';
    if (STRONG[attr] === e.attr) { v *= 1.5; mark = 'WEAK!'; }
    if (B.st.weak) v *= .75;
    if (e.st.vuln) v *= 1.5;
    return {v:Math.max(0, Math.floor(v)), mark};
  }
  function hitEnemy(e, base, attr, isAtk) {
    if (e.hp <= 0) return;
    const {v, mark} = dmgTo(e, base, attr, isAtk);
    let left = v;
    if (e.block) { const used = Math.min(e.block, left); e.block -= used; left -= used; }
    e.hp = Math.max(0, e.hp - left);
    const img = e.el.querySelector('.e-img'), r = img.getBoundingClientRect();
    slash(r, ATTR[attr].c);
    e.el.classList.remove('hit'); void e.el.offsetWidth; e.el.classList.add('hit');
    floatText(img, v, ATTR[attr].c, mark ? 'big' : '', mark);
    Sfx.play('hit'); vib(10);
    if (e.hp <= 0) kill(e);
    paintEnemies();
  }
  function kill(e) {
    e.el.classList.add('dead');
    const r = e.el.querySelector('.e-img').getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, ATTR[e.attr].c, 22, 110);
    if (B.target === e) B.target = null;
    if (B.pc.passive.t === 'killEnergy') { B.energy += B.pc.passive.v; pulse($('bEnergy')); paintStatus(); }
  }
  function slash(r, col) {
    const s = document.createElement('i'); s.className = 'slash'; s.style.setProperty('--c', col);
    const x = r.left + r.width / 2, y = r.top + r.height / 2, ang = -35 + Math.random() * 70;
    s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.transform = `translate(-50%,-50%) rotate(${ang}deg)`;
    document.body.appendChild(s); setTimeout(() => s.remove(), 420);
    burst(x, y, col, 8, 50);
  }
  function gainBlock(v) { B.block += v; Sfx.play('guard'); floatText($('bHp'), `ガード+${v}`, '#7cc4ff'); pulse($('bBlock')); paintStatus(); }
  function heal(v, quiet) {
    const m = B.pc.passive.t === 'healUp' ? B.pc.passive.v : 1;
    const x = Math.floor(v * m), before = B.hp;
    B.hp = Math.min(B.maxHp, B.hp + x);
    if (!quiet || B.hp > before) { floatText($('bHp'), `+${B.hp - before}`, '#7dffb0'); Sfx.play('heal'); }
    paintStatus();
  }
  function addSt(e, k, v) {
    e.st[k] = (e.st[k] || 0) + v;
    const lab = {weak:'弱体', vuln:'脆弱', poison:'毒'}[k];
    floatText(e.el.querySelector('.e-img'), `${lab}${v}`, k === 'poison' ? '#9dff6a' : '#d0a8ff', 'st');
  }
  const alive = () => B.enemies.filter(e => e.hp > 0);
  function pickTarget() { const al = alive(); return al.includes(B.target) ? B.target : al[0]; }

  // ---------- EXスキル ----------
  async function useEx() {
    if (B.busy || B.gauge < EX_MAX) return;
    B.busy = true; B.sel = null; closePreview();
    await cutin(B.partner);
    B.gauge = 0; paintGauge();
    await applyFx(B.pc.ex.fx, pickTarget(), null);
    if (await checkWave()) return;
    B.busy = false; paintHand();
  }
  function cutin(ch) {
    const c = $('cut'), pc = CHARS[ch], col = ATTR[pc.attr].c;
    c.style.setProperty('--c', col);
    c.querySelector('img').src = 'x_' + ch + '.webp';
    c.querySelector('.cn').textContent = pc.n;
    c.querySelector('.cs').textContent = pc.ex.n;
    c.querySelector('.cd').textContent = pc.ex.txt;
    c.className = 'on'; Sfx.play('skill'); vib(30);
    return new Promise(res => {
      const done = () => { clearTimeout(t); c.onclick = null; c.className = 'on out'; setTimeout(() => { c.className = ''; res(); }, 280); };
      const t = setTimeout(done, 2000); c.onclick = done;
    });
  }

  // ---------- ターン終了 → 敵の番 ----------
  async function endTurn() {
    if (B.busy) return;
    B.busy = true; B.sel = null; closePreview(); $('bEnd').classList.remove('on');
    // 手札を捨てる
    B.disc.push(...B.hand); B.hand = []; paintHand(); paintPiles();
    const p = B.pc.passive; if (p.t === 'endBlock') gainBlock(p.v);
    // 自分の状態異常が1減る
    ['weak', 'vuln'].forEach(k => { if (B.st[k]) B.st[k]--; }); paintStatus();
    await sleep(250);
    await turnBanner('ENEMY TURN', true);
    for (const e of B.enemies) {
      if (e.hp <= 0) continue;
      e.block = 0;
      // 毒
      if (e.st.poison) { e.hp = Math.max(0, e.hp - e.st.poison); floatText(e.el.querySelector('.e-img'), e.st.poison, '#9dff6a'); e.st.poison--; paintEnemies(); if (e.hp <= 0) { kill(e); await sleep(300); continue; } await sleep(250); }
      await enemyAct(e);
      if (B.hp <= 0) return lose();
      ['weak', 'vuln'].forEach(k => { if (e.st[k]) e.st[k]--; });
      e.step++;
      paintEnemies();
      await sleep(180);
    }
    if (await checkWave()) return;
    startTurn();
  }
  async function enemyAct(e) {
    const it = e.intent; if (!it) return;
    e.el.classList.remove('act'); void e.el.offsetWidth; e.el.classList.add('act');
    await sleep(260);
    if (it.block) { e.block += it.block; floatText(e.el.querySelector('.e-img'), `ガード${it.block}`, '#7cc4ff', 'st'); Sfx.play('guard'); }
    if (it.str) { e.st.str += it.str; floatText(e.el.querySelector('.e-img'), `力+${it.str}`, '#ffb24a', 'st'); }
    if (it.heal) { e.hp = Math.min(e.max, e.hp + it.heal); floatText(e.el.querySelector('.e-img'), `+${it.heal}`, '#7dffb0'); }
    if (it.weak) { B.st.weak += it.weak; floatText($('bHp'), `弱体${it.weak}`, '#d0a8ff'); }
    if (it.vuln) { B.st.vuln += it.vuln; floatText($('bHp'), `脆弱${it.vuln}`, '#d0a8ff'); }
    if (it.atk) {
      const [v, n] = it.atk;
      for (let i = 0; i < n; i++) { hitPlayer(enemyDmg(e, v)); await sleep(230); if (B.hp <= 0) return; }
    }
    paintStatus(); paintEnemies();
  }
  function enemyDmg(e, v) { let x = v + e.st.str; if (e.st.weak) x *= .75; if (B.st.vuln) x *= 1.5; return Math.floor(x); }
  function hitPlayer(v) {
    let left = v;
    if (B.block) { const u = Math.min(B.block, left); B.block -= u; left -= u; if (u) { Sfx.play('guard'); pulse($('bBlock')); } }
    B.hp = Math.max(0, B.hp - left);
    const sc = $('battle'); sc.classList.remove('shake'); void sc.offsetWidth; sc.classList.add('shake');
    if (left > 0) { $('bFlash').classList.remove('on'); void $('bFlash').offsetWidth; $('bFlash').classList.add('on'); Sfx.play('enemy'); vib(40); }
    floatText($('bHp'), left > 0 ? `-${left}` : 'BLOCK', left > 0 ? '#ff6a6a' : '#7cc4ff', 'big');
    paintStatus();
  }

  // ---------- 勝ち負け ----------
  async function checkWave() {
    if (alive().length) return false;
    B.busy = true;
    await sleep(600);
    B.wave++;
    if (B.wave >= B.stage.waves.length) { win(); return true; }
    startWave(); return true;
  }
  function win() {
    const s = Save.d, st = B.stage, first = !s.cleared[st.id];
    let ticket = 0, pt = 5;
    if (first) { ticket = st.first.ticket; pt = st.first.pt; s.ticket += ticket; }
    s.pt += pt; s.cleared[st.id] = (s.cleared[st.id] || 0) + 1;
    const a0 = {...Save.aff(B.partner)};
    const up = Save.addAff(B.partner, st.aff);
    Save.put(); Sfx.play('win');
    UI.result(true, {ticket, pt, first, partner:B.partner, aff:st.aff, a0, a1:Save.aff(B.partner), up}, () => start(st));
  }
  function lose() { B.busy = true; Sfx.play('lose'); UI.result(false, {}, () => start(B.stage)); }

  // ---------- 表示 ----------
  function buildEnemies() {
    const box = $('bEnemies'); box.innerHTML = '';
    const big = B.enemies.some(e => e.boss);
    box.className = big ? 'boss' : 'n' + B.enemies.length;
    B.enemies.forEach(e => {
      const el = h(`<div class="en${e.boss ? ' big' : ''}">
        <div class="e-int"></div>
        <img class="e-img" src="${e.img}.webp" alt="" style="${e.hue ? `filter:hue-rotate(${e.hue}deg)` : ''}">
        <div class="e-sh"></div>
        <div class="e-bar"><i class="e-attr" style="background:${ATTR[e.attr].c}"></i><div class="e-hp"><i></i><b></b></div><span class="e-blk"></span></div>
        <div class="e-st"></div><div class="e-nm">${e.n}</div></div>`);
      el.addEventListener('click', () => { if (e.hp <= 0) return; B.target = e; paintEnemies(); Sfx.play('tap'); });
      e.el = el; box.appendChild(el);
      el.animate([{opacity:0, transform:'translateY(-24px) scale(.92)'}, {opacity:1, transform:'none'}], {duration:500, delay:100 + e.i * 90, easing:'cubic-bezier(.2,.8,.2,1)', fill:'backwards'});
    });
    paintEnemies();
  }
  const ICON = {
    atk:'<svg viewBox="0 0 24 24"><path d="M14 2l8 0 0 8-11 11-3-3 0 0-3 3-2-2 3-3-3-3z" fill="currentColor"/></svg>',
    block:'<svg viewBox="0 0 24 24"><path d="M12 2l9 3v6c0 6-4 10-9 11C7 21 3 17 3 11V5z" fill="currentColor"/></svg>',
    buff:'<svg viewBox="0 0 24 24"><path d="M12 3l8 9h-5v9H9v-9H4z" fill="currentColor"/></svg>',
    debuff:'<svg viewBox="0 0 24 24"><path d="M12 21l8-9h-5V3H9v9H4z" fill="currentColor"/></svg>',
    heal:'<svg viewBox="0 0 24 24"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="currentColor"/></svg>',
  };
  function intentHTML(e) {
    const it = e.intent; if (!it) return '';
    const parts = [];
    if (it.atk) { const v = enemyDmg(e, it.atk[0]); parts.push(`<span class="i-atk">${ICON.atk}<b>${v}${it.atk[1] > 1 ? '×' + it.atk[1] : ''}</b></span>`); }
    if (it.block) parts.push(`<span class="i-blk">${ICON.block}<b>${it.block}</b></span>`);
    if (it.str) parts.push(`<span class="i-buf">${ICON.buff}</span>`);
    if (it.weak || it.vuln) parts.push(`<span class="i-deb">${ICON.debuff}</span>`);
    if (it.heal) parts.push(`<span class="i-heal">${ICON.heal}</span>`);
    return parts.join('');
  }
  function paintEnemies() {
    B.enemies.forEach(e => {
      const el = e.el; if (!el) return;
      el.querySelector('.e-int').innerHTML = e.hp > 0 ? intentHTML(e) : '';
      el.querySelector('.e-hp i').style.transform = `scaleX(${e.hp / e.max})`;
      el.querySelector('.e-hp b').textContent = `${e.hp}/${e.max}`;
      const bk = el.querySelector('.e-blk'); bk.textContent = e.block || ''; bk.classList.toggle('on', e.block > 0);
      el.querySelector('.e-st').innerHTML = ['weak', 'vuln', 'poison', 'str'].filter(k => e.st[k]).map(k => `<span class="s-${k}">${{weak:'弱', vuln:'脆', poison:'毒', str:'力'}[k]}${e.st[k]}</span>`).join('');
      el.classList.toggle('tgt', e === pickTarget() && alive().length > 1);
    });
  }
  function paintStatus() {
    $('bHpBar').style.transform = `scaleX(${B.hp / B.maxHp})`;
    $('bHpNum').textContent = `${B.hp}/${B.maxHp}`;
    $('bHp').classList.toggle('low', B.hp / B.maxHp < .3);
    const bk = $('bBlock'); bk.querySelector('b').textContent = B.block; bk.classList.toggle('on', B.block > 0);
    $('bEnergy').querySelector('b').textContent = B.energy;
    $('bEnergy').querySelector('small').textContent = '/' + B.maxEnergy;
    $('bEnergy').classList.toggle('empty', B.energy <= 0);
    $('bSt').innerHTML = ['str', 'weak', 'vuln'].filter(k => B.st[k]).map(k => `<span class="s-${k}">${{str:'力', weak:'弱体', vuln:'脆弱'}[k]}${B.st[k]}</span>`).join('');
  }
  function paintGauge() {
    $('bEx').style.setProperty('--p', B.gauge / EX_MAX);
    $('bEx').classList.toggle('ready', B.gauge >= EX_MAX);
  }
  function paintPiles() { $('bDraw').textContent = B.draw.length; $('bDisc').textContent = B.disc.length; }
  function paintAll() { paintStatus(); paintGauge(); paintPiles(); paintHand(); }

  // 手札：扇形に並べる
  function paintHand(anim) {
    const box = $('hand'), n = B.hand.length, W = box.clientWidth || innerWidth;
    const cw = Math.min(112, W * .29), ch = cw * 1.5, step = n > 1 ? Math.min(cw * .86, (W - cw - 16) / (n - 1)) : 0;
    const x0 = (W - (cw + step * (n - 1))) / 2;
    const mod = {str:B.st.str, weak:B.st.weak, atkUp:B.pc.passive.t === 'atkUp' ? B.pc.passive.v : 0, healUp:B.pc.passive.t === 'healUp' ? B.pc.passive.v : 1};
    const prev = new Set([...box.querySelectorAll('.card')].map(e => e.dataset.u));
    box.innerHTML = B.hand.map((it, i) => {
      const c = cardById(it.id), mid = (n - 1) / 2, rot = (i - mid) * 3.2, y = Math.abs(i - mid) * Math.abs(i - mid) * 2.2;
      const ok = c.c <= B.energy && !B.busy, sel = B.sel === it.u;
      const m = c.t === 'atk' || c.fx.some(f => f[0] === 'heal') ? mod : {};
      return cardHTML(it.id, {mod:m, cls:`${ok ? 'ok' : 'no'}${sel ? ' sel' : ''}${anim && !prev.has(String(it.u)) ? ' drawn' : ''}`})
        .replace('class="card', `data-u="${it.u}" style="left:${x0 + step * i}px;width:${cw}px;height:${ch}px;--r:${rot}deg;--y:${y}px;z-index:${sel ? 50 : i + 1}" class="card`);
    }).join('');
    fixStyles(box);
  }
  // cardHTML が持つ --tc/--ac と、手札の位置指定をひとつの style にまとめる
  function fixStyles(box) {
    box.querySelectorAll('.card').forEach(el => {
      const c = cardById(el.dataset.id), a = ATTR[attrOf(c)], t = TYPE[c.t];
      el.style.setProperty('--tc', t.c); el.style.setProperty('--ac', a.c);
    });
  }

  // ---------- 手札の操作：タップで選ぶ → もう一度タップ or 上にドラッグで使う ----------
  let drag = null;
  function onDown(e) {
    const el = e.target.closest('#hand .card'); if (!el || B.busy) return;
    const u = +el.dataset.u;
    drag = {u, el, x0:e.clientX, y0:e.clientY, moved:false};
    el.setPointerCapture(e.pointerId);
  }
  function onMove(e) {
    if (!drag) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) > 12) { drag.moved = true; drag.el.classList.add('drag'); B.sel = drag.u; showPreview(drag.u); }
    if (!drag.moved) return;
    drag.el.style.transform = `translate(${dx}px,${dy}px) scale(1.08)`;
    const handTop = $('hand').getBoundingClientRect().top;
    const up = e.clientY < handTop - 30;
    drag.el.classList.toggle('arm', up);
    // 敵の上にいるか
    let over = null;
    B.enemies.forEach(en => { if (en.hp > 0) { const r = en.el.getBoundingClientRect(); const hit = e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom; en.el.classList.toggle('hover', hit); if (hit) over = en; } });
    drag.over = over; drag.up = up;
  }
  function onUp() {
    if (!drag) return;
    const d = drag; drag = null;
    B.enemies.forEach(en => en.el && en.el.classList.remove('hover'));
    if (d.moved) {
      d.el.classList.remove('drag', 'arm'); d.el.style.transform = '';
      if (d.up) { play(d.u, d.over); return; }
      B.sel = null; closePreview(); paintHand(); return;
    }
    // タップ
    if (B.sel === d.u) { play(d.u); return; }
    B.sel = d.u; Sfx.play('tap'); showPreview(d.u); paintHand();
  }
  function showPreview(u) {
    const it = B.hand.find(x => x.u === u); if (!it) return;
    const c = cardById(it.id);
    const mod = {str:B.st.str, weak:B.st.weak, atkUp:B.pc.passive.t === 'atkUp' ? B.pc.passive.v : 0, healUp:B.pc.passive.t === 'healUp' ? B.pc.passive.v : 1};
    const pv = $('preview');
    pv.innerHTML = cardHTML(it.id, {mod, cls:'big'}) + `<p class="pv-hint">${c.c > B.energy ? 'エネルギーが足りません' : 'もう一度タップ、または上へドラッグで使う'}</p>`;
    pv.classList.add('on');
  }
  function closePreview() { $('preview').classList.remove('on'); }

  // ---------- 小さな演出 ----------
  async function banner(t, warn) {
    const b = $('bBanner'); b.innerHTML = `<span>${t}</span>`; b.className = warn ? 'warn on' : 'on';
    Sfx.play(warn ? 'warn' : 'floor');
    await sleep(warn ? 1400 : 950); b.className = '';
  }
  async function turnBanner(t, enemy) {
    const b = $('bTurn'); b.textContent = t; b.className = enemy ? 'en on' : 'on'; Sfx.play('turn');
    await sleep(700); b.className = '';
  }
  function floatText(el, txt, col, cls = '', sub = '') {
    const r = el.getBoundingClientRect(), p = document.createElement('div');
    p.className = 'ft ' + cls; p.style.color = col; p.innerHTML = `${txt}${sub ? `<small>${sub}</small>` : ''}`;
    p.style.left = (r.left + r.width / 2 + (Math.random() - .5) * 30) + 'px'; p.style.top = (r.top + r.height * .35) + 'px';
    document.body.appendChild(p); setTimeout(() => p.remove(), 1100);
  }
  function pulse(el) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }

  // ---------- つなぎこみ ----------
  function init() {
    const hand = $('hand');
    hand.addEventListener('pointerdown', onDown);
    hand.addEventListener('pointermove', onMove);
    hand.addEventListener('pointerup', onUp); hand.addEventListener('pointercancel', onUp);
    $('bEnd').onclick = () => { Sfx.play('ok'); endTurn(); };
    $('bEx').onclick = () => { if (B.gauge >= EX_MAX) useEx(); else { toast(`${B.pc.ex.n}：${B.pc.ex.txt}（ゲージ ${B.gauge}/${EX_MAX}）`); Sfx.play('tap'); } };
    $('bField').addEventListener('click', e => { if (!e.target.closest('.en') && !e.target.closest('#bEx') && B.sel != null) { B.sel = null; closePreview(); paintHand(); } });
    $('bRetreat').onclick = () => { if (B.busy) return; if (confirmTwice()) UI.go('stage'); };
    $('bPileD').onclick = () => toast(`山札 ${B.draw.length}枚`);
    $('bPileX').onclick = () => toast(`捨て札 ${B.disc.length}枚`);
    addEventListener('resize', () => { if (B && $('battle').classList.contains('on')) paintHand(); });
  }
  let at = 0;
  function confirmTwice() { const n = Date.now(); if (n - at < 2000) return true; at = n; toast('もう一度押すと撤退します'); return false; }
  return { init, start, dbg:() => B };
})();
