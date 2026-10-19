// Passive items (found in treasure rooms, shops and after bosses) and
// transformations (three items sharing a tag). Like in Isaac, items are the
// only way to get stronger: they either raise your stats or change how your
// shots deal damage. Items only change numbers in the stats object; the combinations
// come from shared rules in the world: shots carry elements and every effect
// a shot spawns (explosions, splits) carries them too, orbiting wisps apply
// the same on-hit effects, and so on.

import { Cfg } from './config.js';

export const TAGS = {
  fire:   { name: 'Ild',     color: '#d8642a' },
  ice:    { name: 'Is',      color: '#6fb8d8' },
  poison: { name: 'Gift',    color: '#6aa84f' },
  occult: { name: 'Okkult',  color: '#8e5bc4' },
  tear:   { name: 'Skudd',   color: '#c9b37a' },
  body:   { name: 'Kjøtt',   color: '#b0413e' },
};

export const ITEMS = {
  nail:    { name: 'Rusten nagle', icon: '🔩', tags: ['body'], text: 'Skade opp',
    desc: '+1 skade.', apply: (s) => { s.damage += 1; } },
  mirror:  { name: 'Sprukket speil', icon: '🪞', tags: ['tear'], text: 'Dobbelt syn',
    desc: 'Skyter to skudd, men litt saktere.', apply: (s) => { s.shots += 1; s.fireRateMult *= 0.9; } },
  eye3:    { name: 'Det tredje øyet', icon: '👁️', tags: ['tear', 'occult'], text: 'Ser alt',
    desc: 'Tre skudd i vifte. -20 % skade.', apply: (s) => { s.shots += 2; s.spread += 0.22; s.damageMult *= 0.8; } },
  chain:   { name: 'Sjelelenke', icon: '⛓️', tags: ['occult'], text: 'Skuddene finner veien',
    desc: 'Skuddene søker mot fiender.', apply: (s) => { s.homing += 3.5; } },
  splinter:{ name: 'Beinsplint', icon: '🦴', tags: ['body'], text: 'Gjennom kjøtt og bein',
    desc: 'Skuddene går gjennom to fiender.', apply: (s) => { s.pierce += 2; } },
  ember:   { name: 'Glødende kull', icon: '🔥', tags: ['fire'], text: 'Alt skal brenne',
    desc: 'Skuddene setter fyr på fiender.', apply: (s) => { s.fire += 1; } },
  frost:   { name: 'Frostbitt', icon: '❄️', tags: ['ice'], text: 'Kaldt hjerte',
    desc: 'Skuddene bremser fiender. Treff nok, og de fryser fast.', apply: (s) => { s.ice += 1; } },
  rot:     { name: 'Råtten kjertel', icon: '🧪', tags: ['poison'], text: 'Smittsom',
    desc: 'Skuddene forgifter. Forgiftede fiender etterlater en giftsky.', apply: (s) => { s.poison += 1; } },
  quick:   { name: 'Kvikksølv', icon: '💧', tags: ['body'], text: 'Fart opp',
    desc: '+15 % fart og skuddfart.', apply: (s) => { s.speedMult *= 1.15; s.shotSpeedMult *= 1.15; } },
  jar:     { name: 'Hjerte i krukke', icon: '🫀', tags: ['body'], text: 'Liv opp',
    desc: '+1 hjertebeholder og full helse.', apply: (s) => { s.maxHp += 2; }, onPickup: (w) => { w.healPlayer(99); } },
  powder:  { name: 'Svartkrutt', icon: '💣', tags: ['fire'], text: 'Smell',
    desc: 'Skuddene eksploderer når de treffer. Eksplosjonen får skuddets element.', apply: (s) => { s.explode += 1.0; } },
  skull:   { name: 'Splintret hodeskalle', icon: '💀', tags: ['tear', 'occult'], text: 'Splinter',
    desc: 'Skuddene deler seg i tre når de treffer.', apply: (s) => { s.split += 3; } },
  wisp:    { name: 'Irrbloss', icon: '🕯️', tags: ['occult', 'fire'], text: 'Følgesvenner',
    desc: 'To irrbloss kretser rundt deg og skader fiender. De får dine skudd-effekter.', apply: (s) => { s.orbitals += 2; } },
  leech:   { name: 'Igle', icon: '🩸', tags: ['body'], text: 'Blodtørst',
    desc: 'Hvert 12. drap gir et halvt hjerte.', apply: (s) => { s.leech = s.leech ? Math.max(6, s.leech - 4) : 12; } },
  prophet: { name: 'Gal profet', icon: '📿', tags: ['occult'], text: 'Skuddtakt opp',
    desc: '+0,8 skudd i sekundet.', apply: (s) => { s.fireRate += 0.8; } },
  thorns:  { name: 'Tornekrone', icon: '🌿', tags: ['occult', 'body'], text: 'Gjengjeld',
    desc: 'Når du blir truffet, skyter du en ring av skudd.', apply: (s) => { s.thorns += 10; } },
  cloak:   { name: 'Skyggekappe', icon: '🦇', tags: ['occult'], text: 'Bli skygge',
    desc: 'Dash skader fiender du passerer, og lades raskere.', apply: (s) => { s.dashDamage += 8; s.dashCooldownMult *= 0.7; } },
  lens:    { name: 'Forstørrelsesglass', icon: '🔍', tags: ['tear'], text: 'Større skudd',
    desc: 'Større skudd med 40 % mer skade, men de flyr saktere.', apply: (s) => { s.shotSize *= 1.5; s.damageMult *= 1.4; s.shotSpeedMult *= 0.8; } },
  pouch:   { name: 'Gravrøverens pose', icon: '💰', tags: [], text: 'Grådighet',
    desc: 'Dobbelt så mange mynter. Gir 5 mynter med en gang.', apply: (s) => { s.coinMult *= 2; }, onPickup: (w) => { w.player.coins += 5; } },
  moth:    { name: 'Dødsmøll', icon: '🦋', tags: ['tear'], text: 'Rekkevidde opp',
    desc: '+50 % rekkevidde, og skuddene flagrer.', apply: (s) => { s.rangeMult *= 1.5; s.wobble += 1; } },
  venomfang: { name: 'Giftand', icon: '🐍', tags: ['poison', 'body'], text: 'Bitt',
    desc: 'Forgiftede fiender tar 50 % mer skade.', apply: (s) => { s.poisonVuln += 0.5; s.poison += 0.3; } },
  shard:   { name: 'Isskår', icon: '🧊', tags: ['ice', 'tear'], text: 'Kald presisjon',
    desc: 'Frosne fiender tar dobbel skade.', apply: (s) => { s.frozenMult = 2; s.ice += 0.3; } },

  // Stat ups
  steak:   { name: 'Rått kjøtt', icon: '🥩', tags: ['body'], text: 'Liv og skade opp',
    desc: '+1 hjertebeholder og +0,5 skade.', apply: (s) => { s.maxHp += 2; s.damage += 0.5; } },
  shroom:  { name: 'Svart sopp', icon: '🍄', tags: ['poison'], text: 'Mye skade opp',
    desc: '+1,5 skade, men skuddene flyr litt saktere.', apply: (s) => { s.damage += 1.5; s.shotSpeedMult *= 0.88; } },
  boots:   { name: 'Graverens støvler', icon: '🥾', tags: [], text: 'Fart opp',
    desc: '+25 % fart.', apply: (s) => { s.speedMult *= 1.25; } },
  halo:    { name: 'Svart glorie', icon: '⭕', tags: ['occult'], text: 'Alt opp',
    desc: '+0,5 skade, +0,4 skuddtakt, +10 % fart og +15 % rekkevidde.',
    apply: (s) => { s.damage += 0.5; s.fireRate += 0.4; s.speedMult *= 1.1; s.rangeMult *= 1.15; } },
  bloodtear: { name: 'Blodtåre', icon: '🔻', tags: ['body', 'tear'], text: 'Kritisk',
    desc: '25 % sjanse for at et treff gjør dobbel skade.', apply: (s) => { s.crit += 0.25; } },

  // New ways to deal damage
  rubber:  { name: 'Sprettkule', icon: '🔴', tags: ['tear'], text: 'Sprett',
    desc: 'Skuddene spretter av vegger og steiner to ganger.', apply: (s) => { s.bounce += 2; s.rangeMult *= 1.2; } },
  sickle:  { name: 'Bumerangsigd', icon: '🌙', tags: ['tear'], text: 'Den kommer tilbake',
    desc: 'Skuddene snur og flyr tilbake til deg, og kan treffe på vei tilbake også.', apply: (s) => { s.boomerang = true; } },
  sulfur:  { name: 'Svovelhjerte', icon: '🌑', tags: ['fire', 'occult'], text: 'Ladet',
    desc: 'Hvert femte skudd er stort, gjør tredobbel skade og går gjennom alt.', apply: (s) => { s.charge = 5; } },
  janus:   { name: 'Janusmaske', icon: '🎭', tags: ['tear', 'occult'], text: 'Øyne i nakken',
    desc: 'Skyter også et skudd rett bakover.', apply: (s) => { s.backShot = true; } },
  storm:   { name: 'Stormkrone', icon: '⚡', tags: ['occult'], text: 'Lynkjede',
    desc: 'Treff sender et lyn videre til to fiender i nærheten (halv skade, med skuddets element).', apply: (s) => { s.chain += 2; } },
  cannon:  { name: 'Kanonkule', icon: '🎱', tags: ['tear', 'body'], text: 'Vokser',
    desc: 'Skuddene vokser mens de flyr og gjør opp til dobbel skade langt unna.', apply: (s) => { s.grow += 1; s.rangeMult *= 1.1; } },
  hammer:  { name: 'Smedens hammer', icon: '🔨', tags: ['body'], text: 'Tilbakeslag',
    desc: 'Skuddene slår fiender langt bakover, og kan lamme dem et øyeblikk.', apply: (s) => { s.knock *= 3.5; s.stun += 0.15; } },
  corpse:  { name: 'Likstøv', icon: '⚱️', tags: ['occult', 'body'], text: 'Etterskjelv',
    desc: 'Fiender du dreper sprekker i seks skudd.', apply: (s) => { s.deathShots += 6; } },
  armor:   { name: 'Beinrustning', icon: '🛡️', tags: ['body'], text: 'Skjold',
    desc: 'Blokkerer det første treffet i hvert rom.', apply: (s) => { s.shield += 1; } },
};

