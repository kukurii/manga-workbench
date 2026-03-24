// fontTool.js - 字体库管理与快捷应用

class FontManager {
    constructor(csInterface, extPath, dataDir) {
        this.cs = csInterface;
        this.extPath = extPath;
        this.dataDir = dataDir;
        this.allFonts = [];
        this.favFonts = []; // { postScriptName, name, alias, category }
        this.recentFonts = []; // 最近使用
        this.compareFonts = []; // 当前加入对比测试的字库合集
        this.draggedFont = null; // 用于拖拽暂存
        this.batchMode = false; // 批量管理模式

        this.hiddenFonts = []; // 保存要隐藏的字体的 postScriptName
        this.showHidden = false; // 当前是否处于显示已隐藏字体的状态

        this.onlineFonts = []; // Array of { name, author, style, url, previewUrl, source }
        this.onlineSource = 'zeoseven'; // 'zeoseven' or 'google'

        this.currentMode = 'system'; // 'system' or 'favorite' or 'online'
        this.sysFilter = 'all'; // all, chinese, english
        this.favFilter = 'all'; // all, 或者用户自定义的分类

        this._fontCNMap = null;
        this._userAliases = null;

        this.initDOM();
        this.injectEnhancements();
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

        this.btnOpenFontManager = document.getElementById('btn-open-font-manager');
        this.modalFontManager = document.getElementById('modal-font-manager');
        this.btnCloseFontManager = document.getElementById('btn-close-font-manager');
        this.inputFmSearch = document.getElementById('input-fm-search');
        this.selFmFilter = document.getElementById('sel-fm-filter');
        this.fmListContainer = document.getElementById('fm-list-container');
        this.fmCountLab = document.getElementById('fm-count-lab');
        this.chkFmSelectAll = document.getElementById('chk-fm-select-all');
        this.btnFmHideSel = document.getElementById('btn-fm-hide-sel');
        this.btnFmShowSel = document.getElementById('btn-fm-show-sel');
        this.favFilterContainer = document.getElementById('fav-category-filters');

        this.inputOnlineSearch = document.getElementById('input-online-search');
        this.btnSearchOnline = document.getElementById('btn-search-online');
        this.btnAiRecommend = document.getElementById('btn-ai-recommend');
        this.onlineSourceTabs = document.getElementById('online-source-tabs');

        this.listTitle = document.getElementById('font-list-title');
        this.listContainer = document.getElementById('font-list-container');
        this.labCount = document.getElementById('font-count-lab');

        // 批量管理模式 DOM
        this.btnBatchMode = document.getElementById('btn-font-batch-mode');
        this.batchBar = document.getElementById('font-batch-bar');
        this.batchInfo = document.getElementById('font-batch-info');
        this.btnBatchSelectAll = document.getElementById('btn-batch-select-all');
        this.btnBatchHideSel = document.getElementById('btn-batch-hide-sel');
        this.btnBatchShowSel = document.getElementById('btn-batch-show-sel');
        this.btnBatchExit = document.getElementById('btn-batch-exit');

        // 外部跳转按钮
        this.btnJumpZfont = document.getElementById('btn-jump-zfont');
        this.btnJumpFontsNet = document.getElementById('btn-jump-fontsnet');
        this.btnJumpIziHun = document.getElementById('btn-jump-izihun');
        this.btnJump100Font = document.getElementById('btn-jump-100font');
        this.btnJumpZeoSeven = document.getElementById('btn-jump-zeoseven');
        this.btnJumpMoonvy = document.getElementById('btn-jump-moonvy');
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

    injectEnhancements() {
        if (this.btnJumpZfont && this.btnJumpZeoSeven) {
            const jumpRow = this.btnJumpZfont.parentElement;
            if (jumpRow && !document.getElementById('btn-jump-fontsnet')) {
                const container = document.createElement('div');
                container.className = 'btn-col mb-1';

                const row1 = document.createElement('div');
                row1.className = 'btn-row';
                const row2 = document.createElement('div');
                row2.className = 'btn-row';

                this.btnJumpZfont.textContent = '前往 zfont.cn';
                this.btnJumpZfont.className = 'btn btn--ghost btn--sm';

                this.btnJumpZeoSeven.textContent = 'ZeoSeven';
                this.btnJumpZeoSeven.className = 'btn btn--ghost btn--sm';

                const makeJumpButton = (id, text) => {
                    const btn = document.createElement('button');
                    btn.id = id;
                    btn.className = 'btn btn--ghost btn--sm';
                    btn.textContent = text;
                    return btn;
                };

                this.btnJumpFontsNet = makeJumpButton('btn-jump-fontsnet', '字体天下');
                this.btnJumpIziHun = makeJumpButton('btn-jump-izihun', '字魂网');
                this.btnJump100Font = makeJumpButton('btn-jump-100font', '100font');
                this.btnJumpMoonvy = makeJumpButton('btn-jump-moonvy', '预览工具');

                row1.appendChild(this.btnJumpZfont);
                row1.appendChild(this.btnJumpFontsNet);
                row1.appendChild(this.btnJumpIziHun);
                row2.appendChild(this.btnJump100Font);
                row2.appendChild(this.btnJumpZeoSeven);
                row2.appendChild(this.btnJumpMoonvy);

                container.appendChild(row1);
                container.appendChild(row2);
                jumpRow.replaceWith(container);
            }
        }

        if (this.fmCountLab && this.fmCountLab.parentElement) {
            const toolbarRow = this.fmCountLab.parentElement;
            toolbarRow.classList.add('fm-toolbar-row');

            const controls = this.fmCountLab.nextElementSibling;
            if (controls) {
                controls.classList.add('fm-toolbar-row__controls');

                const selectLabel = this.chkFmSelectAll ? this.chkFmSelectAll.parentElement : null;
                if (selectLabel) {
                    selectLabel.classList.add('fm-toolbar-row__select');
                }

                const maybeDivider = selectLabel ? selectLabel.nextElementSibling : null;
                if (maybeDivider && maybeDivider.tagName === 'DIV') {
                    maybeDivider.classList.add('fm-toolbar-row__divider');
                }

                let actions = controls.querySelector('.fm-toolbar-row__actions');
                if (!actions) {
                    actions = document.createElement('div');
                    actions.className = 'fm-toolbar-row__actions';
                    controls.appendChild(actions);
                }

                [this.btnFmHideSel, this.btnFmShowSel].forEach((btn) => {
                    if (!btn) return;
                    btn.classList.remove('btn--tint');
                    btn.classList.add('btn--ghost', 'fm-toolbar-row__action');
                    actions.appendChild(btn);
                });
            }
        }

        if (this.fmListContainer && !document.getElementById('fm-quick-toolbar')) {
            const toolbar = document.createElement('div');
            toolbar.id = 'fm-quick-toolbar';
            toolbar.className = 'inline-bar mb-2 font-toolbar';
            toolbar.innerHTML = [
                '<span id="fm-quick-summary" class="form-hint" style="margin-left:0;">等待筛选...</span>',
                '<button id="btn-fm-clear-search" class="btn btn--ghost btn--xs">清空搜索</button>',
                '<button id="btn-fm-clear-selection" class="btn btn--ghost btn--xs">清空选择</button>'
            ].join('');
            this.fmListContainer.insertAdjacentElement('beforebegin', toolbar);
        }

        this.fmQuickSummary = document.getElementById('fm-quick-summary');
        this.btnFmClearSearch = document.getElementById('btn-fm-clear-search');
        this.btnFmClearSelection = document.getElementById('btn-fm-clear-selection');
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
                    if (this.listTitle && this.listTitle.parentElement) this.listTitle.parentElement.style.display = 'flex';
                    if (this.fontInstallTip) this.fontInstallTip.style.display = 'block';

                    if (this.listContainer) this.listContainer.style.display = 'block';
                    if (this.listTitle) this.listTitle.innerText = "我的自建字库";
                    this.renderFavCategories();
                    this.renderFonts();
                } else if (this.currentMode === 'online') {
                    if (this.sysTools) this.sysTools.style.display = 'none';
                    if (this.favTools) this.favTools.style.display = 'none';
                    if (this.onlineTools) this.onlineTools.style.display = 'block';
                    if (this.listTitle && this.listTitle.parentElement) this.listTitle.parentElement.style.display = 'none';
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

        // ── 批量管理模式事件 ──
        if (this.btnBatchMode) {
            this.btnBatchMode.addEventListener('click', () => {
                this.batchMode = !this.batchMode;
                this.btnBatchMode.textContent = this.batchMode ? '退出批量' : '批量管理';
                if (this.batchMode) {
                    this.btnBatchMode.classList.add('active');
                    this.btnBatchMode.style.background = 'var(--accent-dim)';
                    this.btnBatchMode.style.color = 'var(--accent)';
                    this.btnBatchMode.style.borderColor = 'var(--accent)';
                } else {
                    this.btnBatchMode.classList.remove('active');
                    this.btnBatchMode.style.background = '';
                    this.btnBatchMode.style.color = '';
                    this.btnBatchMode.style.borderColor = '';
                }
                if (this.listContainer) {
                    this.listContainer.classList.toggle('font-list--batch', this.batchMode);
                }
                if (this.batchBar) {
                    this.batchBar.classList.toggle('is-visible', this.batchMode);
                }
                this._updateBatchInfo();
            });
        }
        if (this.btnBatchExit) {
            this.btnBatchExit.addEventListener('click', () => {
                if (this.btnBatchMode) this.btnBatchMode.click();
            });
        }
        if (this.btnBatchSelectAll) {
            this.btnBatchSelectAll.addEventListener('click', () => {
                const checks = this.listContainer ? this.listContainer.querySelectorAll('.font-item__check') : [];
                const allChecked = Array.from(checks).every(c => c.checked);
                checks.forEach(c => c.checked = !allChecked);
                this._updateBatchInfo();
            });
        }
        if (this.btnBatchHideSel) {
            this.btnBatchHideSel.addEventListener('click', () => {
                const selected = this._getSelectedBatchFonts();
                if (selected.length === 0) { showToast('请先勾选需要隐藏的字体'); return; }
                showConfirmModal(`确定要隐藏这 ${selected.length} 款字体吗？`, () => {
                    selected.forEach(ps => {
                        if (!this.hiddenFonts.includes(ps)) this.hiddenFonts.push(ps);
                    });
                    this.saveHiddenFonts();
                    this.renderFonts();
                });
            });
        }
        if (this.btnBatchShowSel) {
            this.btnBatchShowSel.addEventListener('click', () => {
                const selected = this._getSelectedBatchFonts();
                if (selected.length === 0) { showToast('请先勾选需要恢复的字体'); return; }
                showConfirmModal(`确定要恢复这 ${selected.length} 款字体的显示吗？`, () => {
                    selected.forEach(ps => {
                        const idx = this.hiddenFonts.indexOf(ps);
                        if (idx > -1) this.hiddenFonts.splice(idx, 1);
                    });
                    this.saveHiddenFonts();
                    this.renderFonts();
                });
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

        // 高级字体管理面板打开/关闭
        if (this.btnOpenFontManager) {
            this.btnOpenFontManager.addEventListener('click', () => {
                this.modalFontManager.style.display = 'flex';
                this.inputFmSearch.value = '';
                this.selFmFilter.value = 'all';
                if (this.chkFmSelectAll) this.chkFmSelectAll.checked = false;
                this.renderFontManager();
            });
        }
        if (this.btnCloseFontManager) {
            this.btnCloseFontManager.addEventListener('click', () => {
                this.modalFontManager.style.display = 'none';
            });
        }

        // 管理面板内的搜索和筛选
        if (this.inputFmSearch) {
            this.inputFmSearch.addEventListener('input', () => {
                if (this.chkFmSelectAll) this.chkFmSelectAll.checked = false;
                this.renderFontManager();
            });
        }
        if (this.btnFmClearSearch) {
            this.btnFmClearSearch.addEventListener('click', () => {
                if (this.inputFmSearch) this.inputFmSearch.value = '';
                if (this.selFmFilter) this.selFmFilter.value = 'all';
                if (this.chkFmSelectAll) this.chkFmSelectAll.checked = false;
                this.renderFontManager();
                if (this.inputFmSearch) this.inputFmSearch.focus();
            });
        }
        if (this.selFmFilter) {
            this.selFmFilter.addEventListener('change', () => {
                if (this.chkFmSelectAll) this.chkFmSelectAll.checked = false;
                this.renderFontManager();
            });
        }

        if (this.btnFmClearSelection) {
            this.btnFmClearSelection.addEventListener('click', () => {
                const checkboxes = this.fmListContainer ? this.fmListContainer.querySelectorAll('.fm-chk-item') : [];
                checkboxes.forEach(chk => chk.checked = false);
                if (this.chkFmSelectAll) this.chkFmSelectAll.checked = false;
                this.updateFontManagerSummary();
            });
        }

        // 全选复选框
        if (this.chkFmSelectAll) {
            this.chkFmSelectAll.addEventListener('change', (e) => {
                const checkboxes = this.fmListContainer.querySelectorAll('.fm-chk-item');
                checkboxes.forEach(chk => chk.checked = e.target.checked);
                this.updateFontManagerSummary();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
            const tag = document.activeElement ? document.activeElement.tagName : '';
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (this.modalFontManager && this.modalFontManager.style.display === 'flex' && this.inputFmSearch) {
                e.preventDefault();
                this.inputFmSearch.focus();
                return;
            }
            if (this.currentMode !== 'online' && this.inputSearch) {
                e.preventDefault();
                this.inputSearch.focus();
            }
        });

        // 获取当前选中项的辅助函数
        const getSelectedFontNames = () => {
            const checkboxes = this.fmListContainer.querySelectorAll('.fm-chk-item:checked');
            return Array.from(checkboxes).map(chk => chk.value);
        };

        // 批量选中隐藏/恢复
        if (this.btnFmHideSel) {
            this.btnFmHideSel.addEventListener('click', () => {
                const selectedPsNames = getSelectedFontNames();
                if (selectedPsNames.length === 0) {
                    showToast('请先勾选需要隐藏的字体');
                    return;
                }

                showConfirmModal(`确定要隐藏这 ${selectedPsNames.length} 款勾选的字体吗？`, () => {
                    selectedPsNames.forEach(psName => {
                        if (!this.hiddenFonts.includes(psName)) {
                            this.hiddenFonts.push(psName);
                        }
                    });
                    this.saveHiddenFonts();
                    this.renderFonts();
                    if (this.chkFmSelectAll) this.chkFmSelectAll.checked = false;
                    this.renderFontManager();
                });
            });
        }

        if (this.btnFmShowSel) {
            this.btnFmShowSel.addEventListener('click', () => {
                const selectedPsNames = getSelectedFontNames();
                if (selectedPsNames.length === 0) {
                    showToast('请先勾选需要恢复的字体');
                    return;
                }

                showConfirmModal(`确定要恢复这 ${selectedPsNames.length} 款勾选的字体的显示吗？`, () => {
                    selectedPsNames.forEach(psName => {
                        const idx = this.hiddenFonts.indexOf(psName);
                        if (idx > -1) this.hiddenFonts.splice(idx, 1);
                    });
                    this.saveHiddenFonts();
                    this.renderFonts();
                    if (this.chkFmSelectAll) this.chkFmSelectAll.checked = false;
                    this.renderFontManager();
                });
            });
        }

        const btnClearCache = document.getElementById('btn-clear-font-cache');
        if (btnClearCache) {
            btnClearCache.addEventListener('click', () => {
                // 清除 PS 字体列表缓存（下次打开将全盘重扫并重建中文映射）
                const psCacheList = this.dataDir + "/font_cache.json";
                const cnCacheList = this.dataDir + "/font-cn-cache.json";

                const r1 = window.cep.fs.deleteFile(psCacheList);
                const r2 = window.cep.fs.deleteFile(cnCacheList);

                if ((r1.err === window.cep.fs.NO_ERROR || r1.err === window.cep.fs.ERR_NOT_FOUND) &&
                    (r2.err === window.cep.fs.NO_ERROR || r2.err === window.cep.fs.ERR_NOT_FOUND)) {
                    showToast('字体列表与中文映射缓存已清除，次回打开字体面板将重新扫描全盘。');
                } else {
                    showToast('清除失败，请检查文件占用。');
                }
            });
        }

        // 导出收藏 JSON
        const btnExportFav = document.getElementById('btn-export-fav-json');
        if (btnExportFav) {
            btnExportFav.addEventListener('click', () => this.exportFavJson());
        }

        // 导入收藏 JSON（通过 CEP 文件对话框，不依赖隐藏的 file input?
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
        if (this.btnJumpFontsNet) {
            this.btnJumpFontsNet.addEventListener('click', () => {
                window.cep.util.openURLInDefaultBrowser('https://www.fonts.net.cn/');
            });
        }
        if (this.btnJumpIziHun) {
            this.btnJumpIziHun.addEventListener('click', () => {
                window.cep.util.openURLInDefaultBrowser('https://izihun.com/');
            });
        }
        if (this.btnJump100Font) {
            this.btnJump100Font.addEventListener('click', () => {
                window.cep.util.openURLInDefaultBrowser('https://www.100font.com/');
            });
        }
        if (this.btnJumpZeoSeven) {
            this.btnJumpZeoSeven.addEventListener('click', () => {
                const q = this.inputOnlineSearch && this.inputOnlineSearch.value ? encodeURIComponent(this.inputOnlineSearch.value) : '';
                window.cep.util.openURLInDefaultBrowser(q ? `https://fonts.zeoseven.com/browse/?keyword=${q}` : 'https://fonts.zeoseven.com/');
            });
        }
        if (this.btnJumpMoonvy) {
            this.btnJumpMoonvy.addEventListener('click', () => {
                window.cep.util.openURLInDefaultBrowser('https://moonvy.com/apps/font-preview/');
            });
        }
        if (this.btnAiRecommend) {
            this.btnAiRecommend.addEventListener('click', () => {
                const query = this.inputOnlineSearch ? this.inputOnlineSearch.value.trim() : '';
                if (!query) return showToast('请描述漫画场景或情绪，例如：愤怒男主的大吼、少女内心独白、轻描淡写的对话等。');
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

        // 对比台事?
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
        // 优先读取持久化缓存文件（由 _buildCNMapFromFontList 写入）
        const cnCachePath = this.dataDir + "/font-cn-cache.json";

        if (!forceRefresh) {
            const cacheResult = window.cep.fs.readFile(cnCachePath);
            if (cacheResult.err === window.cep.fs.NO_ERROR && cacheResult.data) {
                try {
                    const parsed = JSON.parse(cacheResult.data);
                    if (parsed && Object.keys(parsed).length > 0) {
                        this._fontCNMap = parsed;
                        this._loadUserAliases();
                        return;
                    }
                } catch (e) { /* 缓存损坏，等 loadFonts 完成后重建 */ }
            }
        }

        // 缓存不存在或强制刷新：先置空，等 loadFonts 完成后由 _buildCNMapFromFontList 填充
        this._fontCNMap = {};
        this._loadUserAliases();
    }

    /**
     * 从已加载的 allFonts 中提取 localName（PS 的 platformName），构建中文对照表并持久化。
     * 彻底替代旧的 fontNameParser Node.js 文件扫描方案，支持 .ttc 且无中文路径问题。
     */
    _buildCNMapFromFontList(fontList) {
        const map = {};
        for (let i = 0; i < fontList.length; i++) {
            const f = fontList[i];
            const local = (f.localName || '').trim();
            const english = (f.name || '').trim();
            // 仅当 localName 非空且与英文族名不同时，才视为有效中文/本地名
            if (local && local !== english) {
                map[f.postScriptName] = local;
            }
        }
        this._fontCNMap = map;

        // 持久化，下次启动直接读缓存，无需重建
        const cnCachePath = this.dataDir + "/font-cn-cache.json";
        try {
            window.cep.fs.writeFile(cnCachePath, JSON.stringify(map));
        } catch (e) {
            console.error('写入 font-cn-cache.json 失败', e);
        }
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

        // 第二优先：字体文件 name 表解析(中文)
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
            // 强制刷新：清空中文对照表缓存，待 readCacheAndRender 后由 _buildCNMapFromFontList 重建
            this.initFontDisplayNames(true);
        }

        const cachePath = this.dataDir + "/font_cache.json";

        const readCacheAndRender = () => {
            try {
                const readResult = window.cep.fs.readFile(cachePath);
                if (readResult.err === window.cep.fs.NO_ERROR && readResult.data) {
                    let data = readResult.data;
                    if (data.charCodeAt(0) === 0xFEFF) {
                        data = data.slice(1);
                    }
                    this.allFonts = JSON.parse(data);
                    this.loadHiddenFonts(); // 读完系统字体后再读隐藏字体列表

                    // 利用 PS 导出的 localName 字段构建/刷新中文对照表
                    // （首次或强制刷新时 _fontCNMap 为空，此处重建并持久化）
                    if (!this._fontCNMap || Object.keys(this._fontCNMap).length === 0) {
                        this._buildCNMapFromFontList(this.allFonts);
                    }

                    if (this.currentMode === 'system') this.renderFonts();
                    this.syncToTypesetPanel();
                    if (window.styleManager) window.styleManager.syncFonts(
                        this.allFonts,
                        (f) => this.getFontDisplayName(f.postScriptName, f.name)
                    );
                    return true;
                }
            } catch (e) {
                console.error("字体缓存解析失败", e);
                this._lastReadError = e.message;
            }
            return false;
        };

        if (!forceRefresh) {
            if (readCacheAndRender()) return;
        }

        this.listContainer.innerHTML = '<div class="placeholder text-accent">首次刷新正在全盘解析字体...这可能需要 10~20秒，请勿操作PS防卡死！</div>';
        const safePath = cachePath.replace(/\\/g, '\\\\');
        this.cs.evalScript(`generateFontCacheFile("${safePath}")`, (res) => {
            if (res === "SUCCESS") {
                // 等待 150ms 避开防病毒软件扫描或文件锁
                setTimeout(() => {
                    if (!readCacheAndRender()) {
                        const errMsg = this._lastReadError ? ' (' + this._lastReadError + ')' : '';
                        this.listContainer.innerHTML = '<div class="placeholder">读取缓存包权限失败？' + errMsg + '</div>';
                    }
                }, 150);
            } else {
                this.listContainer.innerHTML = `<div class="placeholder text-red">生成缓存崩溃: ${res}</div>`;
            }
        });
    }

    loadHiddenFonts() {
        const path = this.dataDir + "/hidden_fonts.json";
        const readResult = window.cep.fs.readFile(path);
        if (readResult.err === window.cep.fs.NO_ERROR && readResult.data) {
            try { this.hiddenFonts = JSON.parse(readResult.data); } catch (e) { this.hiddenFonts = []; }
        }
    }

    saveHiddenFonts() {
        const path = this.dataDir + "/hidden_fonts.json";
        window.cep.fs.writeFile(path, JSON.stringify(this.hiddenFonts));
    }

    toggleHideFont(font, skipManagerRefresh = false) {
        const idx = this.hiddenFonts.indexOf(font.postScriptName);
        if (idx > -1) {
            this.hiddenFonts.splice(idx, 1);
        } else {
            this.hiddenFonts.push(font.postScriptName);
        }
        this.saveHiddenFonts();
        this.renderFonts();
        // 如果管理器正在打开，也同步更新
        if (!skipManagerRefresh && this.modalFontManager && this.modalFontManager.style.display !== 'none') {
            this.renderFontManager();
        }
    }

    // --- 高级字体管理面板工具法 ---
    _getFmFilteredList() {
        const q = this.inputFmSearch ? this.inputFmSearch.value.toLowerCase().trim() : "";
        const filterState = this.selFmFilter ? this.selFmFilter.value : "all";
        let sourceList = this.sortFonts([...this.allFonts]);

        return sourceList.filter(font => {
            const display = this.getFontDisplayName(font.postScriptName, font.name || font.family);
            const isHidden = this.hiddenFonts.includes(font.postScriptName);

            // 状态过滤
            if (filterState === 'visible' && isHidden) return false;
            if (filterState === 'hidden' && !isHidden) return false;

            // Adobe 过滤（保持一致）
            if (font.name && font.name.indexOf("Adobe") === 0 && font.name.length > 20) return false;

            // 关键词过滤
            if (q) {
                const cnName = (display.primary || "").toLowerCase();
                const enName = (display.secondary || "").toLowerCase();
                const psName = (font.postScriptName || "").toLowerCase();
                const originalName = (font.name || "").toLowerCase();
                if (cnName.indexOf(q) === -1 && enName.indexOf(q) === -1 && psName.indexOf(q) === -1 && originalName.indexOf(q) === -1) {
                    return false;
                }
            }
            return true;
        });
    }

    // --- 高级字体管理面板渲染 ---
    renderFontManager() {
        if (!this.fmListContainer) return;
        this.fmListContainer.innerHTML = '';

        let filteredList = this._getFmFilteredList();
        let count = filteredList.length;

        for (let i = 0; i < count; i++) {
            const font = filteredList[i];
            const display = this.getFontDisplayName(font.postScriptName, font.name || font.family);
            const isHidden = this.hiddenFonts.includes(font.postScriptName);

            const item = document.createElement('div');
            item.className = 'fm-item';
            if (isHidden) item.classList.add('fm-item--hidden');
            item.dataset.postScript = font.postScriptName;

            item.innerHTML = `
                <input type="checkbox" class="fm-chk-item fm-item__check" value="${font.postScriptName}">
                <div class="fm-item__body">
                    <div class="fm-item__header">
                        <div class="fm-item__name" title="${display.secondary}">${display.primary}</div>
                        <button class="fm-item__toggle ${isHidden ? 'fm-item__toggle--restore' : ''}">
                            ${isHidden ? '恢复' : '隐藏'}
                        </button>
                    </div>
                    <div class="fm-item__preview" style="font-family: '${font.postScriptName}', sans-serif;">永远の梦を追いかけて 汉化组</div>
                </div>
            `;

            const btnToggle = item.querySelector('.fm-item__toggle');
            const rowCheckbox = item.querySelector('.fm-chk-item');
            if (rowCheckbox) {
                rowCheckbox.addEventListener('change', () => this.updateFontManagerSummary(count));
            }
            item.addEventListener('click', (e) => {
                if (e.target.closest('button') || e.target.closest('input')) return;
                if (!rowCheckbox) return;
                rowCheckbox.checked = !rowCheckbox.checked;
                this.updateFontManagerSummary(count);
            });
            btnToggle.addEventListener('click', () => {
                // 告诉主层跳过全量重绘
                this.toggleHideFont(font, true);

                const filterState = this.selFmFilter ? this.selFmFilter.value : "all";
                const currentlyHidden = this.hiddenFonts.includes(font.postScriptName);

                if (filterState !== 'all') {
                    // 状态过滤模式下，执行隐藏/恢复即不符合该过滤条件，直接把该项藏起来
                    item.style.display = 'none';
                    // 局部倒数
                    let curLabel = this.fmCountLab.innerText;
                    let curNum = parseInt(curLabel.replace(/[^0-9]/ig, ""));
                    if (!isNaN(curNum) && curNum > 0) {
                        this.fmCountLab.innerText = `筛选出 ${curNum - 1} 款`;
                    }
                } else {
                    // 全显模式下，仅仅变暗/提亮
                    item.classList.toggle('fm-item--hidden', currentlyHidden);
                    btnToggle.className = `fm-item__toggle ${currentlyHidden ? 'fm-item__toggle--restore' : ''}`;
                    btnToggle.innerText = currentlyHidden ? '恢复' : '隐藏';
                }
                this.updateFontManagerSummary();
            });

            this.fmListContainer.appendChild(item);
        }

        if (this.fmCountLab) this.fmCountLab.innerText = `筛选出 ${count} 款`;
        if (this.chkFmSelectAll) this.chkFmSelectAll.checked = false;
        this.updateFontManagerSummary(count);

        if (count === 0) {
            this.fmListContainer.innerHTML = '<div class="placeholder">没有查找到符合条件的字体</div>';
            this.updateFontManagerSummary(0);
        }
    }

    syncToTypesetPanel() {
        if (this.allFonts.length === 0) return;

        const buildOption = (f) => {
            const opt = document.createElement('option');
            opt.value = f.postScriptName;
            const displayInfo = this.getFontDisplayName(f.postScriptName, f.name);
            // 有中文名时显示 "中文名（英文名）"，否则只显示英文名
            if (displayInfo.source !== 'fallback') {
                opt.innerText = `${displayInfo.primary}（${f.name}）`;
            } else {
                opt.innerText = f.name;
            }
            return opt;
        };

        // 1. 同步到"批量生成"面板的字体选择
        const typesetDropdown = document.getElementById('sel-font-family');
        if (typesetDropdown) {
            typesetDropdown.innerHTML = '<option value="">(默认匹配 PS 当前预设)</option>';
            this.allFonts.forEach(f => typesetDropdown.appendChild(buildOption(f)));
        }

        // 2. 同步到"单条精调读取/覆写"面板的字体选择
        const syncDropdown = document.getElementById('sel-sync-font');
        if (syncDropdown) {
            syncDropdown.innerHTML = '<option value="">(保持不变)</option>';
            this.allFonts.forEach(f => syncDropdown.appendChild(buildOption(f)));
        }
    }

    // --- 字体列表按显示名（中文优先，拼音排序）进行排序 ---
    sortFonts(fontsList) {
        return fontsList.sort((a, b) => {
            const dispA = this.getFontDisplayName(a.postScriptName, a.name || a.family);
            const dispB = this.getFontDisplayName(b.postScriptName, b.name || b.family);
            // 使用 localeCompare 按拼音/字母顺序排序
            return dispA.primary.localeCompare(dispB.primary, 'zh-CN');
        });
    }

    // ------------ 统一 UI 渲染 ------------

    renderFonts() {
        if (!this.listContainer) return;
        this.listContainer.innerHTML = '';
        this.listContainer.classList.toggle('font-list--batch', !!this.batchMode);

        const q = this.inputSearch ? this.inputSearch.value.toLowerCase().trim() : "";
        let count = 0;

        const cjkRegex = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/;

        // --- 过滤最近使用中被隐藏的字体 ---
        let visibleRecentFonts = [];
        if (this.recentFonts.length > 0) {
            visibleRecentFonts = this.recentFonts.filter(f => {
                const isHidden = this.hiddenFonts.includes(f.postScriptName);
                return !(isHidden && !this.showHidden);
            });
        }

        // 如果是系统全部字体且无搜索状态，先渲染最近使用
        if (this.currentMode === 'system' && this.sysFilter === 'all' && !q && visibleRecentFonts.length > 0) {
            const recentTitle = document.createElement('div');
            recentTitle.className = 'placeholder text-accent';
            recentTitle.style.textAlign = 'left';
            recentTitle.style.padding = '4px 8px';
            recentTitle.innerHTML = '🕒 最近使用';
            this.listContainer.appendChild(recentTitle);

            for (let i = 0; i < visibleRecentFonts.length; i++) {
                this.listContainer.appendChild(this.createFontItemNodeLegacy(visibleRecentFonts[i]));
            }

            const divLine = document.createElement('div');
            divLine.style.height = '1px';
            divLine.style.background = 'var(--bg-lighter)';
            divLine.style.margin = '8px 0';
            this.listContainer.appendChild(divLine);
        }

        // 判定展示的数据源
        let sourceList = this.currentMode === 'favorite' ? this.favFonts : this.allFonts;

        // --- 对列表进行排序 ---
        sourceList = this.sortFonts([...sourceList]);

        for (let i = 0; i < sourceList.length; i++) {
            const font = sourceList[i];
            const display = this.getFontDisplayName(font.postScriptName, font.name || font.family);

            // 过滤逻辑
            if (this.currentMode === 'system') {
                const isHidden = this.hiddenFonts.includes(font.postScriptName);
                if (isHidden && !this.showHidden) continue;

                if (font.name && font.name.indexOf("Adobe") === 0 && font.name.length > 20) continue;

                // 搜索时匹配：中文(经过解析/别名)、英文族名、PS唯一名
                if (q) {
                    const cnName = (display.primary || "").toLowerCase();
                    const enName = (display.secondary || "").toLowerCase();
                    const psName = (font.postScriptName || "").toLowerCase();
                    const originalName = (font.name || "").toLowerCase();
                    if (cnName.indexOf(q) === -1 && enName.indexOf(q) === -1 && psName.indexOf(q) === -1 && originalName.indexOf(q) === -1) {
                        continue;
                    }
                }
                const isCjk = cjkRegex.test(display.primary) || display.primary.indexOf("GB") > -1 || display.primary.indexOf("SC") > -1 || display.primary.indexOf("TC") > -1;

                if (this.sysFilter === 'chinese' && !isCjk) continue;
                if (this.sysFilter === 'english' && isCjk) continue;
            } else {
                if (this.favFilter !== 'all' && font.category !== this.favFilter) continue;
            }

            count++;
            this.listContainer.appendChild(this.createFontItemNodeLegacy(font));
        }

        if (this.labCount) this.labCount.innerText = `共 ${count} 款`;
        this.updateFontToolbarSummary(count, q);
        this._updateBatchInfo();

        if (count === 0 && this.recentFonts.length === 0) {
            this.listContainer.innerHTML = '<div class="placeholder">没有任何相关联的字体记录</div>';
        }
    }

    updateFontToolbarSummary(count, query) {
        if (this.fontQuickSummary) {
            const hiddenCount = this.hiddenFonts.length;
            const recentCount = this.recentFonts ? this.recentFonts.length : 0;
            const modeLabel = this.currentMode === 'favorite'
                ? '收藏'
                : this.currentMode === 'online'
                    ? '在线'
                    : '系统';
            const queryPart = query ? ' · 搜索中' : '';
            const hiddenPart = this.currentMode === 'system' ? ` · 已隐藏 ${hiddenCount}` : '';
            const recentPart = this.currentMode === 'system' && !query ? ` · 最近 ${recentCount}` : '';
            this.fontQuickSummary.textContent = `${modeLabel}字体 ${count} 款${queryPart}${hiddenPart}${recentPart}`;
        }

        if (this.btnFontToggleHidden) {
            this.btnFontToggleHidden.textContent = this.showHidden ? '隐藏已隐藏' : '显示已隐藏';
            this.btnFontToggleHidden.classList.toggle('is-active', this.showHidden);
        }
    }

    updateFontManagerSummary(forcedCount) {
        if (!this.fmQuickSummary) return;
        const visibleCount = typeof forcedCount === 'number'
            ? forcedCount
            : (this.fmListContainer ? this.fmListContainer.querySelectorAll('.fm-chk-item').length : 0);
        const selectedCount = this.fmListContainer
            ? this.fmListContainer.querySelectorAll('.fm-chk-item:checked').length
            : 0;
        const hiddenCount = this.hiddenFonts.length;
        this.fmQuickSummary.textContent = `当前 ${visibleCount} 款 · 已选 ${selectedCount} · 隐藏库 ${hiddenCount}`;
    }

    // ── 批量辅助方法 ──
    _updateBatchInfo() {
        if (!this.batchInfo) return;
        const selectedCount = this.listContainer ? this.listContainer.querySelectorAll('.font-item__check:checked').length : 0;
        this.batchInfo.textContent = `已选 ${selectedCount} 款`;
    }

    _getSelectedBatchFonts() {
        if (!this.listContainer) return [];
        const checks = this.listContainer.querySelectorAll('.font-item__check:checked');
        return Array.from(checks).map(c => c.value);
    }

    createFontItemNode(font) {
        const display = this.getFontDisplayName(font.postScriptName, font.name || font.family);
        const previewText = '永远の梦を追いかけて 汉化组';

        const isFav = this.favFonts.findIndex(f => f.postScriptName === font.postScriptName) > -1;
        const isCmp = this.compareFonts.findIndex(f => f.postScriptName === font.postScriptName) > -1;
        const isHidden = this.hiddenFonts.includes(font.postScriptName);

        const item = document.createElement('div');
        item.className = 'font-item';
        // 如果处于显示隐藏模式且该字体被隐藏，则增加透明度
        if (this.showHidden && isHidden && this.currentMode === 'system') {
            item.style.opacity = '0.5';
            item.style.borderLeft = '3px solid var(--red)';
        }
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
                ${this.currentMode === 'system' ? `<button class="btn-icon btn-hide" title="${isHidden ? '取消隐藏' : '隐藏此字体'}" style="${isHidden ? 'color:var(--red);' : 'color:var(--text-faint);'}">👁</button>` : ''}
                ${isFav ? `<button class="btn-icon btn-fav text-accent" title="编辑收藏">⭐</button>` : `<button class="btn-icon btn-fav" title="添加收藏 / 设别名">☆</button>`}
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

        // 隐藏按钮
        const btnHide = item.querySelector('.btn-hide');
        if (btnHide) {
            btnHide.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleHideFont(font);
            });
        }

        // 收藏按钮
        const btnFav = item.querySelector('.btn-fav');
        if (btnFav) {
            btnFav.addEventListener('click', (e) => {
                e.stopPropagation();
                // font.name 是原来给弹窗兜底用的主显示词
                this.openFavModal({ postScriptName: font.postScriptName, name: display.primary });
            });
        }

        // 对比按钮
        const btnCmp = item.querySelector('.btn-cmp');
        if (btnCmp) {
            btnCmp.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleCompare(font);
            });
        }

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

    createFontItemNodeLegacy(font) {
        const display = this.getFontDisplayName(font.postScriptName, font.name || font.family);
        const previewText = '永远の梦を追いかけて 汉化组';
        const isFav = this.favFonts.findIndex(f => f.postScriptName === font.postScriptName) > -1;
        const isCmp = this.compareFonts.findIndex(f => f.postScriptName === font.postScriptName) > -1;
        const isHidden = this.hiddenFonts.includes(font.postScriptName);

        const item = document.createElement('div');
        item.className = 'font-item';
        item.dataset.postScript = font.postScriptName;

        if (isHidden) item.classList.add('font-item--hidden');
        if (this.showHidden && isHidden && this.currentMode === 'system') {
            item.style.opacity = '0.5';
            item.style.borderLeft = '3px solid var(--red)';
        }

        item.innerHTML = `
            <input type="checkbox" class="font-item__check" value="${font.postScriptName}">
            <div class="font-item__body">
                <div class="font-item__header">
                    <div class="font-item__name" title="${display.secondary}">${display.primary}</div>
                    <div class="font-item__actions">
                        ${this.currentMode === 'system' ? `<button class="btn-icon btn-hide" title="${isHidden ? '取消隐藏' : '隐藏字体'}" style="${isHidden ? 'color:var(--red);' : 'color:var(--text-faint);'}">隐</button>` : ''}
                        ${isFav ? `<button class="btn-icon btn-fav text-accent" title="编辑收藏">藏</button>` : `<button class="btn-icon btn-fav" title="添加收藏">藏</button>`}
                        ${isCmp ? `<button class="btn-icon btn-cmp text-accent" title="移除对比" style="background:var(--accent-dim); border-color:var(--accent);">已加</button>` : `<button class="btn-icon btn-cmp" title="加入对比">对</button>`}
                    </div>
                </div>
                <div class="font-item__preview" style="font-family:'${font.postScriptName}', '${font.name || font.family}';">
                    ${previewText}
                </div>
            </div>
        `;

        const rowCheckbox = item.querySelector('.font-item__check');
        if (rowCheckbox) {
            rowCheckbox.addEventListener('click', (e) => e.stopPropagation());
            rowCheckbox.addEventListener('change', () => this._updateBatchInfo());
        }

        item.addEventListener('click', (e) => {
            if (e.target.closest('.font-item__check')) return;
            if (e.target.closest('.btn-icon')) return;

            if (this.batchMode && rowCheckbox) {
                rowCheckbox.checked = !rowCheckbox.checked;
                this._updateBatchInfo();
                return;
            }

            const oldBg = item.style.background;
            item.style.background = 'var(--accent-dim)';
            setTimeout(() => item.style.background = oldBg, 200);

            this.applyFontToActiveLayer(font);
        });

        const btnHide = item.querySelector('.btn-hide');
        if (btnHide) {
            btnHide.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleHideFont(font);
            });
        }

        const btnFav = item.querySelector('.btn-fav');
        if (btnFav) {
            btnFav.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openFavModal({ postScriptName: font.postScriptName, name: display.primary });
            });
        }

        const btnCmp = item.querySelector('.btn-cmp');
        if (btnCmp) {
            btnCmp.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleCompare(font);
            });
        }

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

        const executeApply = () => {
            let fnName = 'applyFontToLayer';
            if (scope === 'selected') fnName = 'applyFontToSelectedTextLayers';
            if (scope === 'all') fnName = 'applyFontToAllTextLayers';

            const safePsName = String(font.postScriptName || '');

            this.cs.evalScript(`${fnName}(${JSON.stringify(safePsName)})`, (res) => {
                if (res && res.indexOf("错误") > -1) {
                    showToast(res);
                    return;
                }

                // 解析批量结果（若有）
                if (res && res.indexOf('SUCCESS|||') === 0) {
                    try {
                        const jsonStr = res.replace('SUCCESS|||', '');
                        const info = JSON.parse(jsonStr);
                        // 仅批量操作弹出摘要提示；单图层不打扰
                        if (scope !== 'active') {
                            showToast(`✅ 字体批量应用完成\n总目标 ${info.total}\n已应用 ${info.applied}\n已跳过 ${info.skipped}`);
                        }
                    } catch (e) { }
                }

                // 成功即记录最近使用
                this.saveRecentFont(font);

                // 应用时不强制全局重刷，避免弹窗或 hover 状态被打断，只默默更新后台最近字体。
                // 如果用户需要看最新的“最近记录”，他们会自己切换或重新搜索的。
            });
        };

        // 大范围操作给一个确认，避免误触
        if (scope === 'all') {
            showConfirmModal("将对《当前文档全部文本图层》批量套用该字体。确定继续吗？", () => {
                executeApply();
            });
        } else {
            executeApply();
        }
    }

    toggleCompare(font) {
        const idx = this.compareFonts.findIndex(f => f.postScriptName === font.postScriptName);
        if (idx > -1) {
            this.compareFonts.splice(idx, 1);
        } else {
            if (this.compareFonts.length >= 6) {
                showToast("比武台名额有限，最多只能同时上台对比 6 款字体！");
                return;
            }
            this.compareFonts.push(font);
        }
        this.updateCompareBar();
        this.renderFonts(); // 刷新按钮高亮?
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
        const previewText = this.cmpText.value || "没有输入对比文字?";

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
            showToast('收藏夹为空，没有可导出的数据。');
            return;
        }
        // 使用 CEP 文件保存对话?
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
            showToast(`✅ 收藏已导出到：\n${savePath}`);
        } else {
            showToast(`❌ 导出失败，错误码：${writeResult.err}`);
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
            showToast('读取文件失败，请确认文件完整且可读。');
            return;
        }

        let imported;
        try {
            imported = JSON.parse(readResult.data);
        } catch (e) {
            showToast('JSON 格式错误，无法解析该文件。');
            return;
        }

        if (!Array.isArray(imported)) {
            showToast('文件格式不符，期望一个 JSON 数组。');
            return;
        }

        // 合并模式：以 postScriptName 为主键，导入项会覆盖已有同名?
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
        showToast(`✅ 导入完成：新增 ${addedCount} 款，更新 ${updatedCount} 款。`);
    }

    // ── 在线字体精选数据库（内嵌，不需?API）──
    getOnlineFontDB() {
        return [
            { name: '得意黑', psHint: 'Smiley-Sans', style: '现代活泼黑体，斜切风格个性鲜明', url: 'https://github.com/atelier-anchor/smiley-sans', tags: ['黑体', '漫画', '标题'] },
            { name: '霞鹿文楷', psHint: 'LXGWWenKai', style: '开源楷体，温润书写感', url: 'https://github.com/lxgw/LxgwWenKai', tags: ['楷体', '手写', '旁白'] },
            { name: '霞鹿新致宋', psHint: 'LXGWNeoZhiSong', style: '开源宋体，典雅正文体验', url: 'https://github.com/lxgw/LxgwWenKai', tags: ['宋体', '正文', '旁白'] },
            { name: '阿里巴巴普惠体', psHint: 'AlibabaPuHuiTi', style: '多字重免费黑体，正文展示均适合', url: 'https://fonts.alibaba.com/', tags: ['黑体', '正文', '商用'] },
            { name: '优设标题黑', psHint: 'YouSheBiaoTiHei', style: '超粗展示黑体，大震澏场景', url: 'https://www.uisdc.com/', tags: ['黑体', '标题', '漫画'] },
            { name: '庞门正道标题体', psHint: 'PangMenZhengDao', style: '设计感标题体，英雄气概十足', url: 'https://www.fonts.net.cn/', tags: ['标题', '漫画'] },
            { name: '站酷快乐体', psHint: 'ZCOOL-KuaiLe', style: '圆润欢快，适合轻松对话', url: 'https://www.zcool.com.cn/', tags: ['圆体', '漫画', '可爱'] },
            { name: '站酷高端黑体', psHint: 'ZCOOL-GDH', style: '现代高端黑体，都市漫画', url: 'https://www.zcool.com.cn/', tags: ['黑体', '标题'] },
            { name: '思源宋体', psHint: 'SourceHanSerifSC', style: 'Google/Adobe 宋体，文学旁白首选', url: 'https://github.com/adobe-fonts/source-han-serif', tags: ['宋体', '正文', '旁白'] },
            { name: '思源黑体', psHint: 'SourceHanSansCN', style: 'Google/Adobe 全字重完备', url: 'https://github.com/adobe-fonts/source-han-sans', tags: ['黑体', '正文'] },
            { name: '字魂肥宅快乐体', psHint: 'zihun39hao-feizhaikuaileti', style: '圆润可爱，轻松搞笑场景', url: 'https://izihun.com/', tags: ['圆体', '可爱', '漫画'] },
            { name: 'MiSans', psHint: 'MiSans-Regular', style: '小米无袖线体，干净现代，多字重', url: 'https://hyperos.mi.com/font/', tags: ['黑体', '正文'] },
            { name: 'Noto Sans SC', psHint: 'NotoSansSC-Regular', style: 'Google 开源无袖线，全面兼容 Unicode', url: 'https://fonts.google.com/noto', tags: ['黑体', '正文'] },
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
                        ${isInstalled ? '<span style="font-size:10px;color:var(--accent);margin-left:6px;">✅ 已安装</span>' : ''}
                    </div>
                    <button class="btn btn--ghost btn--xs" style="padding:2px 8px;font-size:11px;" data-url="${font.url}">下载</button>
                </div>
                <div style="font-size:11px;color:var(--text-faint);margin-bottom:6px;">${font.style}</div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;">${font.tags.map(t => `<span style="font-size:10px;background:var(--bg-lighter);color:var(--text-dim);padding:1px 6px;border-radius:10px;">${t}</span>`).join('')}</div>
            `;
            card.querySelector('button').addEventListener('click', () => window.cep.util.openURLInDefaultBrowser(font.url));
            container.appendChild(card);
        });
    }

    // ── 升级?AI 推荐：多模型 + 结构?JSON 卡片展示 ──
    async callAiFontRecommendation(query) {
        const cfg = PresetsManager.getApiConfig();
        if (!cfg.apiKey) {
            showToast('请前往『设置』页面填入大模型 API Key，然后再使用 AI 推荐功能。');
            return;
        }

        if (this.btnAiRecommend) { this.btnAiRecommend.textContent = '分析中…'; this.btnAiRecommend.disabled = true; }
        const resultArea = document.getElementById('ai-result-area');
        const resultCards = document.getElementById('ai-result-cards');
        if (resultArea) resultArea.style.display = 'none';
        if (resultCards) resultCards.innerHTML = '<div class="placeholder text-accent">🤖 AI 正在分析情景，匹配最合适的字体风格?/div>';
        if (resultArea) resultArea.style.display = 'block';

        const systemPrompt = `你是专业的漫画排版与字体美学专家。用户描述漫画场景，你推荐最合适的中文字体?

严格?JSON 格式回复，不要输出其他任何内容，格式?
{
  "analysis": "对场景的简短分析（20字以内）",
  "recommendations": [
    { "name": "字体名称", "reason": "推荐理由（5字以内）", "keyword": "搜索关键词" }
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
                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(`HTTP ${res.status} - ${errorText.substring(0, 150)}`);
                }
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
                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(`HTTP ${res.status} - ${errorText.substring(0, 150)}`);
                }
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
            if (resultCards) resultCards.innerHTML = `<div style="color:var(--text-red,#f66);font-size:12px;padding:8px;">❌ AI 连接失败：${e.message.substring(0, 200)}<br><small>请在设置页检查 API Key 和网络连接</small></div>`;
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
                        ${isInstalled ? '<span style="font-size:10px;color:var(--accent);margin-left:6px;">✅ 已安装</span>' : ''}
                    </div>
                </div>
                <div style="font-size:11px;color:var(--text-faint);margin-bottom:8px;">${rec.reason || ''}</div>
                <div style="display:flex;gap:6px;">
                    <button class="btn btn--ghost btn--xs btn-jump-zf" style="font-size:11px;">字由搜索</button>
                    <button class="btn btn--ghost btn--xs btn-jump-zeo" style="font-size:11px;">ZeoSeven</button>
                </div>
            `;
            card.querySelector('.btn-jump-zf').addEventListener('click', () => window.cep.util.openURLInDefaultBrowser(zfontUrl));
            card.querySelector('.btn-jump-zeo').addEventListener('click', () => window.cep.util.openURLInDefaultBrowser(zeoUrl));
            container.appendChild(card);
        });
    }
}
