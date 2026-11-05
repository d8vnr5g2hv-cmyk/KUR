// HALO LINK — 保存（この端末のブラウザ）
'use strict';
const Save = (() => {
  const KEY = 'halolink-cards-v1';
  const STARTER = ['y_atk', 'y_atk', 'y_atk', 'y_def', 'y_def', 'y_def', 'y_heal', 'y_heal',
    'noa_1', 'noa_1', 'noa_2', 'noa_2', 'yuuka_1', 'yuuka_2', 'hoshino_1', 'hoshino_2', 'kisaki_1', 'kisaki_2', 'y_atk', 'y_def'];
  const DEF = () => {
    const owned = {}; STARTER.forEach(id => owned[id] = (owned[id] || 0) + 1);
    return { owned, deck:STARTER.slice(), partner:'noa', aff:{}, ticket:3, free:{n:PACK.freeMax, at:Date.now()}, pt:0, cleared:{}, seen:{} };
  };
  let d = DEF();
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) d = Object.assign(DEF(), s); } catch (e) {}
  const put = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} };

  // 無料パック：時間で回復（最大2）
  function freeTick() {
    const f = d.free, step = PACK.freeHours * 3600e3;
    if (f.n >= PACK.freeMax) { f.at = Date.now(); return 0; }
    const gain = Math.floor((Date.now() - f.at) / step);
    if (gain > 0) { f.n = Math.min(PACK.freeMax, f.n + gain); f.at += gain * step; if (f.n >= PACK.freeMax) f.at = Date.now(); put(); }
    return f.n >= PACK.freeMax ? 0 : step - (Date.now() - f.at);
  }
  // 好感度：Lvごとに必要経験値が少しずつ増える（最大Lv10）
  const affNeed = lv => 40 + lv * 20;
  function aff(ch) { return d.aff[ch] || (d.aff[ch] = {lv:1, exp:0}); }
  function addAff(ch, x) {
    const a = aff(ch); let up = 0;
    a.exp += x;
    while (a.lv < 10 && a.exp >= affNeed(a.lv)) { a.exp -= affNeed(a.lv); a.lv++; up++; }
    if (a.lv >= 10) a.exp = 0;
    put(); return up;
  }
  // 持っているキャラ（そのキャラのカードを1枚でも持っている）
  const ownedChars = () => Object.keys(CHARS).filter(ch => CARDS.some(c => c.ch === ch && d.owned[c.id]));
  const maxHp = () => HP_BASE + (aff(d.partner).lv - 1) * 2;
  return { get d() { return d; }, put, freeTick, aff, addAff, affNeed, ownedChars, maxHp, reset() { d = DEF(); put(); } };
})();
