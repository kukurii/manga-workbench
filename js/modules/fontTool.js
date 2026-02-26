// fontTool.js - 字体库管理与快捷应用

class FontManager {
    constructor(csInterface, extPath, dataDir) {
        this.cs = csInterface;
        this.extPath = extPath;
        this.dataDir = dataDir;
        this.allFonts = [];
        this.favFonts = []; // { postScriptName, name, alias, category }
        this.recentFonts = []; // 最近使用记录
        this.compareFonts = []; // 当前加入对比测试的字库合集
        this.draggedFont = null; // 用于拖拽暂存

        this.onlineFonts = []; // Array of { name, author, style, url, previewUrl, source }
        this.onlineSource = 'zeoseven'; // 'zeoseven' or 'google'

        this.currentMode = 'system'; // 'system' or 'favorite' or 'online'
        this.sysFilter = 'all'; // all, chinese, english
        this.favFilter = 'all'; // all, 或者用户自定义的类别

        this._fontCNMap = null;
        this._userAliases = null;

        this.initDOM();
        this.bindEvents();

        this.initFontDisplayNames(false); // 优先读缓存
        this.loadFavFonts();
        this.loadRecentFonts();
        this.loadFonts();
    }

    initDOM() {
        // UI
        this.modeBtns = document.getElementById('font-mode-tabs');
        this.sysTools = document.getElementById('font-system-tools');
        this.favTools = document.getElementById('font-fav-tools');
        this.onlineTools = document.getElementById('font-online-tools');

        this.inputSearch = document.getElementById('input-font-search');
        this.btnRefresh = document.getElementById('btn-refresh-fonts');
        this.filterBtns = document.getElementById('font-category-filters');

        this.favFilterContainer = document.getElementById('fav-category-filters');

        this.inputOnlineSearch = document.getElementById('input-online-search');
        this.btnSearchOnline = document.getElementById('btn-search-online');
        this.btnAiRecommend = document.getElementById('btn-ai-recommend');
        this.onlineSourceTabs = document.getElementById('online-source-tabs');

        this.listTitle = document.getElementById('font-list-title');
        this.listContainer = document.getElementById('font-list-container');
        this.labCount = document.getElementById('font-count-lab');

        // 外部跳转按钮
        this.btnJumpZfont = document.getElementById('btn-jump-zfont');
        this.btnJumpZeoSeven = document.getElementById('btn-jump-zeoseven');
        this.fontInstallTip = document.getElementById('font-install-tip');

        // Modal
        this.modal = document.getElementById('modal-fav-font');
        this.mName = document.getElementById('fav-font-psname');
        this.mPost = document.getElementById('fav-font-postname');
        this.mAlias = document.getElementById('fav-font-alias');
        this.mCategory = document.getElementById('fav-font-category');

        this.btnSaveFav = document.getElementById('btn-save-fav');
        this.btnCancelFav = document.getElementById('btn-cancel-fav');
        this.btnRemoveFav = document.getElementById('btn-remove-fav');

        // Apply scope
        this.selApplyScope = document.getElementById('sel-font-apply-scope');

        // Compare
        this.cmpFloatBar = document.getElementById('cmp-float-bar');
        this.cmpCount = document.getElementById('cmp-count');
        this.btnOpenCmp = document.getElementById('btn-open-cmp');
        this.btnClearCmp = document.getElementById('btn-clear-cmp');

        this.modalCmp = document.getElementById('modal-compare-font');
        this.btnCloseCmp = document.getElementById('btn-close-cmp');
        this.cmpText = document.getElementById('cmp-preview-text');
        this.cmpList = document.getElementById('cmp-list-container');
    }

