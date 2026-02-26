/**
 * fontNameParser.js
 * 扫描系统字体目录，解析每个字体文件的 name 表，提取中文名
 * CEP 插件中 Node.js 可直接使用 require
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ── 1. opentype.js ──
// 在 CEP 插件环境中，__dirname 可以准确指向当前模块的所在目录
const opentype = require(path.join(__dirname, '..', 'lib', 'opentype.min.js'));

// ── 2. 获取系统字体目录 ──
function getFontDirs() {
    const platform = os.platform();
    if (platform === 'win32') {
        return [
            path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts'),
            path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Windows', 'Fonts')
        ].filter(fs.existsSync);
    }
    if (platform === 'darwin') {
        const home = os.homedir();
        return [
            '/Library/Fonts',
            '/System/Library/Fonts',
            '/System/Library/Fonts/Supplemental',
            path.join(home, 'Library', 'Fonts')
        ].filter(fs.existsSync);
    }
    return ['/usr/share/fonts'].filter(fs.existsSync);
}

// ── 3. 从单个字体文件提取中文名 ──
function parseSingleFont(filePath) {
    try {
        const font = opentype.loadSync(filePath);
        const names = font.names;

        // postScriptName 是 PS 用来唯一标识字体的 key
        const psName = names.postScriptName?.en;
        if (!psName) return null;

        // 优先取中文全名，回退到中文族名
        const cnName = names.fullName?.zh
            || names.fontFamily?.zh
            || names.fullName?.['zh-Hans']
            || names.fontFamily?.['zh-Hans']
            || null;

        const enName = names.fullName?.en
            || names.fontFamily?.en
            || psName;

        return { psName, cnName, enName };
    } catch (e) {
        return null; // 跳过损坏/不支持的文件
    }
}

// ── 4. 递归扫描目录（支持子文件夹） ──
function scanDir(dir) {
    let files = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files = files.concat(scanDir(full));
            } else if (/\.(ttf|otf)$/i.test(entry.name)) {
                // 注意：.ttc 集合文件 opentype.js 不直接支持，先跳过
                files.push(full);
            }
        }
    } catch (e) { /* 权限不足等，静默跳过 */ }
    return files;
}

// ── 5. 主函数：构建 { postScriptName: cnName } 缓存 ──
function buildFontCNCache() {
    const cache = {};  // { "SourceHanSansSC-Regular": "思源黑体" }
    const dirs = getFontDirs();

    for (const dir of dirs) {
        const files = scanDir(dir);
        for (const file of files) {
            const result = parseSingleFont(file);
            if (result && result.cnName) {
                cache[result.psName] = result.cnName;
            }
        }
    }
    return cache;
}

// ── 6. 缓存持久化（存到插件独立的数据目录） ──
function getCacheFilePath(dataDir) {
    return path.join(dataDir, 'font-cn-cache.json');
}

function loadCache(dataDir) {
    const cacheFile = getCacheFilePath(dataDir);
    try {
        if (fs.existsSync(cacheFile)) {
            return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        }
    } catch (e) { /* 缓存损坏 */ }
    return null;
}

function saveCache(dataDir, cache) {
    const cacheFile = getCacheFilePath(dataDir);
    const dir = path.dirname(cacheFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2), 'utf8');
}

/**
 * 对外暴露的唯一接口
 * @param {string} dataDir - 插件数据目录
 * @param {boolean} forceRefresh - 是否强制重新扫描
 * @returns {{ [postScriptName: string]: string }}
 */
function getFontCNMap(dataDir, forceRefresh) {
    if (!forceRefresh) {
        const cached = loadCache(dataDir);
        if (cached && Object.keys(cached).length > 0) return cached;
    }
    const freshCache = buildFontCNCache();
    saveCache(dataDir, freshCache);
    return freshCache;
}

module.exports = { getFontCNMap, getCacheFilePath };
