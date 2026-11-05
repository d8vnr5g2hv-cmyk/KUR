// HALO LINK — データ（キャラ・カード・敵・ステージ・パック）。追加・調整はこのファイルだけで済む
'use strict';

// 属性：弱点を突くとダメージ1.5倍（火→木→水→火、光⇔闇）
const ATTR = {
  fire:{n:'火', c:'#ff6a4d'}, water:{n:'水', c:'#47a8ff'}, wood:{n:'木', c:'#4fdc86'},
  light:{n:'光', c:'#ffd85a'}, dark:{n:'闇', c:'#b46bff'}, none:{n:'無', c:'#c9d3e8'},
};
const STRONG = { fire:'wood', wood:'water', water:'fire', light:'dark', dark:'light' };
const TYPE = { atk:{n:'ATTACK', c:'#ff5a6e'}, def:{n:'GUARD', c:'#4aa8ff'}, sup:{n:'SKILL', c:'#b48cff'}, heal:{n:'HEAL', c:'#4fd69a'} };
const RAR = { 1:'◆', 2:'◆◆', 3:'★', 4:'♛' };

// ===== キャラ（パートナー） =====
// passive：パートナーにしたときの常時効果 / ex：EXスキル（ゲージ満タンで使える）
const CHARS = {
  noa:    { n:'乃亜',         attr:'light', col:'#ff9ad5',
            passive:{t:'startBlock', v:8, txt:'戦闘開始時、ガード8を得る'},
            ex:{n:'ねこの手ルーレット', fx:[['redraw', 5], ['energy', 2]], txt:'手札をすべて引き直し（5枚）、エネルギー+2'},
            lines:['今日も来てくれたんですね。', '少しだけ休んでいきませんか。', 'そんなに見られると、照れます。', '準備はできています。いつでもどうぞ。'] },
  mika:   { n:'ミカ',         attr:'light', col:'#ffc8ef',
            passive:{t:'atkUp', v:2, txt:'アタックカードのダメージ+2'},
            ex:{n:'星降りの祈り', fx:[['dmgAll', 30, 1]], txt:'敵全体に30ダメージ'},
            lines:['ねえ、今日はどこに連れていってくれるの？', '星がきれいな夜は、特別な気分になるよね。'] },
  ellen:  { n:'エレン・ジョー', attr:'dark',  col:'#ff5a6a',
            passive:{t:'killEnergy', v:1, txt:'敵を倒すたび、エネルギー+1'},
            ex:{n:'閉店作業', fx:[['dmg', 40, 1], ['draw', 2]], txt:'敵1体に40ダメージ、2枚引く'},
            lines:['……仕事だから、やるだけ。', '早く終わらせて、甘いものが食べたい。'] },
  yuuka:  { n:'ユウカ',       attr:'water', col:'#7aa8ff',
            passive:{t:'firstEnergy', v:1, txt:'1ターン目、エネルギー+1'},
            ex:{n:'完全予算管理', fx:[['block', 20], ['energy', 1], ['draw', 2]], txt:'ガード20、エネルギー+1、2枚引く'},
            lines:['計算なら任せてください。', '無駄な動きは減らしましょう。'] },
  hoshino:{ n:'ホシノ',       attr:'fire',  col:'#ffb0c8',
            passive:{t:'endBlock', v:3, txt:'ターン終了時、ガード3を得る'},
            ex:{n:'鉄壁の構え', fx:[['block', 30], ['weakAll', 2]], txt:'ガード30、敵全体に弱体2'},
            lines:['前は任せて。後ろは頼んだよ。', 'のんびりいこう。急いでも疲れるだけだし。'] },
  kisaki: { n:'キサキ',       attr:'wood',  col:'#9fd7c0',
            passive:{t:'regen', v:2, txt:'毎ターン開始時、HP2回復'},
            ex:{n:'皇帝の号令', fx:[['heal', 20], ['str', 3]], txt:'HP20回復、力+3'},
            lines:['お茶でもいかがかしら。', '焦らずに。盤面はよく見て。'] },
  hina:   { n:'ヒナ',         attr:'dark',  col:'#d9c8ff',
            passive:{t:'startWeak', v:1, txt:'戦闘開始時、敵全体に弱体1'},
            ex:{n:'終幕の一斉射', fx:[['dmgAll', 10, 3]], txt:'敵全体に10×3ダメージ'},
            lines:['……少しだけ、休憩してもいいかしら。', '書類は片付けたわ。次は何？'] },
  miyako: { n:'ミヤコ',       attr:'water', col:'#cfe3ff',
            passive:{t:'startDraw', v:2, txt:'1ターン目、カードを2枚多く引く'},
            ex:{n:'包囲制圧', fx:[['vulnAll', 3], ['draw', 3]], txt:'敵全体に脆弱3、3枚引く'},
            lines:['作戦はいつでも開始できます。', '……うさぎのお世話、見に来ますか？'] },
  mari:   { n:'マリー',       attr:'wood',  col:'#ffe0a8',
            passive:{t:'healUp', v:1.5, txt:'回復量が1.5倍'},
            ex:{n:'祝福の聖歌', fx:[['heal', 30], ['block', 10]], txt:'HP30回復、ガード10'},
            lines:['今日も、よい一日になりますように。', 'お祈りの時間、ご一緒しませんか？'] },
};