    bindEvents() {
        // 模式切换
        if (this.modeBtns) {
            this.modeBtns.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON') return;
                Array.from(this.modeBtns.children).forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');

                this.currentMode = e.target.getAttribute('data-mode');

                if (this.currentMode === 'system') {
                    if (this.sysTools) this.sysTools.style.display = 'block';
                    if (this.favTools) this.favTools.style.display = 'none';
                    if (this.onlineTools) this.onlineTools.style.display = 'none';
                    if (this.listTitle) this.listTitle.parentElement.style.display = 'flex';
                    if (this.fontInstallTip) this.fontInstallTip.style.display = 'block';

                    if (this.listContainer) this.listContainer.style.display = 'block';
                    if (this.listTitle) this.listTitle.innerText = "系统装载字库";
                    this.renderFonts();
                } else if (this.currentMode === 'favorite') {
                    if (this.sysTools) this.sysTools.style.display = 'none';
                    if (this.favTools) this.favTools.style.display = 'block';
                    if (this.onlineTools) this.onlineTools.style.display = 'none';
                    if (this.listTitle) this.listTitle.parentElement.style.display = 'flex';
                    if (this.fontInstallTip) this.fontInstallTip.style.display = 'block';

                    if (this.listContainer) this.listContainer.style.display = 'block';
                    if (this.listTitle) this.listTitle.innerText = "我的自建字库集";
                    this.renderFavCategories();
                    this.renderFonts();
                } else if (this.currentMode === 'online') {
                    if (this.sysTools) this.sysTools.style.display = 'none';
                    if (this.favTools) this.favTools.style.display = 'none';
                    if (this.onlineTools) this.onlineTools.style.display = 'block';
                    if (this.listTitle) this.listTitle.parentElement.style.display = 'none';
                    if (this.fontInstallTip) this.fontInstallTip.style.display = 'none';
                    if (this.listContainer) this.listContainer.style.display = 'none';
                    // 初始化精选字体卡片（只首次渲染）
                    const onlineList = document.getElementById('online-font-list');
                    if (onlineList && !onlineList.children.length) this.renderOnlineFontList('all');
                }

            });
        }

        // 系统搜索及刷新
        if (this.btnRefresh) {
            this.btnRefresh.addEventListener('click', () => {
                this.loadFonts(true);
            });
        }
        if (this.inputSearch) {
            this.inputSearch.addEventListener('input', () => {
                this.renderFonts();
            });
        }

        // 系统列表分类及收藏夹分类过滤
        if (this.filterBtns) {
            this.filterBtns.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON') return;
                Array.from(this.filterBtns.children).forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                this.sysFilter = e.target.getAttribute('data-filter');
                this.renderFonts();
            });
        }

        // 清理缓存按钮
        const btnClearCache = document.getElementById('btn-clear-font-cache');
        if (btnClearCache) {
            btnClearCache.addEventListener('click', () => {
                // 只清理 PS 字体列表缓存，保留中文名映射（font-cn-cache.json）
                const psCacheList = this.dataDir + "/font_cache.json";
                const r = window.cep.fs.deleteFile(psCacheList);
                if (r.err === window.cep.fs.NO_ERROR || r.err === window.cep.fs.ERR_NOT_FOUND) {
                    alert('字体列表缓存已清除，下次打开字体面板将重新扫描。\n（中文名映射文件已保留）');
                } else {
                    alert('清除失败，错误码：' + r.err);
                }
            });
        }

        // 导出收藏 JSON
        const btnExportFav = document.getElementById('btn-export-fav-json');
        if (btnExportFav) {
            btnExportFav.addEventListener('click', () => this.exportFavJson());
        }

        // 导入收藏 JSON（通过 CEP 文件对话框，不依赖隐藏的 file input）
        const btnImportFav = document.getElementById('btn-import-fav-json');
        if (btnImportFav) {
            btnImportFav.addEventListener('click', () => this.importFavJson());
        }

        if (this.favFilterContainer) {
            this.favFilterContainer.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON') return;
                Array.from(this.favFilterContainer.children).forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                this.favFilter = e.target.getAttribute('data-filter');
                this.renderFonts();
            });
        }

        // --- 在线字体模块相关外部跳转与AI事件 ---
        if (this.btnJumpZfont) {
            this.btnJumpZfont.addEventListener('click', () => {
                const q = this.inputOnlineSearch && this.inputOnlineSearch.value ? encodeURIComponent(this.inputOnlineSearch.value) : '';
                window.cep.util.openURLInDefaultBrowser(q ? `https://zfont.cn/search?q=${q}` : 'https://zfont.cn/');
            });
        }
        if (this.btnJumpZeoSeven) {
            this.btnJumpZeoSeven.addEventListener('click', () => {
                const q = this.inputOnlineSearch && this.inputOnlineSearch.value ? encodeURIComponent(this.inputOnlineSearch.value) : '';
                window.cep.util.openURLInDefaultBrowser(q ? `https://fonts.zeoseven.com/browse/?keyword=${q}` : 'https://fonts.zeoseven.com/');
            });
        }
        if (this.btnAiRecommend) {
            this.btnAiRecommend.addEventListener('click', () => {
                const query = this.inputOnlineSearch ? this.inputOnlineSearch.value.trim() : '';
                if (!query) return alert('请描述漫画场景或情绪，例如：愤怒男主的大吼、少女内心独白、轻描淡写的对话等。');
                this.callAiFontRecommendation(query);
            });
        }
        // AI 清空按钮
        const btnAiClear = document.getElementById('btn-ai-clear');
        if (btnAiClear) {
            btnAiClear.addEventListener('click', () => {
                if (this.inputOnlineSearch) this.inputOnlineSearch.value = '';
                const area = document.getElementById('ai-result-area');
                if (area) area.style.display = 'none';
            });
        }
        // 在线字体标签筛选
        const tagFilters = document.getElementById('online-tag-filters');
        if (tagFilters) {
            tagFilters.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON') return;
                Array.from(tagFilters.children).forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.renderOnlineFontList(e.target.dataset.tag);
            });
        }


        // 收藏弹窗相关操作
        if (this.btnCancelFav) {
            this.btnCancelFav.addEventListener('click', () => {
                this.modal.style.display = 'none';
            });
        }

        if (this.btnSaveFav) {
            this.btnSaveFav.addEventListener('click', () => {
                const postName = this.mPost.innerText;
                const originalName = this.mName.innerText;
                const alias = this.mAlias.value.trim();
                const category = this.mCategory.value.trim() || '未分类';

                // 保存至旧的独立收藏结构中
                const idx = this.favFonts.findIndex(f => f.postScriptName === postName);
                if (idx > -1) {
                    this.favFonts[idx].alias = alias;
                    this.favFonts[idx].category = category;
                } else {
                    this.favFonts.push({
                        postScriptName: postName,
                        name: originalName,
                        alias: alias,
                        category: category
                    });
                }
                this.saveFavFonts();

                // 同步保存至新别名缓存系统
                if (!this._userAliases) this._userAliases = {};
                if (alias) {
                    this._userAliases[postName] = alias;
                } else {
                    delete this._userAliases[postName];
                }
                this.saveUserAliases();

                this.modal.style.display = 'none';
                if (this.currentMode === 'favorite') this.renderFavCategories();
                this.renderFonts();
            });
        }

        if (this.btnRemoveFav) {
            this.btnRemoveFav.addEventListener('click', () => {
                const postName = this.mPost.innerText;
                this.favFonts = this.favFonts.filter(f => f.postScriptName !== postName);
                this.saveFavFonts();

                // 同步移除别名
                if (this._userAliases && this._userAliases[postName]) {
                    delete this._userAliases[postName];
                    this.saveUserAliases();
                }

                this.modal.style.display = 'none';
                if (this.currentMode === 'favorite') this.renderFavCategories();
                this.renderFonts();
            });
        }

        // 对比台事件
        if (this.btnOpenCmp) {
            this.btnOpenCmp.addEventListener('click', () => {
                this.openCompareModal();
            });
        }
        if (this.btnClearCmp) {
            this.btnClearCmp.addEventListener('click', () => {
                this.compareFonts = [];
                this.updateCompareBar();
                this.renderFonts();
            });
        }
        if (this.btnCloseCmp) {
            this.btnCloseCmp.addEventListener('click', () => {
                this.modalCmp.style.display = 'none';
            });
        }
        if (this.cmpText) {
            this.cmpText.addEventListener('input', () => {
                this.renderCompareList();
            });
        }
    }

    // ------------ 持久性收藏夹管理 ------------

    initFontDisplayNames(forceRefresh) {
        // ── 第一步：优先用 window.cep.fs 直接读取缓存文件（避免中文路径下 Node.js require 失败）
        const cnCachePath = this.dataDir + "/font-cn-cache.json";

        if (!forceRefresh) {
            const cacheResult = window.cep.fs.readFile(cnCachePath);
            if (cacheResult.err === window.cep.fs.NO_ERROR && cacheResult.data) {
                try {
                    const parsed = JSON.parse(cacheResult.data);
                    if (parsed && Object.keys(parsed).length > 0) {
                        this._fontCNMap = parsed;
                        // 读用户别名后直接返回
                        this._loadUserAliases();
                        return;
                    }
                } catch (e) { /* 缓存损坏，继续往下扫描 */ }
            }
        }

        // ── 第二步：缓存不存在或强制刷新时，用 fontNameParser（Node.js）扫描系统字体
        try {
            const path = require('path');
            const parserPath = path.join(this.extPath, 'js', 'modules', 'fontNameParser.js');
            // 清除 require 缓存，防止旧模块残留
            delete require.cache[require.resolve(parserPath)];
            const parser = require(parserPath);
            this._fontCNMap = parser.getFontCNMap(this.dataDir, true);
        } catch (e) {
            console.error('fontNameParser 加载失败', e);
            this._fontCNMap = {};
        }

        // 读用户别名
        this._loadUserAliases();
    }

    _loadUserAliases() {
        const aliPath = this.dataDir + "/user_font_aliases.json";
        const readResult = window.cep.fs.readFile(aliPath);
        if (readResult.err === window.cep.fs.NO_ERROR && readResult.data) {
            try { this._userAliases = JSON.parse(readResult.data); } catch (e) { this._userAliases = {}; }
        } else {
            this._userAliases = {};
        }
    }

    saveUserAliases() {
        const aliPath = this.dataDir + "/user_font_aliases.json";
        window.cep.fs.writeFile(aliPath, JSON.stringify(this._userAliases || {}));
    }

    getFontDisplayName(postScriptName, familyName) {
        // 第一优先：用户自定义别名
        if (this._userAliases && this._userAliases[postScriptName]) {
            return {
                primary: '⭐ ' + this._userAliases[postScriptName],
                secondary: familyName || postScriptName,
                source: 'alias'
            };
        }

        // 第二优先：字体文件 name 表解析 (中文)
        if (this._fontCNMap && this._fontCNMap[postScriptName]) {
            return {
                primary: this._fontCNMap[postScriptName],
                secondary: familyName || postScriptName,
                source: 'parsed'
            };
        }

        // 第三优先：收藏夹老数据的 alias (向后兼容)
        const oldFav = this.favFonts.find(f => f.postScriptName === postScriptName);
        if (oldFav && oldFav.alias) {
            return {
                primary: '⭐ ' + oldFav.alias,
                secondary: familyName || postScriptName,
                source: 'alias_old'
            };
        }

        // 兜底：原始英文名
        return {
            primary: familyName || postScriptName,
            secondary: postScriptName,
            source: 'fallback'
        };
    }

    loadFavFonts() {
        const path = this.dataDir + "/favorite_fonts.json";
        const readResult = window.cep.fs.readFile(path);
        if (readResult.err === window.cep.fs.NO_ERROR && readResult.data) {
            try {
                this.favFonts = JSON.parse(readResult.data);
            } catch (e) {
                this.favFonts = [];
            }
        }
    }

    saveFavFonts() {
        const path = this.dataDir + "/favorite_fonts.json";
        window.cep.fs.writeFile(path, JSON.stringify(this.favFonts));
    }

    loadRecentFonts() {
        const path = this.dataDir + "/recent_fonts.json";
        const readResult = window.cep.fs.readFile(path);
        if (readResult.err === window.cep.fs.NO_ERROR && readResult.data) {
            try { this.recentFonts = JSON.parse(readResult.data); }
            catch (e) { this.recentFonts = []; }
        }
    }

    saveRecentFont(font) {
        // 先剔除旧的相同字体，再插到开头，保持最多 10 个
        this.recentFonts = this.recentFonts.filter(f => f.postScriptName !== font.postScriptName);
        this.recentFonts.unshift(font);
        if (this.recentFonts.length > 10) this.recentFonts.pop();

        const path = this.dataDir + "/recent_fonts.json";
        window.cep.fs.writeFile(path, JSON.stringify(this.recentFonts));
    }

    openFavModal(fontObj) {
        this.mName.innerText = fontObj.name;
        this.mPost.innerText = fontObj.postScriptName;

        const existing = this.favFonts.find(f => f.postScriptName === fontObj.postScriptName);
        if (existing) {
            this.mAlias.value = existing.alias || fontObj.name;
            this.mCategory.value = existing.category || '未分类';
            this.btnRemoveFav.style.display = 'block';
        } else {
            // 提供智能名称建议
            this.mAlias.value = fontObj.name;
            this.mCategory.value = '对话';
            this.btnRemoveFav.style.display = 'none';
        }

        this.modal.style.display = 'flex';
    }

    renderFavCategories() {
        if (!this.favFilterContainer) return;

        const cats = new Set(this.favFonts.map(f => f.category));
        this.favFilterContainer.innerHTML = '';

        const allBtn = document.createElement('button');
        allBtn.className = `tool-btn ${this.favFilter === 'all' ? 'active' : ''}`;
        allBtn.style.padding = "4px 8px";
        allBtn.style.fontSize = "12px";
        allBtn.setAttribute('data-filter', 'all');
        allBtn.innerText = '全都显示';
        this.favFilterContainer.appendChild(allBtn);

        cats.forEach(c => {
            if (!c) return;
            const btn = document.createElement('button');
            btn.className = `tool-btn ${this.favFilter === c ? 'active' : ''}`;
            btn.style.padding = "4px 8px";
            btn.style.fontSize = "12px";
            btn.setAttribute('data-filter', c);
            btn.innerText = c;
            this.favFilterContainer.appendChild(btn);
        });
    }

    // ------------ 系统字体库缓存管理 ------------

    loadFonts(forceRefresh = false) {
        if (!this.listContainer) return;

        if (forceRefresh) {
            // 顺带强制刷新 node.js 解析别名词典
            this.initFontDisplayNames(true);
        }

        const cachePath = this.dataDir + "/font_cache.json";

        const readCacheAndRender = () => {
            const readResult = window.cep.fs.readFile(cachePath);
            if (readResult.err === window.cep.fs.NO_ERROR && readResult.data) {
                try {
                    this.allFonts = JSON.parse(readResult.data);
                    if (this.currentMode === 'system') this.renderFonts();
                    this.syncToTypesetPanel();
                    if (window.styleManager) window.styleManager.syncFonts(this.allFonts);
                    return true;
                } catch (e) {
                    console.error("字体缓存解析失败", e);
                }
            }
            return false;
        };

        if (!forceRefresh) {
            if (readCacheAndRender()) return;
        }

        this.listContainer.innerHTML = '<div class="placeholder text-accent">首次刷新正在全盘解析字体...这可能需要10~20秒，请勿操作PS防卡死！</div>';
        const safePath = cachePath.replace(/\\/g, '\\\\');
        this.cs.evalScript(`generateFontCacheFile("${safePath}")`, (res) => {
            if (res === "SUCCESS") {
                if (!readCacheAndRender()) this.listContainer.innerHTML = '<div class="placeholder">读取缓存包权限失败。</div>';
            } else {
                this.listContainer.innerHTML = `<div class="placeholder text-red">生成缓存崩溃: ${res}</div>`;
            }
        });
    }

    syncToTypesetPanel() {
        const typesetDropdown = document.getElementById('sel-font-family');
        if (!typesetDropdown || this.allFonts.length === 0) return;

        typesetDropdown.innerHTML = '<option value="">(默认匹配 PS 当前预设)</option>';
        this.allFonts.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.postScriptName;
            opt.innerText = f.name;
            typesetDropdown.appendChild(opt);
        });
    }

    // ------------ 统一 UI 渲染 ------------

    renderFonts() {
        if (!this.listContainer) return;
        this.listContainer.innerHTML = '';

        const q = this.inputSearch ? this.inputSearch.value.toLowerCase().trim() : "";
        let count = 0;

        const cjkRegex = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/;

        // 如果是系统全部字体且无搜索状态，先渲染最近使用
        if (this.currentMode === 'system' && this.sysFilter === 'all' && !q && this.recentFonts.length > 0) {
            const recentTitle = document.createElement('div');
            recentTitle.className = 'placeholder text-accent';
            recentTitle.style.textAlign = 'left';
            recentTitle.style.padding = '4px 8px';
            recentTitle.innerHTML = '🕒 最近使用';
            this.listContainer.appendChild(recentTitle);

            for (let i = 0; i < this.recentFonts.length; i++) {
                this.listContainer.appendChild(this.createFontItemNode(this.recentFonts[i]));
            }

            const divLine = document.createElement('div');
            divLine.style.height = '1px';
            divLine.style.background = 'var(--bg-lighter)';
            divLine.style.margin = '8px 0';
            this.listContainer.appendChild(divLine);
        }

        // 判定展示的数据源
        let sourceList = this.currentMode === 'favorite' ? this.favFonts : this.allFonts;

        for (let i = 0; i < sourceList.length; i++) {
            const font = sourceList[i];
            const display = this.getFontDisplayName(font.postScriptName, font.name || font.family);

            // 过滤逻辑
            if (this.currentMode === 'system') {
                if (font.name && font.name.indexOf("Adobe") === 0 && font.name.length > 20) continue;

                // 搜索时匹配：中文名(经过解析/别名)、英文族名、PS唯一名
                if (q) {
                    const cnName = (display.primary || "").toLowerCase();
                    const enName = (display.secondary || "").toLowerCase();
                    const psName = (font.postScriptName || "").toLowerCase();
                    const originalName = (font.name || "").toLowerCase();
                    if (cnName.indexOf(q) === -1 && enName.indexOf(q) === -1 && psName.indexOf(q) === -1 && originalName.indexOf(q) === -1) {
                        continue;
                    }
                }
                const isCjk = cjkRegex.test(display.primary) || display.primary.indexOf("GB") > -1 || display.primary.indexOf("SC") > -1 || display.primary.indexOf("TC") > -1 || display.primary.indexOf("黑") > -1 || display.primary.indexOf("宋") > -1 || display.primary.indexOf("圆") > -1 || display.primary.indexOf("明") > -1;

                if (this.sysFilter === 'chinese' && !isCjk) continue;
                if (this.sysFilter === 'english' && isCjk) continue;
            } else {
                if (this.favFilter !== 'all' && font.category !== this.favFilter) continue;
            }

            count++;
            this.listContainer.appendChild(this.createFontItemNode(font));
        }

        if (this.labCount) this.labCount.innerText = `共 ${count} 款`;

        if (count === 0 && this.recentFonts.length === 0) {
            this.listContainer.innerHTML = '<div class="placeholder">没有任何相关联的字体记录</div>';
        }
    }

    createFontItemNode(font) {
        const display = this.getFontDisplayName(font.postScriptName, font.name || font.family);
        const previewText = '永远の夢を追いかけて 汉化组';

        const isFav = this.favFonts.findIndex(f => f.postScriptName === font.postScriptName) > -1;
        const isCmp = this.compareFonts.findIndex(f => f.postScriptName === font.postScriptName) > -1;

        const item = document.createElement('div');
        item.className = 'font-item';
        item.dataset.postScript = font.postScriptName;

        item.innerHTML = `
            <div class="font-item__main">
                <span class="font-item__cn">${display.primary}</span>
                <span class="font-item__en">${display.secondary}</span>
            </div>
            <div class="font-item__preview" style="font-family:'${font.postScriptName}', '${font.name || font.family}';">
                ${previewText}
            </div>
            <div class="font-item__actions">
                ${isFav ? `<button class="btn-icon btn-fav text-accent" title="编辑收藏">★</button>` : `<button class="btn-icon btn-fav" title="添加收藏 / 设别名">⭐</button>`}
                ${isCmp ? `<button class="btn-icon btn-cmp text-accent" title="移除对比" style="background:var(--accent-dim); border-color:var(--accent);">已加入</button>` : `<button class="btn-icon btn-cmp" title="加入对比">⚔️</button>`}
            </div>
        `;

        // 点击应用字体
        item.addEventListener('click', (e) => {
            if (e.target.closest('.btn-icon')) return;

            const oldBg = item.style.background;
            item.style.background = 'var(--accent-dim)';
            setTimeout(() => item.style.background = oldBg, 200);

            this.applyFontToActiveLayer(font);
        });

        // 收藏按钮
        const btnFav = item.querySelector('.btn-fav');
        btnFav.addEventListener('click', (e) => {
            e.stopPropagation();
            // font.name 是原来给弹窗兜底用的主显示词
            this.openFavModal({ postScriptName: font.postScriptName, name: display.primary });
        });

        // 对比按钮
        const btnCmp = item.querySelector('.btn-cmp');
        btnCmp.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleCompare(font);
        });

        // 如果是收藏夹模式，开启拖拽支持
        if (this.currentMode === 'favorite') {
            item.setAttribute('draggable', 'true');
            item.addEventListener('dragstart', (e) => this.handleDragStart(e, font, item));
            item.addEventListener('dragover', (e) => this.handleDragOver(e, item));
            item.addEventListener('dragenter', (e) => this.handleDragEnter(e, item));
            item.addEventListener('dragleave', (e) => this.handleDragLeave(e, item));
            item.addEventListener('drop', (e) => this.handleDrop(e, font, item));
            item.addEventListener('dragend', (e) => this.handleDragEnd(e, item));
        }

        return item;
    }

    // --- HTML5 Drag and Drop Sorting ---
    handleDragStart(e, font, item) {
        this.draggedFont = font;
        e.dataTransfer.effectAllowed = 'move';
        item.style.opacity = '0.4';
    }

    handleDragOver(e, item) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    handleDragEnter(e, item) {
        if (this.draggedFont && this.draggedFont.postScriptName !== item.dataset.postScript) {
            item.style.borderTop = '2px solid var(--accent)';
        }
    }

    handleDragLeave(e, item) {
        item.style.borderTop = '';
    }

    handleDrop(e, targetFont, item) {
        e.stopPropagation();
        item.style.borderTop = '';
        if (this.draggedFont && this.draggedFont.postScriptName !== targetFont.postScriptName) {
            const fromIdx = this.favFonts.findIndex(f => f.postScriptName === this.draggedFont.postScriptName);
            const toIdx = this.favFonts.findIndex(f => f.postScriptName === targetFont.postScriptName);

            if (fromIdx > -1 && toIdx > -1) {
                const [moved] = this.favFonts.splice(fromIdx, 1);
                this.favFonts.splice(toIdx, 0, moved);
                this.saveFavFonts();
                this.renderFonts();
            }
        }
        return false;
    }

    handleDragEnd(e, item) {
        item.style.opacity = '1';
        this.draggedFont = null;
    }

    applyFontToActiveLayer(font) {
        const scope = this.selApplyScope ? this.selApplyScope.value : 'active';

        // 大范围操作给一个确认，避免误触
        if (scope === 'all') {
            const ok = confirm("将对【当前文档全部文本图层】批量套用该字体。确定继续吗？");
            if (!ok) return;
        }

        let fnName = 'applyFontToLayer';
        if (scope === 'selected') fnName = 'applyFontToSelectedTextLayers';
        if (scope === 'all') fnName = 'applyFontToAllTextLayers';

        const safePsName = String(font.postScriptName || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        this.cs.evalScript(`${fnName}('${safePsName}')`, (res) => {
            if (res && res.indexOf("错误") > -1) {
                alert(res);
                return;
            }

            // 解析批量结果（若有）
            if (res && res.indexOf('SUCCESS|||') === 0) {
                try {
                    const jsonStr = res.replace('SUCCESS|||', '');
                    const info = JSON.parse(jsonStr);
                    // 仅批量操作弹出摘要提示；单图层不打扰
                    if (scope !== 'active') {
                        alert(`✅ 字体批量应用完成\n总目标: ${info.total}\n已应用: ${info.applied}\n已跳过: ${info.skipped}`);
                    }
                } catch (e) { }
            }

            // 成功即记录最近使用
            this.saveRecentFont(font);

            // 仅当目前处于无搜索系统区时局部重刷挂载最近项
            if (this.currentMode === 'system' && this.sysFilter === 'all' && (!this.inputSearch || !this.inputSearch.value.trim())) {
                this.renderFonts();
            }
        });
    }

    toggleCompare(font) {
        const idx = this.compareFonts.findIndex(f => f.postScriptName === font.postScriptName);
        if (idx > -1) {
            this.compareFonts.splice(idx, 1);
        } else {
            if (this.compareFonts.length >= 6) {
                alert("比武台名额有限，最多只能同时上台对比 6 款字体！");
                return;
            }
            this.compareFonts.push(font);
        }
        this.updateCompareBar();
        this.renderFonts(); // 刷新按钮高亮态
    }

    updateCompareBar() {
        if (!this.cmpFloatBar) return;
        if (this.compareFonts.length > 0) {
            this.cmpFloatBar.style.display = 'flex';
            this.cmpCount.innerText = this.compareFonts.length;
        } else {
            this.cmpFloatBar.style.display = 'none';
        }
    }

    openCompareModal() {
        if (this.compareFonts.length === 0) return;
        this.modalCmp.style.display = 'flex';
        this.renderCompareList();
    }

    renderCompareList() {
        if (!this.cmpList) return;
        this.cmpList.innerHTML = '';
        const previewText = this.cmpText.value || "没有输入对比文字…";

        this.compareFonts.forEach(font => {
            const fontAliasOrName = font.alias || font.name;
            const item = document.createElement('div');
            item.className = 'card mb-2';
            item.style.padding = '12px';
            item.style.background = 'var(--surface)';
            item.style.border = '1px solid var(--border-color)';
            item.style.borderRadius = '6px';

            item.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div>
                        <div style="font-size:13px; font-weight:600; color:var(--text-bright);">${fontAliasOrName}</div>
                        <div style="font-size:10px; color:var(--text-faint);">${font.postScriptName}</div>
                    </div>
                    <button class="btn btn--primary btn--xs btn-cmp-apply" data-psname="${font.postScriptName}" style="padding:2px 10px;">应用到图层</button>
                </div>
                <div style="font-family: '${font.postScriptName}', '${font.name}', sans-serif; font-size: 24px; line-height: 1.4; color: var(--text-bright); white-space: pre-wrap; word-break: break-all; min-height:40px; border-top:1px dashed var(--border-color); padding-top: 8px;">
                    ${previewText.replace(/\n/g, '<br>')}
                </div>
            `;

            const btnApply = item.querySelector('.btn-cmp-apply');
            btnApply.addEventListener('click', () => {
                this.applyFontToActiveLayer(font);
            });

            this.cmpList.appendChild(item);
        });
    }

    // ------------ 收藏 JSON 导出 / 导入 ------------

    exportFavJson() {
        if (this.favFonts.length === 0) {
            alert('收藏夹为空，没有可导出的数据。');
            return;
        }
        // 使用 CEP 文件保存对话框
        const result = window.cep.fs.showSaveDialogWithFilter(
            false,
            '保存收藏字体备份',
            'favorite_fonts.json',
            ['json'],
            'JSON 数据文件'
        );
        if (!result || result.err !== window.cep.fs.NO_ERROR || !result.data) return;

        const savePath = result.data;
        const writeResult = window.cep.fs.writeFile(savePath, JSON.stringify(this.favFonts, null, 2));
        if (writeResult.err === window.cep.fs.NO_ERROR) {
            alert(`✅ 收藏已导出到：\n${savePath}`);
        } else {
            alert(`❌ 导出失败，错误码：${writeResult.err}`);
        }
    }

    importFavJson() {
        const result = window.cep.fs.showOpenDialog(
            false, false,
            '选择收藏字体备份文件 (.json)',
            '',
            ['json']
        );
        if (!result || result.err !== window.cep.fs.NO_ERROR || result.data.length === 0) return;

        const filePath = result.data[0];
        const readResult = window.cep.fs.readFile(filePath);
        if (readResult.err !== window.cep.fs.NO_ERROR || !readResult.data) {
            alert('❌ 读取文件失败，请确认文件完整且可读。');
            return;
        }

        let imported;
        try {
            imported = JSON.parse(readResult.data);
        } catch (e) {
            alert('❌ JSON 格式错误，无法解析该文件。');
            return;
        }

        if (!Array.isArray(imported)) {
            alert('❌ 文件格式不符，期望一个 JSON 数组。');
            return;
        }

        // 合并模式：以 postScriptName 为主键，导入项会覆盖已有同名项
        let addedCount = 0;
        let updatedCount = 0;
        imported.forEach(item => {
            if (!item.postScriptName) return;
            const idx = this.favFonts.findIndex(f => f.postScriptName === item.postScriptName);
            if (idx > -1) {
                this.favFonts[idx] = item;
                updatedCount++;
            } else {
                this.favFonts.push(item);
                addedCount++;
            }
        });

        this.saveFavFonts();
        this.renderFavCategories();
        this.renderFonts();
        alert(`✅ 导入完成：新增 ${addedCount} 款，更新 ${updatedCount} 款。`);
    }

    // ── 在线字体精选数据库（内嵌，不需要 API）──
    getOnlineFontDB() {
        return [
            { name: '得意黑', psHint: 'Smiley-Sans', style: '现代活泼黑体，斜切风格，个性鲜明', url: 'https://github.com/atelier-anchor/smiley-sans', tags: ['黑体', '漫画', '标题'] },
            { name: '霞鹜文楷', psHint: 'LXGWWenKai', style: '开源楷体，温润书写感，内心独白/旁白首选', url: 'https://github.com/lxgw/LxgwWenKai', tags: ['楷体', '手写', '旁白'] },
            { name: '霞鹜新致宋', psHint: 'LXGWNeoZhiSong', style: '开源宋体，典雅正文体验', url: 'https://github.com/lxgw/LxgwNeoZhiSong', tags: ['宋体', '正文'] },
            { name: '阿里巴巴普惠体', psHint: 'AlibabaPuHuiTi', style: '多字重免费黑体，正文展示均适合', url: 'https://fonts.alibabagroup.com/', tags: ['黑体', '正文', '标题'] },
            { name: '优设标题黑', psHint: 'YouSheBiaoTiHei', style: '超粗展示黑体，大吼/震撼场景利器', url: 'https://www.uisdc.com/', tags: ['黑体', '标题', '漫画'] },
            { name: '庞门正道标题体', psHint: 'PangMenZhengDao', style: '设计感标题体，英雄气概十足', url: 'https://www.fonts.net.cn/', tags: ['标题', '漫画'] },
            { name: '站酷快乐体', psHint: 'ZCOOL-KuaiLe', style: '圆润欢快，适合轻松对话/可爱场景', url: 'https://www.zcool.com.cn/', tags: ['圆体', '漫画', '可爱'] },
            { name: '站酷高端黑体', psHint: 'ZCOOL-GDH', style: '现代高端黑体，科幻/都市漫画', url: 'https://www.zcool.com.cn/', tags: ['黑体', '标题'] },
            { name: 'MiSans', psHint: 'MiSans-Regular', style: '小米无衬线体，干净现代，多字重', url: 'https://hyperos.mi.com/font/', tags: ['黑体', '正文'] },
            { name: '思源黑体', psHint: 'SourceHanSansCN', style: 'Google/Adobe 联合出品，全字重完备', url: 'https://github.com/adobe-fonts/source-han-sans', tags: ['黑体', '正文', '标题'] },
            { name: '思源宋体', psHint: 'SourceHanSerifSC', style: 'Google/Adobe 宋体，文学旁白首选', url: 'https://github.com/adobe-fonts/source-han-serif', tags: ['宋体', '正文', '旁白'] },
            { name: '江西拙楷', psHint: 'jiangxizhuokai', style: '手拙感楷书，日记/手账风格', url: 'https://github.com/GuiWonder/JxZhuoKai', tags: ['楷体', '手写', '旁白'] },
            { name: '字魂肥宅快乐体', psHint: 'zihun39hao-feizhaikuaileti', style: '圆润可爱，轻松搞笑场景', url: 'https://izihun.com/', tags: ['圆体', '可爱', '漫画'] },
            { name: 'Noto Sans SC', psHint: 'NotoSansSC-Regular', style: 'Google 开源无衬线，全面兼容 Unicode', url: 'https://fonts.google.com/noto', tags: ['黑体', '正文'] },
        ];
    }

    renderOnlineFontList(filterTag) {
        const container = document.getElementById('online-font-list');
        if (!container) return;
        container.innerHTML = '';
        const db = this.getOnlineFontDB();
        const tag = filterTag || 'all';
        const filtered = tag === 'all' ? db : db.filter(f => f.tags.includes(tag));

        filtered.forEach(font => {
            const isInstalled = this.allFonts.some(f =>
                (f.postScriptName || '').startsWith(font.psHint.split('-')[0]) ||
                (f.name || '').includes(font.name.substring(0, 3))
            );
            const card = document.createElement('div');
            card.style.cssText = 'background:var(--surface);border:1px solid var(--border-color);border-radius:6px;padding:10px 12px;margin-bottom:8px;';
            const safeUrl = font.url.replace(/'/g, "\\'");
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
                    <div>
                        <span style="font-size:13px;font-weight:600;color:var(--text-bright);">${font.name}</span>
                        ${isInstalled ? '<span style="font-size:10px;color:var(--accent);margin-left:6px;">✓ 已安装</span>' : ''}
                    </div>
                    <button class="btn btn--ghost btn--xs" style="padding:2px 8px;font-size:11px;" data-url="${font.url}">下载↗</button>
                </div>
                <div style="font-size:11px;color:var(--text-faint);margin-bottom:6px;">${font.style}</div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;">${font.tags.map(t => `<span style="font-size:10px;background:var(--bg-lighter);color:var(--text-dim);padding:1px 6px;border-radius:10px;">${t}</span>`).join('')}</div>
            `;
            card.querySelector('button').addEventListener('click', () => window.cep.util.openURLInDefaultBrowser(font.url));
            container.appendChild(card);
        });
    }

    // ── 升级版 AI 推荐：多模型 + 结构化 JSON 卡片展示 ──
    async callAiFontRecommendation(query) {
        const cfg = PresetsManager.getApiConfig();
        if (!cfg.apiKey) {
            alert('请前往「设置」页面填入大模型 API Key（支持 Gemini 或 DeepSeek 等 OpenAI 兼容接口），然后再使用 AI 推荐功能。');
            return;
        }

        if (this.btnAiRecommend) { this.btnAiRecommend.textContent = '分析中…'; this.btnAiRecommend.disabled = true; }
        const resultArea = document.getElementById('ai-result-area');
        const resultCards = document.getElementById('ai-result-cards');
        if (resultArea) resultArea.style.display = 'none';
        if (resultCards) resultCards.innerHTML = '<div class="placeholder text-accent">🤖 AI 正在分析情景，匹配最合适的字体风格…</div>';
        if (resultArea) resultArea.style.display = 'block';

        const systemPrompt = `你是专业的漫画排版与字体美学专家。用户描述漫画场景，你推荐最合适的中文字体。

严格以 JSON 格式回复，不要输出其他任何内容，格式：
{
  "analysis": "对场景的简短分析（20字以内）",
  "recommendations": [
    { "name": "字体名称", "reason": "推荐理由（15字以内）", "keyword": "搜索关键词" }
  ]
}

推荐 2-3 个字体，优先推荐免费商用字体：得意黑、霞鹜文楷、思源黑体、思源宋体、站酷快乐体、庞门正道标题体、优设标题黑、阿里巴巴普惠体、MiSans 等。`;

        try {
            let responseText = '';
            if (cfg.modelType === 'openai') {
                const baseUrl = (cfg.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
                const modelName = cfg.modelName || 'gpt-4o-mini';
                const res = await fetch(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
                    body: JSON.stringify({
                        model: modelName,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: `场景描述：${query}` }
                        ],
                        temperature: 0.7
                    })
                });
                if (!res.ok) throw new Error(await res.text());
                const data = await res.json();
                responseText = data.choices[0].message.content;
            } else {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${cfg.apiKey}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: `${systemPrompt}\n\n场景描述：${query}` }] }],
                        generationConfig: { temperature: 0.7, responseMimeType: 'application/json' }
                    })
                });
                if (!res.ok) throw new Error(await res.text());
                const data = await res.json();
                responseText = data.candidates[0].content.parts[0].text.trim();
            }

            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                const match = responseText.match(/\{[\s\S]*\}/);
                if (match) result = JSON.parse(match[0]);
                else throw new Error('AI 返回格式错误：' + responseText.substring(0, 80));
            }
            this._renderAiResultCards(result, resultCards);

        } catch (e) {
            if (resultCards) resultCards.innerHTML = `<div style="color:var(--text-red,#f66);font-size:12px;padding:8px;">❌ AI 连接失败：${e.message.substring(0, 120)}<br><small>请在设置页检查 API Key 和网络。</small></div>`;
        } finally {
            if (this.btnAiRecommend) { this.btnAiRecommend.textContent = '🤖 AI 分析推荐'; this.btnAiRecommend.disabled = false; }
        }
    }

    _renderAiResultCards(result, container) {
        if (!container) return;
        container.innerHTML = '';
        if (result.analysis) {
            const tip = document.createElement('div');
            tip.style.cssText = 'font-size:12px;color:var(--text-faint);margin-bottom:10px;padding:6px 10px;background:var(--bg-lighter);border-radius:4px;';
            tip.textContent = '💡 ' + result.analysis;
            container.appendChild(tip);
        }
        const recs = result.recommendations || [];
        if (recs.length === 0) {
            container.innerHTML = '<div class="placeholder">AI 未返回推荐，请换一种描述方式重试。</div>';
            return;
        }
        recs.forEach((rec, idx) => {
            const keyword = rec.keyword || rec.name;
            const isInstalled = this.allFonts.some(f =>
                (f.name || '').includes(rec.name.substring(0, 3)) ||
                (f.postScriptName || '').toLowerCase().includes(keyword.toLowerCase().replace(/\s/g, '').substring(0, 5))
            );
            const card = document.createElement('div');
            card.style.cssText = 'background:var(--surface);border:1px solid var(--border-color);border-radius:6px;padding:10px 12px;margin-bottom:8px;';
            const zfontUrl = `https://zfont.cn/search?q=${encodeURIComponent(keyword)}`;
            const zeoUrl = `https://fonts.zeoseven.com/browse/?keyword=${encodeURIComponent(keyword)}`;
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <div style="font-size:13px;font-weight:600;color:var(--text-bright);">
                        ${idx + 1}. ${rec.name}
                        ${isInstalled ? '<span style="font-size:10px;color:var(--accent);margin-left:6px;">✓ 已安装</span>' : ''}
                    </div>
                </div>
                <div style="font-size:11px;color:var(--text-faint);margin-bottom:8px;">${rec.reason || ''}</div>
                <div style="display:flex;gap:6px;">
                    <button class="btn btn--ghost btn--xs btn-jump-zf" style="font-size:11px;">字由搜索↗</button>
                    <button class="btn btn--ghost btn--xs btn-jump-zeo" style="font-size:11px;">ZeoSeven↗</button>
                </div>
            `;
            card.querySelector('.btn-jump-zf').addEventListener('click', () => window.cep.util.openURLInDefaultBrowser(zfontUrl));
            card.querySelector('.btn-jump-zeo').addEventListener('click', () => window.cep.util.openURLInDefaultBrowser(zeoUrl));
            container.appendChild(card);
        });
    }
}