export const ITEM_IDS = Object.keys(ITEMS);

export const TRANSFORMS = {
  fire:   { name: 'Askebærer', icon: '🌋', desc: 'Brennende fiender eksploderer når de dør.', apply: (s) => { s.pyro = true; } },
  ice:    { name: 'Vinterhjerte', icon: '🥶', desc: 'Frosne fiender knuses og fryser alle rundt seg.', apply: (s) => { s.shatter = true; } },
  poison: { name: 'Pestbærer', icon: '☠️', desc: 'Gift smitter til fiender i nærheten.', apply: (s) => { s.plague = true; } },
  occult: { name: 'Okkultist', icon: '🔮', desc: '+1 irrbloss, og skuddene søker litt.', apply: (s) => { s.orbitals += 1; s.homing += 1.5; } },
  tear:   { name: 'Stormskudd', icon: '🌧️', desc: '+1 skudd og +15 % skuddtakt.', apply: (s) => { s.shots += 1; s.fireRateMult *= 1.15; } },
  body:   { name: 'Kjøttberg', icon: '🥩', desc: '+1 hjertebeholder og +1 skade.', apply: (s) => { s.maxHp += 2; s.damage += 1; } },
};

export function tagCounts(items) {
  const c = {};
  for (const id of items) for (const t of ITEMS[id].tags) c[t] = (c[t] || 0) + 1;
  return c;
}