// ===== カード =====
// fx の種類：dmg[量,回数] 敵1体 / dmgAll[量,回数] 敵全体 / block ガード / heal 回復 / draw 引く / energy エネルギー
//            weak・weakAll 弱体（与ダメ-25%） / vuln・vulnAll 脆弱（被ダメ+50%） / str 力（ダメージ+） / poison・poisonAll 毒
// rar：1◆ 2◆◆ 3★ 4♛（メモロビ）。♛ はデッキに1枚まで
const CARDS = [
  // 耀平（共通）
  {id:'y_atk',  ch:'yohei', n:'踏み込み',   c:1, t:'atk',  rar:1, art:'g_atk',  fx:[['dmg', 6, 1]]},
  {id:'y_def',  ch:'yohei', n:'身構える',   c:1, t:'def',  rar:1, art:'g_def',  fx:[['block', 5]]},
  {id:'y_heal', ch:'yohei', n:'深呼吸',     c:1, t:'heal', rar:1, art:'g_heal', fx:[['heal', 4], ['draw', 1]]},
  {id:'y_sup',  ch:'yohei', n:'作戦会議',   c:0, t:'sup',  rar:2, art:'g_sup',  fx:[['draw', 2]]},
  {id:'y_big',  ch:'yohei', n:'全力の一撃', c:2, t:'atk',  rar:2, art:'g_big',  fx:[['dmg', 14, 1]]},
  // 乃亜
  {id:'noa_1', ch:'noa', n:'ねこパンチ',         c:1, t:'atk',  rar:1, art:'c_noa_atk',     fx:[['dmg', 5, 1], ['draw', 1]]},
  {id:'noa_2', ch:'noa', n:'おやすみの合図',     c:1, t:'def',  rar:1, art:'c_noa_bar',     fx:[['block', 6], ['heal', 2]]},
  {id:'noa_3', ch:'noa', n:'にゃんにゃんラッシュ', c:2, t:'atk', rar:2, art:'c_noa_spd',     fx:[['dmg', 3, 4]]},
  {id:'noa_4', ch:'noa', n:'ご奉仕タイム',       c:1, t:'sup',  rar:3, art:'c_noa_exa_evo', fx:[['energy', 2], ['draw', 2]]},
  {id:'noa_k', ch:'noa', n:'メイドの休日',       c:0, t:'heal', rar:4, art:'k_noa',         fx:[['heal', 10], ['energy', 1], ['draw', 2]]},
  // ミカ
  {id:'mika_1', ch:'mika', n:'星屑の一閃', c:1, t:'atk', rar:1, art:'c_mika_atk',     fx:[['dmg', 8, 1]]},
  {id:'mika_2', ch:'mika', n:'天使の羽',   c:1, t:'def', rar:1, art:'c_mika_bar',     fx:[['block', 7]]},
  {id:'mika_3', ch:'mika', n:'流星群',     c:2, t:'atk', rar:2, art:'c_mika_spd',     fx:[['dmgAll', 6, 2]]},
  {id:'mika_4', ch:'mika', n:'祈りの光',   c:2, t:'atk', rar:3, art:'c_mika_exa_evo', fx:[['dmg', 20, 1], ['vuln', 2]]},
  {id:'mika_k', ch:'mika', n:'夜の約束',   c:1, t:'atk', rar:4, art:'k_mika', vid:'v_mika',         fx:[['dmgAll', 15, 1], ['str', 2]]},
  // エレン・ジョー
  {id:'ellen_1', ch:'ellen', n:'サメの牙',     c:1, t:'atk', rar:1, art:'c_ellen_atk',     fx:[['dmg', 7, 1]]},
  {id:'ellen_2', ch:'ellen', n:'省エネモード', c:0, t:'def', rar:1, art:'c_ellen_bar',     fx:[['block', 4]]},
  {id:'ellen_3', ch:'ellen', n:'片付けの時間', c:1, t:'atk', rar:2, art:'c_ellen_spd',     fx:[['dmg', 4, 3]]},
  {id:'ellen_4', ch:'ellen', n:'定時退勤',     c:2, t:'atk', rar:3, art:'c_ellen_exa_evo', fx:[['dmg', 18, 1], ['draw', 2]]},
  {id:'ellen_k', ch:'ellen', n:'甘いご褒美',   c:1, t:'atk', rar:4, art:'k_ellen', vid:'v_ellen',         fx:[['dmg', 12, 2], ['energy', 1]]},
  // ユウカ
  {id:'yuuka_1', ch:'yuuka', n:'精密射撃', c:1, t:'atk', rar:1, art:'c_yuuka_atk',     fx:[['dmg', 6, 1], ['draw', 1]]},
  {id:'yuuka_2', ch:'yuuka', n:'予算防衛', c:1, t:'def', rar:1, art:'c_yuuka_bar',     fx:[['block', 8]]},
  {id:'yuuka_3', ch:'yuuka', n:'効率化',   c:0, t:'sup', rar:2, art:'c_yuuka_spd',     fx:[['energy', 1], ['draw', 1]]},
  {id:'yuuka_4', ch:'yuuka', n:'完全演算', c:2, t:'def', rar:3, art:'c_yuuka_exa_evo', fx:[['block', 12], ['draw', 2], ['energy', 1]]},
  {id:'yuuka_k', ch:'yuuka', n:'残業の夜', c:1, t:'def', rar:4, art:'k_yuuka', vid:'v_yuuka',         fx:[['block', 15], ['draw', 3]]},
  // ホシノ
  {id:'hoshino_1', ch:'hoshino', n:'散弾',       c:1, t:'atk', rar:1, art:'c_hoshino_atk',     fx:[['dmgAll', 4, 1]]},
  {id:'hoshino_2', ch:'hoshino', n:'盾を構える', c:1, t:'def', rar:1, art:'c_hoshino_bar',     fx:[['block', 9]]},
  {id:'hoshino_3', ch:'hoshino', n:'突撃',       c:2, t:'atk', rar:2, art:'c_hoshino_spd',     fx:[['dmg', 10, 1], ['block', 8]]},
  {id:'hoshino_4', ch:'hoshino', n:'守りの誓い', c:2, t:'def', rar:3, art:'c_hoshino_exa_evo', fx:[['block', 20], ['weakAll', 1]]},
  {id:'hoshino_k', ch:'hoshino', n:'水族館デート', c:1, t:'heal', rar:4, art:'k_hoshino', vid:'v_hoshino',     fx:[['block', 12], ['heal', 8]]},
  // キサキ
  {id:'kisaki_1', ch:'kisaki', n:'扇の一撃',   c:1, t:'atk',  rar:1, art:'c_kisaki_atk',     fx:[['dmg', 5, 1], ['poison', 2]]},
  {id:'kisaki_2', ch:'kisaki', n:'お茶の時間', c:1, t:'heal', rar:1, art:'c_kisaki_bar',     fx:[['heal', 5], ['block', 3]]},
  {id:'kisaki_3', ch:'kisaki', n:'毒蝶の舞',   c:1, t:'atk',  rar:2, art:'c_kisaki_spd',     fx:[['poisonAll', 4]]},
  {id:'kisaki_4', ch:'kisaki', n:'皇帝の采配', c:1, t:'sup',  rar:3, art:'c_kisaki_exa_evo', fx:[['str', 2], ['draw', 1]]},
  // ヒナ
  {id:'hina_1', ch:'hina', n:'制圧射撃',     c:1, t:'atk', rar:1, art:'c_hina_atk',     fx:[['dmg', 4, 2]]},
  {id:'hina_2', ch:'hina', n:'風紀の盾',     c:1, t:'def', rar:1, art:'c_hina_bar',     fx:[['block', 7], ['weak', 1]]},
  {id:'hina_3', ch:'hina', n:'一斉掃射',     c:2, t:'atk', rar:2, art:'c_hina_spd',     fx:[['dmgAll', 5, 2]]},
  {id:'hina_4', ch:'hina', n:'委員長命令',   c:2, t:'atk', rar:3, art:'c_hina_exa_evo', fx:[['dmg', 24, 1]]},
  {id:'hina_k', ch:'hina', n:'束の間の休息', c:1, t:'sup', rar:4, art:'k_hina', vid:'v_hina',         fx:[['vulnAll', 2], ['energy', 2]]},
  // ミヤコ
  {id:'miyako_1', ch:'miyako', n:'狙撃',     c:1, t:'atk', rar:1, art:'c_miyako_atk',     fx:[['dmg', 9, 1]]},
  {id:'miyako_2', ch:'miyako', n:'遮蔽',     c:1, t:'def', rar:1, art:'c_miyako_bar',     fx:[['block', 6], ['draw', 1]]},
  {id:'miyako_3', ch:'miyako', n:'閃光弾',   c:1, t:'sup', rar:2, art:'c_miyako_spd',     fx:[['weakAll', 2], ['vulnAll', 1]]},
  {id:'miyako_4', ch:'miyako', n:'作戦完了', c:2, t:'atk', rar:3, art:'c_miyako_exa_evo', fx:[['dmg', 8, 3]]},
  {id:'miyako_k', ch:'miyako', n:'浜辺の休息', c:0, t:'heal', rar:4, art:'k_miyako', vid:'v_miyako',     fx:[['heal', 6], ['block', 6], ['draw', 2]]},
  // マリー
  {id:'mari_1', ch:'mari', n:'祈りの歌',       c:1, t:'heal', rar:1, art:'c_mari_heal',    fx:[['heal', 6]]},
  {id:'mari_2', ch:'mari', n:'シスターの守り', c:1, t:'def',  rar:1, art:'c_mari_atk',     fx:[['block', 6], ['heal', 2]]},
  {id:'mari_3', ch:'mari', n:'聖歌',           c:1, t:'sup',  rar:2, art:'c_mari_buf',     fx:[['str', 1], ['block', 5]]},
  {id:'mari_4', ch:'mari', n:'奇跡の祈り',     c:2, t:'heal', rar:3, art:'c_mari_exh_evo', fx:[['heal', 15], ['block', 10]]},
  {id:'mari_k', ch:'mari', n:'アイドルステージ', c:1, t:'heal', rar:4, art:'k_mari', vid:'v_mari',       fx:[['heal', 12], ['str', 2]]},
  // ♛ 追加（2枚目のメモロビ）
  {id:'hoshino_k2', ch:'hoshino', n:'真夏のお昼寝',   c:1, t:'def',  rar:4, art:'k_hoshino2', vid:'v_hoshino2', fx:[['block', 10], ['heal', 6], ['energy', 1]]},
  {id:'mika_k2',    ch:'mika',    n:'浜辺の約束',     c:2, t:'atk',  rar:4, art:'k_mika2',    vid:'v_mika2',    fx:[['dmgAll', 12, 2]]},
  {id:'hina_k2',    ch:'hina',    n:'おやすみの時間', c:0, t:'heal', rar:4, art:'k_hina2',    vid:'v_hina2',    fx:[['heal', 8], ['draw', 2]]},
  {id:'mari_k2',    ch:'mari',    n:'お手伝いの日',   c:1, t:'heal', rar:4, art:'k_mari2',    vid:'v_mari2',    fx:[['heal', 8], ['block', 8]]},
  {id:'kisaki_k',   ch:'kisaki',  n:'皇帝の休日',     c:1, t:'sup',  rar:4, art:'k_kisaki',   vid:'v_kisaki',   fx:[['str', 3], ['heal', 6]]},
  // ♛ ゲスト（メモロビだけで登場する子。パートナーにはならない）
  {id:'g_serina', ch:'guest', gn:'セリナ', attr:'light', n:'聖夜の看護',       c:1, t:'heal', rar:4, art:'k_serina', vid:'v_serina', fx:[['heal', 15]]},
  {id:'g_nico',   ch:'guest', gn:'ニコ',   attr:'fire',  n:'台所の魔法',       c:1, t:'heal', rar:4, art:'k_nico',   vid:'v_nico',   fx:[['heal', 8], ['draw', 2]]},
  {id:'g_hikari', ch:'guest', gn:'ヒカリ', attr:'wood',  n:'出発進行',         c:0, t:'sup',  rar:4, art:'k_hikari', vid:'v_hikari', fx:[['energy', 2], ['draw', 1]]},
  {id:'g_seia',   ch:'guest', gn:'セイア', attr:'light', n:'夕暮れのドライブ', c:1, t:'sup',  rar:4, art:'k_seia',   vid:'v_seia',   fx:[['draw', 3], ['block', 6]]},
  {id:'g_noa2',   ch:'guest', gn:'ノア',   attr:'water', n:'おやすみの記録',   c:1, t:'def',  rar:4, art:'k_noa2',   vid:'v_noa2',   fx:[['block', 12], ['draw', 2]]},
];
const cardById = id => CARDS.find(c => c.id === id);
const attrOf = c => c.ch === 'yohei' ? 'none' : c.ch === 'guest' ? c.attr : CHARS[c.ch].attr;
const chName = ch => ch === 'yohei' ? '耀平' : ch === 'guest' ? 'ゲスト' : CHARS[ch].n;
const whoOf = c => c.ch === 'guest' ? c.gn : chName(c.ch);

