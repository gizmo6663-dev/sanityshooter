// Items found during a run. Each item changes the round's modifiers ("mods")
// that sim.js reads. Items never talk to each other directly; they combine
// through shared mechanics: elements carry over to explosions, stomps and
// turret shots, gates copy every property of the mob that passes, and so on.
// Three items with the same tag unlock a transformation.

export const TAGS = {
  fire:   { name: 'Ild',     color: '#ff7a2a' },
  ice:    { name: 'Is',      color: '#6fdcff' },
  poison: { name: 'Gift',    color: '#5fd35a' },
  giant:  { name: 'Kjempe',  color: '#ffc23d' },
  gate:   { name: 'Port',    color: '#b36bff' },
  swarm:  { name: 'Sverm',   color: '#2f7dff' },
  wall:   { name: 'Mur',     color: '#8fa6c8' },
  gold:   { name: 'Gull',    color: '#ffd84a' },
};

// rarity: 1 common, 2 rare, 3 legendary
export const ITEMS = {
  // --- Elements ----------------------------------------------------------
  powder: {
    name: 'Brennende krutt', icon: '🔥', tags: ['fire'], rarity: 1,
    desc: '25 % av mobene er ildmober. Fiender de treffer, brenner.',
    apply: (m) => { m.el.fire += 0.25; m.burnDps += 1; },
  },
  dragon: {
    name: 'Dragepust', icon: '🐉', tags: ['fire'], rarity: 2,
    desc: 'Ild brenner dobbelt så lenge og sprer seg til fiender ved siden av.',
    apply: (m) => { m.burnTime *= 2; m.burnSpread = true; m.el.fire += 0.1; },
  },
  frost: {
    name: 'Frostkrystall', icon: '❄️', tags: ['ice'], rarity: 1,
    desc: '25 % av mobene er ismober. Fiender de treffer, fryser fast.',
    apply: (m) => { m.el.ice += 0.25; m.slowTime += 1; },
  },
  glacier: {
    name: 'Isbre', icon: '🧊', tags: ['ice', 'wall'], rarity: 2,
    desc: 'Fiender nær muren din går 60 % saktere. Frosne fiender tar dobbel skade.',
    apply: (m) => { m.frostWall = true; m.frozenDmgMult = 2; },
  },
  venom: {
    name: 'Giftsekk', icon: '🧪', tags: ['poison'], rarity: 1,
    desc: '25 % av mobene er giftmober. Når de dør, etterlater de en giftsky.',
    apply: (m) => { m.el.poison += 0.25; m.cloudSize += 1; },
  },
  plague: {
    name: 'Pestrotte', icon: '🐀', tags: ['poison', 'swarm'], rarity: 2,
    desc: 'Fiender som dør av gift, blir til en blå mob på din side.',
    apply: (m) => { m.plagueConvert = true; },
  },
  prism: {
    name: 'Prisme', icon: '🌈', tags: ['fire', 'ice', 'poison'], rarity: 3,
    desc: 'Element-effekter er 50 % sterkere, og hver mob har 10 % sjanse for hvert element.',
    apply: (m) => { m.el.fire += 0.1; m.el.ice += 0.1; m.el.poison += 0.1; m.elPower *= 1.5; },
  },

  // --- Mob properties ----------------------------------------------------
  kamikaze: {
    name: 'Kamikaze', icon: '💣', tags: ['swarm'], rarity: 1,
    desc: 'Mober eksploderer når de dør. Eksplosjonen får mobens element.',
    apply: (m) => { m.explode += 0.9; },
  },
  mitosis: {
    name: 'Celledeling', icon: '🧫', tags: ['swarm'], rarity: 2,
    desc: '30 % sjanse for at en mob som dør, deler seg i to små.',
    apply: (m) => { m.split += 0.3; },
  },
  shield: {
    name: 'Skjoldbærer', icon: '🛡️', tags: ['swarm', 'wall'], rarity: 1,
    desc: 'Hver tredje mob har et skjold som tar det første slaget.',
    apply: (m) => { m.shieldEvery = m.shieldEvery ? Math.max(1, m.shieldEvery - 1) : 3; },
  },
  ghost: {
    name: 'Spøkelsesdrakt', icon: '👻', tags: ['swarm'], rarity: 2,
    desc: 'Mober går gjennom den første fienden de møter.',
    apply: (m) => { m.ghost = true; },
  },
  heavy: {
    name: 'Tung ammo', icon: '🪨', tags: ['swarm'], rarity: 1,
    desc: '+2 liv per mob, men kanonen skyter 25 % saktere.',
    apply: (m) => { m.unitHp += 2; m.fireRate *= 0.75; },
  },
  boots: {
    name: 'Lynsko', icon: '👟', tags: ['swarm'], rarity: 1,
    desc: 'Mobene løper 40 % fortere.',
    apply: (m) => { m.unitSpeed *= 1.4; },
  },
  midas: {
    name: 'Midas-hanske', icon: '🧤', tags: ['gold'], rarity: 2,
    desc: '12 % av mobene er gullmober med tredobbelt liv. Gullmober gir mynter for drap.',
    apply: (m) => { m.goldChance += 0.12; },
  },

  // --- Cannon -------------------------------------------------------------
  twin: {
    name: 'Tvillingløp', icon: '🔱', tags: ['swarm'], rarity: 1,
    desc: '+1 mob per salve.',
    apply: (m) => { m.shots += 1; },
  },
  minigun: {
    name: 'Maskinkanon', icon: '⚙️', tags: [], rarity: 1,
    desc: 'Kanonen skyter 35 % raskere.',
    apply: (m) => { m.fireRate *= 1.35; },
  },
  shotgun: {
    name: 'Hagle', icon: '💥', tags: ['swarm'], rarity: 2,
    desc: 'Hver fjerde salve er en vifte med 6 ekstra mober.',
    apply: (m) => { m.shotgun += 6; },
  },
  rage: {
    name: 'Raseri', icon: '😡', tags: ['wall'], rarity: 1,
    desc: 'Når borgen tar skade, skyter kanonen dobbelt så fort i 4 sekunder.',
    apply: (m) => { m.rage = true; },
  },

  // --- Gates --------------------------------------------------------------
  gatemaster: {
    name: 'Portmester', icon: '🚪', tags: ['gate'], rarity: 2,
    desc: '+1 på alle ×-porter.',
    apply: (m) => { m.gateBonus += 1; },
  },
  elemgate: {
    name: 'Elementport', icon: '🌀', tags: ['gate'], rarity: 2,
    desc: 'Mober som går gjennom en port, får et tilfeldig element hvis de ikke har ett.',
    apply: (m) => { m.gateElement = true; },
  },
  mirror: {
    name: 'Speilport', icon: '🪞', tags: ['gate'], rarity: 2,
    desc: 'En ekstra ×2-port dukker opp på hvert nivå.',
    apply: (m) => { m.extraGates += 1; },
  },
  chargegate: {
    name: 'Ladeport', icon: '🔋', tags: ['gate', 'giant'], rarity: 1,
    desc: 'Hver port en mob passerer, lader kjempen litt.',
    apply: (m) => { m.gateCharge += 0.15; },
  },
  goldgate: {
    name: 'Gullport', icon: '🏅', tags: ['gate', 'gold'], rarity: 1,
    desc: 'Mober som passerer en port, har 8 % sjanse for å bli gullmober.',
    apply: (m) => { m.gateGold += 0.08; },
  },

  // --- Giant --------------------------------------------------------------
  thunder: {
    name: 'Tordenkjempe', icon: '⚡', tags: ['giant'], rarity: 2,
    desc: 'Kjempen tramper hvert sekund og skader alt rundt seg. Trampet får kjempens element.',
    apply: (m) => { m.stomp += 3; },
  },
  brood: {
    name: 'Kjempebarn', icon: '🐣', tags: ['giant', 'swarm'], rarity: 1,
    desc: 'Når kjempen dør, slipper den ut 12 mober.',
    apply: (m) => { m.brood += 12; },
  },
  twins: {
    name: 'Kjempetvillinger', icon: '👯', tags: ['giant'], rarity: 3,
    desc: 'Kjempen kommer alltid i par.',
    apply: (m) => { m.giantPair = true; },
  },
  steroids: {
    name: 'Kjempeserum', icon: '💉', tags: ['giant'], rarity: 1,
    desc: 'Kjempen har 60 % mer liv og lades 25 % raskere.',
    apply: (m) => { m.giantHp *= 1.6; m.giantCharge *= 0.75; },
  },
  banner: {
    name: 'Krigsbanner', icon: '🚩', tags: ['giant', 'swarm'], rarity: 2,
    desc: 'Mober nær kjempen får skjold.',
    apply: (m) => { m.giantAura = true; },
  },

  // --- Wall & economy --------------------------------------------------------
  turret: {
    name: 'Murtårn', icon: '🗼', tags: ['wall'], rarity: 1,
    desc: 'Et tårn på muren skyter mot nærmeste fiende. Skuddene får tilfeldig element du eier.',
    apply: (m) => { m.turrets += 1; },
  },
  spikes: {
    name: 'Piggmur', icon: '🌵', tags: ['wall'], rarity: 1,
    desc: 'Fiender som når muren, gjør halv skade og eksploderer.',
    apply: (m) => { m.spikes = true; },
  },
  greed: {
    name: 'Grådighet', icon: '💰', tags: ['gold'], rarity: 1,
    desc: '+50 % mynter, men fiendene har 20 % mer liv.',
    apply: (m) => { m.coinMult *= 1.5; m.enemyHp *= 1.2; },
  },
  bank: {
    name: 'Sparegris', icon: '🐷', tags: ['gold'], rarity: 1,
    desc: '15 % rente på myntene dine etter hvert nivå (maks 60).',
    apply: (m) => { m.interest += 0.15; },
  },
  vampire: {
    name: 'Blodtørst', icon: '🩸', tags: ['wall'], rarity: 2,
    desc: 'Hvert 40. drap reparerer borgen med 1 liv.',
    apply: (m) => { m.regenKills = m.regenKills ? Math.max(15, m.regenKills - 15) : 40; },
  },
};

