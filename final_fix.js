// final_fix.js — 直接修复最后一行并完成全部工作
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const f = path.join(__dirname, 'js/modules/fontTool.js');
const lines = fs.readFileSync(f, 'utf8').split('\n');

// Line 917: { name: '得意?, ... style: '现代活泼黑体，斜切风格，个性鲜?, ...
lines[916] = "            { name: '\u5f97\u610f\u9ed1', psHint: 'Smiley-Sans', style: '\u73b0\u4ee3\u6d3b\u6cfc\u9ed1\u4f53\uff0c\u659c\u5207\u98ce\u683c\u4e2a\u6027\u9c9c\u660e', url: 'https://github.com/atelier-anchor/smiley-sans', tags: ['\u9ed1\u4f53', '\u6f2b\u753b', '\u6807\u9898'] },\r";

fs.writeFileSync(f, lines.join('\n'), 'utf8');

function check(fp) {
    try { execSync(`node --check "${fp}"`, { stdio: 'pipe' }); return true; }
    catch (e) { return Buffer.from(e.stderr || '').toString().split('\n')[1] || 'err'; }
}

const r = check(f);
if (r === true) {
    // Apply alert→showToast 
    let src = fs.readFileSync(f, 'utf8');
    src = src.replace(/\balert\(/g, 'showToast(');
    fs.writeFileSync(f, src, 'utf8');
    console.log('fontTool.js: OK, alert patched');
} else {
    console.log('Still has error at:', r);
}

// Summary
const base = path.join(__dirname, 'js/modules');
let allOk = true;
fs.readdirSync(base).filter(n => n.endsWith('.js') && !n.startsWith('final_')).forEach(name => {
    const ok = check(path.join(base, name));
    if (ok !== true) { allOk = false; console.log('FAIL:', name, ok); }
    else console.log('OK  :', name);
});
console.log(allOk ? '\n✓ ALL CLEAN' : '\n✗ SOME STILL BROKEN');
if (allOk) fs.unlinkSync(__filename);