// 効果の文章（数値は戦闘中の補正を反映できる）
function fxText(fx, mod = {}) {
  const d = (n) => { let v = n + (mod.str || 0) + (mod.atkUp || 0); if (mod.weak) v = Math.floor(v * .75); return v; };
  return fx.map(([k, a, b]) => {
    switch (k) {
      case 'dmg':      return b > 1 ? `${d(a)}×${b}ダメージ` : `${d(a)}ダメージ`;
      case 'dmgAll':   return b > 1 ? `敵全体に${d(a)}×${b}ダメージ` : `敵全体に${d(a)}ダメージ`;
      case 'block':    return `ガード${a}`;
      case 'heal':     return `HP${Math.floor(a * (mod.healUp || 1))}回復`;
      case 'draw':     return `${a}枚引く`;
      case 'redraw':   return `手札を引き直す`;
      case 'energy':   return `エネルギー+${a}`;
      case 'weak':     return `弱体${a}`;
      case 'weakAll':  return `敵全体に弱体${a}`;
      case 'vuln':     return `脆弱${a}`;
      case 'vulnAll':  return `敵全体に脆弱${a}`;
      case 'str':      return `力+${a}`;
      case 'poison':   return `毒${a}`;
      case 'poisonAll':return `敵全体に毒${a}`;
    }
    return '';
  }).join('、');
}
const needsTarget = c => c.fx.some(([k]) => ['dmg', 'weak', 'vuln', 'poison'].includes(k));

