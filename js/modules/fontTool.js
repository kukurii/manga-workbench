// fontTool.js - 字体库管理与快捷应用

class FontManager {
    constructor(csInterface, extPath) {
        this.cs = csInterface;
        this.extPath = extPath;
        this.allFonts = [];
        this.favFonts = []; // { postScriptName, name, alias, category }

        this.onlineFonts = []; // Array of { name, author, style, url, previewUrl, source }
        this.onlineSource = 'zeoseven'; // 'zeoseven' or 'google'

        this.currentMode = 'system'; // 'system' or 'favorite' or 'online'
        this.sysFilter = 'all'; // all, chinese, english
        this.favFilter = 'all'; // all, 或者用户自定义的类别

        this.initDOM();
        this.bindEvents();

        this.loadFavFonts();
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
                const queryWord = this.inputOnlineSearch && this.inputOnlineSearch.value ? encodeURIComponent(this.inputOnlineSearch.value) : '';
                const url = queryWord ? `https://zfont.cn/search?q=${queryWord}` : 'https://zfont.cn/';
                window.cep.util.openURLInDefaultBrowser(url);
            });
        }

        if (this.btnJumpZeoSeven) {
            this.btnJumpZeoSeven.addEventListener('click', () => {
                const queryWord = this.inputOnlineSearch && this.inputOnlineSearch.value ? encodeURIComponent(this.inputOnlineSearch.value) : '';
                const url = queryWord ? `https://fonts.zeoseven.com/browse/?keyword=${queryWord}` : 'https://fonts.zeoseven.com/';
                window.cep.util.openURLInDefaultBrowser(url);
            });
        }

        if (this.btnAiRecommend) {
            this.btnAiRecommend.addEventListener('click', () => {
                const query = this.inputOnlineSearch ? this.inputOnlineSearch.value.trim() : "";
                if (!query) return alert("请在左侧输入框描述当前漫画对白的情景或角色情绪，例如：愤怒男主的大吼、内心独白、轻描淡写的话等。");
                this.callAiFontRecommendation(query);
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

                // 查找是否已存在
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
                this.modal.style.display = 'none';
                if (this.currentMode === 'favorite') this.renderFavCategories();
                this.renderFonts();
            });
        }
    }

    // ------------ 持久性收藏夹管理 ------------

    loadFavFonts() {
        const path = this.extPath + "/data/favorite_fonts.json";
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
        const path = this.extPath + "/data/favorite_fonts.json";
        window.cep.fs.writeFile(path, JSON.stringify(this.favFonts));
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

        const cachePath = this.extPath + "/data/font_cache.json";

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

        this.listContainer.innerHTML = '<div class="placeholder text-accent">您装了好多字库...PS正在艰难转储缓存...千万不要乱点鼠标防卡死！</div>';
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

        // 判定展示的数据源
        let sourceList = this.currentMode === 'favorite' ? this.favFonts : this.allFonts;

        for (let i = 0; i < sourceList.length; i++) {
            const font = sourceList[i];
            const fontAliasOrName = font.alias || font.name;

            // 过滤逻辑
            if (this.currentMode === 'system') {
                if (font.name.indexOf("Adobe") === 0 && font.name.length > 20) continue;
                if (q && font.name.toLowerCase().indexOf(q) === -1 && font.postScriptName.toLowerCase().indexOf(q) === -1) {
                    continue;
                }
                const isCjk = cjkRegex.test(font.name) || font.name.indexOf("GB") > -1 || font.name.indexOf("SC") > -1 || font.name.indexOf("TC") > -1 || font.name.indexOf("黑") > -1 || font.name.indexOf("宋") > -1 || font.name.indexOf("圆") > -1 || font.name.indexOf("明") > -1;

                if (this.sysFilter === 'chinese' && !isCjk) continue;
                if (this.sysFilter === 'english' && isCjk) continue;
            } else {
                if (this.favFilter !== 'all' && font.category !== this.favFilter) continue;
            }

            count++;

            // 是否已经被收藏
            const isFav = this.favFonts.findIndex(f => f.postScriptName === font.postScriptName) > -1;

            // 构建DOM
            const item = document.createElement('div');
            item.className = 'dialog-row';
            item.style.cursor = 'pointer';

            const actionIcon = isFav ? "★" : "＋";
            const actionClass = isFav ? "text-accent" : "text-faint";

            item.innerHTML = `
                <div class="flex-1" title="PostScript: ${font.postScriptName}\n点击即可应用于图层">
                    <div style="font-size:12px; font-weight:600; color:var(--text-bright); margin-bottom:2px;">${fontAliasOrName}</div>
                    <div style="font-size:10px; color:var(--text-faint);">${this.currentMode === 'favorite' ? (font.category || '未分类') : font.postScriptName}</div>
                </div>
                <div class="fav-action-btn ${actionClass}" style="padding:4px 8px; font-size:14px; margin-left:8px;" title="编辑中文别名和分类收藏">
                    ${actionIcon}
                </div>
            `;

            // 一键点击背景直接应用
            item.addEventListener('click', (e) => {
                if (e.target.closest('.fav-action-btn')) return;

                const oldBg = item.style.background;
                item.style.background = 'var(--accent-dim)';
                setTimeout(() => item.style.background = oldBg, 200);

                this.applyFontToActiveLayer(font.postScriptName);
            });

            // 点击收藏图标进行绑定
            const btnFav = item.querySelector('.fav-action-btn');
            btnFav.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openFavModal(font);
            });

            this.listContainer.appendChild(item);
        }

        if (this.labCount) this.labCount.innerText = `共 ${count} 款`;

        if (count === 0) {
            this.listContainer.innerHTML = '<div class="placeholder">没有任何相关联的字体记录</div>';
        }
    }

    applyFontToActiveLayer(postScriptName) {
        this.cs.evalScript(`applyFontToLayer('${postScriptName}')`, (res) => {
            if (res && res.indexOf("错误") > -1) {
                alert(res);
            }
        });
    }

    // ------------ 在线API与AI推荐功能（浏览器直达精简版） ------------

    async callAiFontRecommendation(query) {
        let apiKey = localStorage.getItem('manga_workbench_api_key');
        if (!apiKey) {
            alert("请前往右侧齿轮（⚙️全局预设）选项卡中填入您的大语言模型 API Key，否则 AI 无法启动！");
            return;
        }

        this.inputOnlineSearch.value = '🤖 AI 极速思考推演中...';
        this.inputOnlineSearch.disabled = true;

        let oldBtnText = "AI 参谋";
        if (this.btnAiRecommend) {
            oldBtnText = this.btnAiRecommend.innerText;
            this.btnAiRecommend.innerText = "分析中...";
            this.btnAiRecommend.disabled = true;
        }

        try {
            // 封装调用 Gemini 接口的真实 Fetch 逻辑
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const prompt = `你是一个专业的漫画排版与字体美学专家。用户此时需要给一段情景为：“${query}”的文字配上字体。
请你从现有的免费开源中英文字库（例如：得意黑、庞门正道、思源黑体、霞鹜文楷、站酷快乐体、优设标题黑等知名免费商业可用库内），推断出 **1个或最长不超过2个** 最能代表此种情绪的字体统称或家族名字。
你的回复必须**极为简短**。只回复字体名字或者可以用于检索框的关键词，绝不能出现其他标点符号和闲聊。比如：站酷酷黑 或 霞鹜文楷。`;

            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7 }
                })
            });

            if (!res.ok) {
                const errtxt = await res.text();
                throw new Error(errtxt);
            }

            const data = await res.json();
            const textResponse = data.candidates[0].content.parts[0].text.trim();

            this.inputOnlineSearch.disabled = false;

            // 将分析出的词汇回填给输入框，并触发查询
            this.inputOnlineSearch.value = textResponse;

            if (this.btnAiRecommend) {
                this.btnAiRecommend.innerText = oldBtnText;
                this.btnAiRecommend.disabled = false;
            }

            // 直接用 alert 提示用户可以去点击链接了
            alert(`✨ AI 推荐检索词分析完毕：\n\n【 ${textResponse} 】\n\n您现在可以点击上方的原生浏览器跳转按钮，去官网用该关键词直接寻找对应免费字体。`);

        } catch (e) {
            this.inputOnlineSearch.disabled = false;
            this.inputOnlineSearch.value = query; // 防丢失复原
            if (this.btnAiRecommend) {
                this.btnAiRecommend.innerText = oldBtnText;
                this.btnAiRecommend.disabled = false;
            }
            alert(`🤖 ❌ AI 大脑连接失败:\n${e.message.substring(0, 100)}\n请在全局预设检查 API Key.`);
        }
    }
}
