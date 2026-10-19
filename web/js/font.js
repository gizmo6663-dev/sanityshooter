// A tiny 3x5 pixel font for the HUD, so text matches the pixel art.
// Each glyph is 15 bits, row by row, 3 pixels wide.

const G = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  Æ: '011110111110111', Ø: '011101111101110', Å: '010101111101101',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010',
  8: '111101111101111', 9: '111101111001110',
  ' ': '000000000000000', '.': '000000000000010', ':': '000010000010000', '/': '001001010100100',
  '-': '000000111000000', '+': '000010111010000', '!': '010010010000010', '?': '110001010000010',
  '¢': '010111100111010', "'": '010010000000000', ',': '000000000010100',
};

const cache = new Map();

/** Returns a canvas with the text in pixels (with a dark drop shadow). */
export function textSprite(str, color = '#ddd0be', shadow = '#0d0705') {
  const key = str + color + shadow;
  if (cache.has(key)) return cache.get(key);
  const s = String(str).toUpperCase();
  const c = document.createElement('canvas');
  c.width = Math.max(1, s.length * 4 + 1);
  c.height = 7;
  const g = c.getContext('2d');
  for (const [col, off] of [[shadow, 1], [color, 0]]) {
    if (!col) continue;
    g.fillStyle = col;
    for (let k = 0; k < s.length; k++) {
      const glyph = G[s[k]] || G['?'];
      for (let i = 0; i < 15; i++) {
        if (glyph[i] === '1') g.fillRect(k * 4 + (i % 3) + off, 1 + Math.floor(i / 3) + off, 1, 1);
      }
      if (s[k] === 'Å') g.fillRect(k * 4 + 1 + off, off, 1, 1);
    }
  }
  cache.set(key, c);
  return c;
}

export const textWidth = (str) => String(str).length * 4;
