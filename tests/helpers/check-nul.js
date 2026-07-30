const t = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'game.js'), 'utf8');
const NUL = String.fromCharCode(0);
const i = t.indexOf(NUL);
console.log('first NUL at', i, 'of', t.length);
if (i >= 0) console.log(JSON.stringify(t.slice(Math.max(0, i - 150), i)));