export const ITEM_IDS = Object.keys(ITEMS);

// Three items sharing a tag unlock its transformation.
export const TRANSFORMS = {
  fire:   { name: 'Pyroman',    icon: '☄️', desc: 'Brennende fiender eksploderer i ild når de dør. Ild gjør dobbel skade.',
            apply: (m) => { m.pyro = true; m.burnDps *= 2; } },
  ice:    { name: 'Permafrost', icon: '🥶', desc: 'Frosne fiender knuses og fryser alle rundt seg når de dør.',
            apply: (m) => { m.shatter = true; m.slowTime += 1; } },
  poison: { name: 'Pestlege',   icon: '☠️', desc: 'Giftskyer er dobbelt så store og varer lenger.',
            apply: (m) => { m.cloudSize *= 2; m.cloudTime *= 1.6; } },
  giant:  { name: 'Titan',      icon: '🗿', desc: 'En gratis kjempe kommer av seg selv hvert 14. sekund.',
            apply: (m) => { m.autoGiant = 14; } },
  gate:   { name: 'Portherre',  icon: '🏛️', desc: '+1 på alle porter, og hver portpassering gir litt mynter.',
            apply: (m) => { m.gateBonus += 1; m.gateCoins += 0.05; } },
  swarm:  { name: 'Legion',     icon: '🐜', desc: 'Plass til 200 flere mober på banen, og alle mober får +1 liv.',
            apply: (m) => { m.maxBlue += 200; m.unitHp += 1; } },
  wall:   { name: 'Festning',   icon: '🏯', desc: '+1 murtårn, og borgen reparerer seg selv litt hvert 6. sekund.',
            apply: (m) => { m.turrets += 1; m.wallRegen = 6; } },
  gold:   { name: 'Kong Midas', icon: '👑', desc: 'Gullmober har femdobbelt liv, og 5 % av alle mober blir gull.',
            apply: (m) => { m.goldMult = 5; m.goldChance += 0.05; } },
};

