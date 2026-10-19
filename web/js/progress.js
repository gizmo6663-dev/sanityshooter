// Lifetime statistics, kept in localStorage. (Meta progression between
// runs comes in a later step.)

const SAVE_KEY = 'dypet.save.v1';

export class Progress {
  constructor() {
    this.runs = 0;
    this.wins = 0;
    this.bestFloor = 0;
    this.kills = 0;
    this.seenItems = [];
  }

  recordRun(world) {
    this.runs++;
    if (world.state === 'won') this.wins++;
    this.bestFloor = Math.max(this.bestFloor, world.floor + 1);
    this.kills += world.kills;
    for (const id of world.items) if (!this.seenItems.includes(id)) this.seenItems.push(id);
    this.save();
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        runs: this.runs, wins: this.wins, bestFloor: this.bestFloor, kills: this.kills, seenItems: this.seenItems,
      }));
    } catch (e) { /* storage unavailable */ }
  }

  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { d = null; }
    if (!d) return;
    this.runs = d.runs | 0;
    this.wins = d.wins | 0;
    this.bestFloor = d.bestFloor | 0;
    this.kills = d.kills | 0;
    this.seenItems = Array.isArray(d.seenItems) ? d.seenItems : [];
  }
}