export function activeTransforms(items) {
  const c = tagCounts(items);
  return Object.keys(TRANSFORMS).filter((t) => (c[t] || 0) >= 3);
}

/** Stats from base values + items + transformations. */
export function buildStats(items) {
  const s = {
    damage: Cfg.DAMAGE, damageMult: 1,
    fireRate: Cfg.FIRE_RATE, fireRateMult: 1,
    range: Cfg.RANGE, rangeMult: 1,
    shotSpeed: Cfg.SHOT_SPEED, shotSpeedMult: 1, shotSize: 1, wobble: 0,
    speed: Cfg.PLAYER_SPEED, speedMult: 1,
    maxHp: Cfg.PLAYER_HP,
    shots: 1, spread: 0.18, homing: 0, pierce: 0, split: 0, explode: 0, crit: 0,
    fire: 0, ice: 0, poison: 0, poisonVuln: 0, frozenMult: 1,
    orbitals: 0, thorns: 0, leech: 0,
    dashDamage: 0, dashCooldownMult: 1,
    magnetMult: 1, coinMult: 1,
    bounce: 0, boomerang: false, charge: 0, backShot: false, chain: 0, grow: 0,
    knock: 1, stun: 0, deathShots: 0, shield: 0,
    pyro: false, shatter: false, plague: false,
  };
  for (const id of items) ITEMS[id].apply(s);
  for (const t of activeTransforms(items)) TRANSFORMS[t].apply(s);
  s.maxHp = Math.min(Cfg.MAX_HP_CAP, s.maxHp);
  return s;
}