export function tagCounts(items) {
  const counts = {};
  for (const id of items) for (const t of ITEMS[id].tags) counts[t] = (counts[t] || 0) + 1;
  return counts;
}

export function activeTransforms(items) {
  const c = tagCounts(items);
  return Object.keys(TRANSFORMS).filter((t) => (c[t] || 0) >= 3);
}

/** Builds the round modifiers from meta upgrades + run items. */
export function buildMods(meta, items) {
  const m = {
    fireRate: 1 / meta.fireInterval(),  // volleys per second
    shots: meta.shotsPerVolley(),
    unitHp: meta.unitHp(),
    unitSpeed: 1,
    shotgun: 0,
    rage: false,
    el: { fire: 0, ice: 0, poison: 0 },
    elPower: 1,
    burnDps: 1, burnTime: 3, burnSpread: false,
    slowTime: 2, frozenDmgMult: 1, frostWall: false,
    cloudSize: 1, cloudTime: 3, plagueConvert: false,
    explode: 0, split: 0, shieldEvery: 0, ghost: false,
    goldChance: 0, goldMult: 3,
    gateBonus: meta.gateBonus(), gateElement: false, extraGates: 0, gateCharge: 0, gateGold: 0, gateCoins: 0,
    stomp: 0, brood: 0, giantPair: false, giantAura: false, autoGiant: 0,
    giantHp: meta.giantHp(), giantCharge: meta.giantCharge(),
    turrets: 0, spikes: false, wallRegen: 0, regenKills: 0,
    coinMult: meta.coinMult(), enemyHp: 1, interest: 0,
    pyro: false, shatter: false,
    maxBlue: 0,
  };
  for (const id of items) ITEMS[id].apply(m);
  for (const t of activeTransforms(items)) TRANSFORMS[t].apply(m);
  return m;
}
