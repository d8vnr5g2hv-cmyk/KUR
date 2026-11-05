// HALO LINK — カードの見た目（どの画面でも同じ部品を使う）と、共通の演出
'use strict';
const $ = id => document.getElementById(id) || DUMMY;
// 見つからない要素に触ってもエラーで止まらないように（古いファイルが残っていた場合の保険）
const DUMMY = new Proxy(document.createElement('div'), { get(t, k) { const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; }, set(t, k, v) { try { t[k] = v; } catch (e) {} return true; } });
// エラーが出たら画面に出す（原因を見つけやすくする）
addEventListener('error', e => { try { const t = document.getElementById('toast'); if (t) { t.textContent = 'エラー：' + (e.message || '') + '（' + String(e.filename || '').split('/').pop() + ' ' + (e.lineno || '') + '行）'; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); } } catch (_) {} });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };

const CROWN = '<svg viewBox="0 0 24 16"><path d="M2 14 L1 3 L7 8 L12 1 L17 8 L23 3 L22 14 Z" fill="currentColor"/></svg>';
function rarMark(r) {
  if (r === 4) return `<span class="rm crown">${CROWN}</span>`;
  if (r === 3) return '<span class="rm star">★</span>';
  return `<span class="rm dia">${'<i></i>'.repeat(r)}</span>`;
}
// カード1枚のHTML。opt.mod＝戦闘中の数値補正 / opt.n＝所持枚数 / opt.lock＝未所持
function cardHTML(id, opt = {}) {
  const c = cardById(id), a = ATTR[attrOf(c)], t = TYPE[c.t];
  const txt = fxText(c.fx, opt.mod || {});
  return `<div class="card r${c.rar} t-${c.t}${opt.lock ? ' lock' : ''}${opt.cls ? ' ' + opt.cls : ''}" data-id="${id}" style="--tc:${t.c};--ac:${a.c}">
    <div class="c-in">
      <div class="c-art" style="background-image:url(${c.art}.webp)"></div>
      <div class="c-shade"></div>
      ${c.rar >= 3 ? '<i class="c-foil"></i>' : ''}
      <div class="c-cost"><b>${c.c}</b></div>
      <div class="c-type">${t.n}</div>
      <div class="c-who"><i style="background:${a.c}"></i>${whoOf(c)}</div>
      <div class="c-name">${c.n}</div>
      <div class="c-text">${txt}</div>
      ${rarMark(c.rar)}
      ${opt.n ? `<span class="c-n">×${opt.n}</span>` : ''}
      ${opt.lock ? '<div class="c-lock">？</div>' : ''}
    </div></div>`;
}

// ===== 画面の切り替え：斜めのパネルが横切る =====
const Wipe = (() => {
  let el = null, busy = false;
  async function play(fn) {
    if (busy) { await fn(); return; }
    busy = true;
    if (!el) { el = h('<div id="wipe"><i></i><i></i><b></b></div>'); document.body.appendChild(el); }
    el.className = 'in';
    await sleep(300);
    try { await fn(); } catch (e) { console.warn(e); }
    el.className = 'out';
    await sleep(380);
    el.className = '';           // 終わったら必ず消す
    busy = false;
  }
  return { play };
})();

// ===== 光の粒（どこでも使える） =====
function burst(x, y, col, n = 10, spread = 60) {
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i'); p.className = 'pt'; p.style.background = i % 3 ? col : '#fff'; document.body.appendChild(p);
    const a = Math.random() * 6.283, r = spread * (.4 + Math.random() * .8);
    p.animate([{transform:`translate(${x}px,${y}px) scale(1)`, opacity:1}, {transform:`translate(${x + Math.cos(a) * r}px,${y + Math.sin(a) * r}px) scale(.2)`, opacity:0}],
      {duration:420 + Math.random() * 260, easing:'cubic-bezier(.2,.8,.3,1)', fill:'both'}).onfinish = () => p.remove();
  }
}
function toast(t) { const e = $('toast'); e.textContent = t; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); }

// ===== カードを傾けて光らせる（詳細表示用） =====
function tilt(el) {
  const move = e => {
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    el.style.transform = `perspective(900px) rotateY(${x * 22}deg) rotateX(${-y * 22}deg)`;
    el.style.setProperty('--mx', (x + .5) * 100 + '%'); el.style.setProperty('--my', (y + .5) * 100 + '%');
  };
  const leave = () => { el.style.transform = ''; };
  el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave); el.addEventListener('pointerup', leave);
}