// ===== 敵 =====
// pat：行動の順番（ループ）。atk[量,回数] / block / str（自分の力） / weak・vuln（耀平に付与） / heal
const ENEMIES = {
  slime:  {n:'うさスライム',   img:'en_05',    attr:'water', hp:22, pat:[{atk:[6, 1]}, {atk:[6, 1]}, {block:5}]},
  slimeR: {n:'焔スライム',     img:'en_05',    attr:'fire',  hp:22, hue:150, pat:[{atk:[5, 1]}, {atk:[3, 2]}, {block:5}]},
  slimeG: {n:'苔スライム',     img:'en_05',    attr:'wood',  hp:24, hue:-90, pat:[{block:6}, {atk:[7, 1]}]},
  fox:    {n:'ホロ狐',         img:'en_01',    attr:'water', hp:30, pat:[{atk:[4, 2]}, {weak:1, atk:[4, 1]}, {block:8}]},
  cat:    {n:'夜猫',           img:'en_06',    attr:'dark',  hp:28, pat:[{atk:[9, 1]}, {str:2}, {atk:[4, 2]}]},
  owl:    {n:'光翼フクロウ',   img:'en_03',    attr:'light', hp:34, pat:[{atk:[7, 1]}, {vuln:1, atk:[5, 1]}, {heal:8}]},
  golem:  {n:'苔むすゴーレム', img:'en_04',    attr:'wood',  hp:62, pat:[{block:12}, {atk:[14, 1]}, {atk:[8, 1]}]},
  drake:  {n:'回路竜',         img:'en_02',    attr:'water', hp:50, pat:[{atk:[10, 1]}, {atk:[6, 2]}, {str:2, block:6}]},
  drone:  {n:'偵察ドローン',   img:'en_drone', attr:'fire',  hp:16, pat:[{atk:[3, 2]}, {atk:[5, 1]}]},
  heavy:  {n:'重装兵',         img:'en_heavy', attr:'dark',  hp:70, pat:[{block:14, atk:[6, 1]}, {atk:[18, 1]}, {str:2}]},
  robot:  {n:'機甲兵',         img:'en_robot', attr:'light', hp:58, pat:[{atk:[8, 2]}, {block:10, weak:1}]},
  crystal:{n:'結晶竜ヘイロン', img:'boss_01',  attr:'dark',  hp:190, boss:true,
           pat:[{atk:[14, 1]}, {str:3, block:20}, {atk:[6, 4]}, {weak:2, vuln:2}, {atk:[28, 1]}]},
};

