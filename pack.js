// HALO LINK — パック（指で回して選ぶ → 封をなぞって切る → 1枚ずつフリック → ♛は全画面で動く → 並べて眺める）
'use strict';
const Pack = (() => {
  // パックの表紙（中身は同じ。好きな表紙を選んで開ける）
  const COVERS = [{art:'k_mika', n:'NIGHT'}, {art:'k_hina', n:'REST'}, {art:'k_miyako', n:'BEACH'}, {art:'k_serina', n:'HOLY'}, {art:'k_hoshino2', n:'SUMMER'}];
  const pickRar = tbl => { const r = Math.random() * 100; let acc = 0; for (const k of [4, 3, 2, 1]) { acc += tbl[k] || 0; if (r < acc) return k; } return 2; };
  function roll() {
    const out = [];
    for (let i = 0; i < 5; i++) {
      const rar = i < 3 ? 1 : pickRar(PACK.slot45[i - 3]);
      const pool = CARDS.filter(c => c.rar === rar);
      out.push(pool[Math.floor(Math.random() * pool.length)].id);
    }
    return out;
  }
  function canOpen() { Save.freeTick(); const s = Save.d; return s.free.n > 0 || s.ticket > 0; }
  async function open(cover = COVERS[0]) {
    const s = Save.d; Save.freeTick();
    if (s.free.n > 0) s.free.n--; else if (s.ticket > 0) s.ticket--; else { toast('開けられるパックがありません'); return; }
    const ids = roll();
    const res = ids.map(id => { const isNew = !s.owned[id]; s.owned[id] = (s.owned[id] || 0) + 1; return {id, isNew}; });
    s.pt += PACK.ptPerPack; Save.put();
    await show(res, cover);
  }

  // ===== パックの見た目 =====
  function packHTML(cover = COVERS[0]) {
    return `<div class="pk"><div class="pk-top"><i class="pk-tear"></i></div><div class="pk-body">
      <div class="pk-win" style="background-image:url(${cover.art}.webp)"></div><i class="pk-glare"></i>
      <div class="pk-logo">HALO<b>LINK</b></div><div class="pk-sub">BOOSTER 01 ・ ${cover.n}</div>
      <i class="pk-foil"></i></div></div>`;
  }

  // ===== 選ぶ：パックを指で回す =====
  let idx = 0;
  function carousel(box, onPick) {
    box.innerHTML = `<div class="pc">${COVERS.map((c, i) => `<div class="pc-item" data-i="${i}">${packHTML(c)}</div>`).join('')}</div><div class="pc-dots">${COVERS.map((_, i) => `<i data-i="${i}"></i>`).join('')}</div>`;
    const items = [...box.querySelectorAll('.pc-item')], dots = [...box.querySelectorAll('.pc-dots i')];
    const lay = (drag = 0) => items.forEach((el, i) => {
      let d = i - idx - drag; const n = COVERS.length; if (d > n / 2) d -= n; if (d < -n / 2) d += n;
      el.style.transform = `translateX(${d * 62}%) translateZ(${-Math.abs(d) * 160}px) rotateY(${-d * 32}deg)`;
      el.style.zIndex = 10 - Math.round(Math.abs(d) * 2); el.style.opacity = Math.abs(d) > 1.4 ? 0 : 1 - Math.abs(d) * .35;
      el.classList.toggle('cur', Math.abs(d) < .5);
    });
    const dot = () => dots.forEach((d, i) => d.classList.toggle('on', i === idx));
    lay(); dot();
    let sx = null, moved = false, W = 1;
    const pc = box.querySelector('.pc');
    pc.onpointerdown = e => { sx = e.clientX; moved = false; W = box.clientWidth * .6; pc.setPointerCapture(e.pointerId); items.forEach(el => el.style.transition = 'none'); };
    pc.onpointermove = e => { if (sx == null) return; const dx = (sx - e.clientX) / W; if (Math.abs(dx) > .04) moved = true; lay(dx); };
    pc.onpointerup = e => {
      if (sx == null) return; const dx = (sx - e.clientX) / W; sx = null;
      items.forEach(el => el.style.transition = '');
      if (moved && Math.abs(dx) > .2) { idx = (idx + (dx > 0 ? 1 : -1) + COVERS.length) % COVERS.length; Sfx.play('draw'); vib(6); lay(); dot(); return; }
      lay();
      if (!moved) onPick(COVERS[idx]);
    };
  }

  // ===== 開封の演出 =====
  async function show(res, cover) {
    const ov = $('po');
    ov.innerHTML = `<div class="po-bg"></div><div class="po-pack" id="poPack">${packHTML(cover)}<div class="po-cut"><i id="poLine"></i></div></div>
      <p class="po-guide" id="poGuide"><span></span>封の部分を左から右へなぞる</p>`;
    ov.className = 'on'; Sfx.play('tap');
    await cutOpen();
    // カードがパックから上に出てくる
    const pk = $('poPack'); pk.classList.add('drop');
    $('poGuide').remove();
    const stack = h('<div class="po-stack" id="poStack"></div>'); ov.appendChild(stack);
    res.slice().reverse().forEach(r => stack.appendChild(h(`<div class="po-card">${cardHTML(r.id, {cls:'big'})}${r.isNew ? '<em class="po-new">NEW</em>' : ''}</div>`)));
    const cards = [...stack.children].reverse();   // 0が一番上
    stack.animate([{transform:'translateY(42vh) scale(.82)', opacity:0}, {transform:'translateY(8vh) scale(.9)', opacity:1, offset:.5}, {transform:'none', opacity:1}], {duration:760, easing:'cubic-bezier(.2,.8,.2,1)', fill:'backwards'});
    Sfx.play('flip');
    await sleep(820); pk.remove();
    const tip = h('<p class="po-tip">左右にフリック（タップでも次へ）</p>'); ov.appendChild(tip);
    for (let i = 0; i < cards.length; i++) {
      const c = cardById(res[i].id), el = cards[i];
      el.classList.add('top');
      if (c.rar === 4) await immersive(c);
      if (c.rar >= 3) { const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, c.rar >= 4 ? '#ff9ef5' : '#ffd85a', 36, 180); Sfx.play('rare', c.rar); vib(c.rar >= 4 ? 60 : 25); el.classList.add('shine'); }
      if (i === cards.length - 1) tip.textContent = 'タップで一覧へ';
      await flick(el, i === cards.length - 1);
    }
    tip.remove(); stack.remove();
    // 並べて眺める
    const sum = h(`<div class="po-sum"><h3>GET!</h3><div class="po-grid">${res.map((r, i) => `<div class="po-g" data-id="${r.id}" style="animation-delay:${i * 80}ms">${cardHTML(r.id)}${r.isNew ? '<em class="po-new">NEW</em>' : ''}</div>`).join('')}</div>
      <p class="po-pt">タップで大きく見る ・ パックポイント +${PACK.ptPerPack}（所持 ${Save.d.pt}）</p>
      <div class="po-btns"><button class="btn sub" id="poClose">閉じる</button>${canOpen() ? '<button class="btn main" id="poMore">もう1パック</button>' : ''}</div></div>`);
    ov.appendChild(sum); Sfx.play('ok');
    sum.querySelector('.po-grid').onclick = e => { const g = e.target.closest('[data-id]'); if (g) UI.detail(g.dataset.id); };
    const more = await new Promise(r => { $('poClose').onclick = () => r(false); const m = $('poMore'); if (m) m.onclick = () => r(true); });
    ov.className = ''; ov.innerHTML = '';
    UI.refresh();
    if (more) open(cover);
  }

  // 封を切る：上部を横になぞる。切れ目が指についてくる
  function cutOpen() {
    return new Promise(res => {
      const pk = $('poPack'), line = $('poLine');
      let sx = null, max = 0, done = false;
      const finish = async () => {
        if (done) return; done = true;
        line.style.transform = 'scaleX(1)';
        Sfx.play('tear'); vib(45);
        pk.classList.add('torn');
        const r = pk.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height * .1, '#fff', 34, 170);
        await sleep(520); res();
      };
      pk.addEventListener('pointerdown', e => { const r = pk.getBoundingClientRect(); if (e.clientY - r.top < r.height * .4) { sx = e.clientX; pk.setPointerCapture(e.pointerId); } });
      pk.addEventListener('pointermove', e => {
        if (sx == null || done) return;
        const r = pk.getBoundingClientRect(), p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        if (p > max) { max = p; line.style.transform = `scaleX(${p})`; if (Math.random() < .35) Sfx.play('draw'); vib(3); }
        if (max > .92) finish();
      });
      pk.addEventListener('pointerup', () => { sx = null; if (!done && max < .92) { max = 0; line.style.transform = 'scaleX(0)'; } });
      // 3秒たっても切れないときは、タップでも開けられるように
      setTimeout(() => { if (!done) { const g = $('poGuide'); if (g) g.innerHTML += '<br><small>（タップでも開けられます）</small>'; pk.addEventListener('click', finish); } }, 3000);
    });
  }

  // 1枚をフリックで飛ばす（タップでも可）
  function flick(el, last) {
    return new Promise(res => {
      let sx = null, sy = 0, dx = 0;
      const go = async dir => {
        el.onpointerdown = el.onpointermove = el.onpointerup = null;
        if (last) { res(); return; }
        Sfx.play('draw');
        await el.animate([{transform:`translateX(${dx}px) rotate(${dx / 18}deg)`}, {transform:`translateX(${dir * 130}vw) translateY(-4vh) rotate(${dir * 24}deg)`}], {duration:320, easing:'cubic-bezier(.5,0,.8,.4)', fill:'forwards'}).finished;
        el.remove(); res();
      };
      el.onpointerdown = e => { sx = e.clientX; sy = e.clientY; dx = 0; el.setPointerCapture(e.pointerId); el.style.transition = 'none'; };
      el.onpointermove = e => { if (sx == null) return; dx = e.clientX - sx; el.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`; };
      el.onpointerup = e => {
        if (sx == null) return; sx = null; el.style.transition = '';
        if (Math.abs(dx) > 70) go(dx > 0 ? 1 : -1);
        else if (Math.abs(dx) < 8 && Math.abs(e.clientY - sy) < 8) { dx = 0; go(-1); }
        else el.style.transform = '';
      };
    });
  }

  // ♛：メモロビが全画面で動く（動画がない子は、静止画をゆっくり動かす）
  async function immersive(c) {
    const ov = $('imm'), vid = c.vid;
    ov.innerHTML = `<div class="im-flash"></div>${vid ? `<video src="${c.vid}.mp4" poster="${c.art}.webp" autoplay muted playsinline loop></video>` : `<div class="im-img" style="background-image:url(${c.art}.webp)"></div>`}
      <div class="im-cap"><span>♛ IMMERSIVE</span><b>${c.n}</b><small>${whoOf(c)}</small></div><p class="im-tip">タップで続ける</p>`;
    ov.className = 'on'; Sfx.play('rare', 4); vib(80);
    const v = ov.querySelector('video'); if (v) v.play().catch(() => {});
    await sleep(900);
    await new Promise(r => { ov.onclick = () => { ov.onclick = null; r(); }; setTimeout(() => { if (ov.onclick) { ov.onclick = null; r(); } }, 7000); });
    ov.className = 'on out'; await sleep(360); ov.className = ''; ov.innerHTML = '';
  }
  return { open, canOpen, packHTML, carousel, roll, COVERS };
})();
