const fs = require('fs');
const s = fs.readFileSync('assets/index-D88q76o1.js', 'utf8');

const sub = s.slice(174200, 205000);
const re = /addEventListener\(['"](\w+)['"]/g;
let m;
while ((m = re.exec(sub)) !== null) {
  console.log('Event:', m[1], 'offset in rd:', m.index);
  console.log('Context:', sub.slice(Math.max(0, m.index - 50), m.index + 120));
}