// ===== ステージ =====
const STAGES = [
  {id:'1-1', n:'回廊の入口',   waves:[['slime', 'slimeR']],                    first:{ticket:1, pt:10}, aff:20},
  {id:'1-2', n:'狐火の通路',   waves:[['fox'], ['slime', 'drone']],           first:{ticket:1, pt:10}, aff:25},
  {id:'1-3', n:'夜の見張り台', waves:[['cat', 'owl']],                        first:{ticket:1, pt:15}, aff:25},
  {id:'1-4', n:'苔の大広間',   waves:[['drone', 'slimeG'], ['golem']],         first:{ticket:1, pt:15}, aff:30},
  {id:'1-5', n:'機甲区画',     waves:[['drake', 'fox'], ['robot'], ['heavy']], first:{ticket:2, pt:20}, aff:35},
  {id:'1-6', n:'結晶竜の巣',   waves:[['cat', 'owl'], ['crystal']],           first:{ticket:3, pt:40}, aff:60, boss:true},
];

// ===== パック =====
// 1パック5枚。1〜3枚目は◆、4・5枚目はレアが出る枠（％）
const PACK = {
  name:'HALO LINK　BOOSTER 01',
  slot45:[{1:0, 2:80, 3:16, 4:4}, {1:0, 2:58, 3:32, 4:10}],
  unlimited:true,   // テスト用：パックを無制限に開けられる（本番にするときは false）
  freeMax:2, freeHours:12,
  ptPerPack:5, cost:{1:10, 2:30, 3:120, 4:300},   // ポイント交換に必要なポイント
};
const DECK_SIZE = 20;
// デッキに入れられる枚数：耀平の基本カード（◆）は4枚、♛は1枚、ほかは2枚
const copyMax = c => c.rar === 4 ? 1 : (c.ch === 'yohei' && c.rar === 1) ? 4 : 2;
const HP_BASE = 60;
