// pageManager.js - 页面管理面板前端逻辑

class PageManager {
    constructor(csInterface, extPath, dataDir) {
        this.cs = csInterface;
        this.extPath = extPath;
        this.dataDir = dataDir || null;

        this.pages = [];
        this.activePageIndex = -1;
        this.draggedItemIndex = null;

        this.projectStatePath = this.dataDir ? (this.dataDir + '/project_state.json') : null;
        this._saveTimer = null;

        this.initDOM();
        this.injectEnhancements();
        this.bindEvents();
        this.updateCompareUi();
        this.loadProjectState();
    }

    initDOM() {
        this.btnImport = document.getElementById('btn-import-pages');
        this.btnRemoveSel = document.getElementById('btn-remove-selected');
        this.btnClear = document.getElementById('btn-clear-pages');
        this.thumbnailContainer = document.getElementById('page-thumbnails');

        this.selStateFilter = document.getElementById('sel-page-state-filter');
        this.btnBatchRename = document.getElementById('btn-batch-rename');
        this.btnToggleCompareTop = document.getElementById('btn-toggle-compare-top');
        this.inputExportDir = document.getElementById('input-export-dir');
        this.btnSelExportDir = document.getElementById('btn-sel-export-dir');
        this.selExportFormat = document.getElementById('sel-export-format');
        this.btnBatchExport = document.getElementById('btn-batch-export');
        this.btnBatchSavePsd = document.getElementById('btn-batch-save-psd');

        this.btnSavePsd = document.getElementById('btn-save-psd');
        this.btnSavePsdCompare = document.getElementById('btn-save-psd-compare');

        this.btnToggleCompare = document.getElementById('btn-toggle-compare');
        // 修图界面顶部的原图对比按钮（与上面两个复用同一逻辑）
        this.btnToggleCompareRetouch = document.getElementById('btn-toggle-compare-retouch');
        this.compareOpacityRow = document.getElementById('compare-opacity-row');
        this.inputCompareOpacity = document.getElementById('input-compare-opacity');
        this.compareOpacityVal = document.getElementById('compare-opacity-val');

        this.btnNextPage = document.getElementById('btn-next-page');
        this.btnAutoDetectStatus = document.getElementById('btn-auto-detect-status');

        this.modalClearConfirm = document.getElementById('modal-clear-confirm');
        this.btnConfirmClear = document.getElementById('btn-confirm-clear');
        this.btnCancelClear = document.getElementById('btn-cancel-clear');
    }

    injectEnhancements() {
        if (!this.thumbnailContainer) return;

        if (!document.getElementById('page-quick-bar')) {
            const quickBar = document.createElement('div');
            quickBar.id = 'page-quick-bar';
            quickBar.className = 'inline-bar mb-2';
            quickBar.innerHTML = [
                '<span id="page-summary" class="form-hint" style="margin-left:0;">共 0 页</span>',
                '<button id="btn-select-visible-pages" class="btn btn--ghost btn--xs">全选可见</button>',
                '<button id="btn-clear-page-selection" class="btn btn--ghost btn--xs">清空选择</button>'
            ].join('');
            this.thumbnailContainer.insertAdjacentElement('beforebegin', quickBar);
        }

        this.pageSummary = document.getElementById('page-summary');
        this.btnSelectVisiblePages = document.getElementById('btn-select-visible-pages');
        this.btnClearPageSelection = document.getElementById('btn-clear-page-selection');
    }

    callHost(fnName, args, callback) {
        if (window.callHostScript) {
            window.callHostScript(this.cs, fnName, args || [], callback);
            return;
        }

        const serializedArgs = (args || []).map(arg => JSON.stringify(arg)).join(', ');
        this.cs.evalScript(`${fnName}(${serializedArgs})`, callback);
    }

    scheduleSaveProjectState() {
        if (!this.projectStatePath) return;
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => this.saveProjectState(), 250);
    }

    saveProjectState() {
        if (!this.projectStatePath) return;

        try {
            const state = {
                version: 1,
                savedAt: Date.now(),
                pages: this.pages,
                activePageIndex: this.activePageIndex,
                stateFilter: this.selStateFilter ? this.selStateFilter.value : 'all',
                exportDir: this.inputExportDir ? this.inputExportDir.value : '',
                exportFormat: this.selExportFormat ? this.selExportFormat.value : 'jpg'
            };
            window.cep.fs.writeFile(this.projectStatePath, JSON.stringify(state, null, 2));
        } catch (err) {
            console.warn('[project state] save failed:', err);
        }
    }

    loadProjectState() {
        if (!this.projectStatePath) return;

        try {
            const readResult = window.cep.fs.readFile(this.projectStatePath);
            if (readResult.err !== window.cep.fs.NO_ERROR || !readResult.data) return;

            const parsed = JSON.parse(readResult.data);
            if (!parsed || !Array.isArray(parsed.pages)) return;

            this.pages = parsed.pages
                .filter(item => item && item.path)
                .map(item => ({
                    path: item.path,
                    name: item.name || this.getFileName(item.path),
                    status: item.status || 'untouched'
                }));

            if (this.selStateFilter && parsed.stateFilter) this.selStateFilter.value = parsed.stateFilter;
            if (this.inputExportDir && parsed.exportDir) this.inputExportDir.value = parsed.exportDir;
            if (this.selExportFormat && parsed.exportFormat) this.selExportFormat.value = parsed.exportFormat;

            this.activePageIndex = typeof parsed.activePageIndex === 'number' ? parsed.activePageIndex : -1;

            this.renderThumbnails();
            this.syncSelectionSummary();
            this.syncPagesToHost();
        } catch (err) {
            console.warn('[project state] load failed:', err);
        }
    }

    bindEvents() {
        if (this.btnImport) {
            this.btnImport.addEventListener('click', () => this.handleImportClick());
        }

        if (this.btnRemoveSel) {
            this.btnRemoveSel.addEventListener('click', () => this.removeSelectedPages());
        }

        if (this.btnClear) {
            this.btnClear.addEventListener('click', () => {
                if (this.modalClearConfirm) this.modalClearConfirm.classList.add('show');
            });
        }

        if (this.btnConfirmClear) {
            this.btnConfirmClear.addEventListener('click', () => this.clearAllPages());
        }

        if (this.btnCancelClear) {
            this.btnCancelClear.addEventListener('click', () => {
                if (this.modalClearConfirm) this.modalClearConfirm.classList.remove('show');
            });
        }

        if (this.selStateFilter) {
            this.selStateFilter.addEventListener('change', () => {
                this.renderThumbnails();
                this.syncSelectionSummary();
                this.scheduleSaveProjectState();
            });
        }

        if (this.btnSelectVisiblePages) {
            this.btnSelectVisiblePages.addEventListener('click', () => this.toggleVisibleSelection(true));
        }

        if (this.btnClearPageSelection) {
            this.btnClearPageSelection.addEventListener('click', () => this.toggleVisibleSelection(false));
        }

        if (this.btnBatchRename) {
            this.btnBatchRename.addEventListener('click', () => this.batchRenamePages());
        }

        if (this.btnAutoDetectStatus) {
            this.btnAutoDetectStatus.addEventListener('click', () => this.detectActivePageStatus());
        }

        if (this.btnNextPage) {
            this.btnNextPage.addEventListener('click', () => this.advanceToNextPage());
        }

        if (this.btnSelExportDir) {
            this.btnSelExportDir.addEventListener('click', () => this.selectExportDirectory());
        }

        if (this.selExportFormat) {
            this.selExportFormat.addEventListener('change', () => this.scheduleSaveProjectState());
        }

        if (this.btnBatchExport) {
            this.btnBatchExport.addEventListener('click', () => this.batchExportPages());
        }

        if (this.btnBatchSavePsd) {
            this.btnBatchSavePsd.addEventListener('click', () => this.batchSaveOpenDocs());
        }

        if (this.btnSavePsd) {
            this.btnSavePsd.addEventListener('click', () => {
                this.callHost('saveCurrentDocumentAsPsd', [false], (res) => {
                    if (res && res.indexOf('错误') > -1) showToast(res, 'error');
                });
            });
        }

        if (this.btnSavePsdCompare) {
            this.btnSavePsdCompare.addEventListener('click', () => {
                this.callHost('saveCurrentDocumentAsPsd', [true], (res) => {
                    if (res && res.indexOf('错误') > -1) showToast(res, 'error');
                });
            });
        }

        [this.btnToggleCompare, this.btnToggleCompareTop, this.btnToggleCompareRetouch].forEach((btn) => {
            if (!btn) return;
            btn.addEventListener('click', () => this.handleGenerateCompareClick());
        });
    }

    handleGenerateCompareClick() {
        this.generateCompareAssetForCurrentDocument((res) => {
            this.updateCompareUi();
            if (res === 'NO_DOC') {
                showToast('当前没有打开的文档', 'error');
                return;
            }
            if (res === 'NO_HANDLER' || res === 'NO_LAYER' || (res && res.indexOf('ERROR:') === 0)) {
                showToast(res || '生成原图对比失败', 'error');
                return;
            }
            showToast('已生成原图对比层，默认保持隐藏', 'success');
        });
    }

    updateCompareUi() {
        if (this.btnToggleCompare) {
            this.btnToggleCompare.innerText = '生成原图对比（隐藏）';
            this.btnToggleCompare.classList.remove('active');
        }

        if (this.btnToggleCompareTop) {
            this.btnToggleCompareTop.innerText = '生成原图对比';
            this.btnToggleCompareTop.classList.remove('active');
        }

        if (this.btnToggleCompareRetouch) {
            this.btnToggleCompareRetouch.innerText = '生成原图对比';
            this.btnToggleCompareRetouch.classList.remove('active');
        }

        if (this.compareOpacityRow) {
            this.compareOpacityRow.style.display = 'none';
        }

        if (this.compareOpacityVal) {
            this.compareOpacityVal.innerText = '100%';
        }
    }

    syncCompareAfterDocumentSwitch() {
        this.updateCompareUi();
    }

    generateCompareAssetForCurrentDocument(callback) {
        const script = `
            (function () {
                try {
                    if (app.documents.length === 0) return "NO_DOC";
                    var result = (typeof backupOriginalLayer === "function")
                        ? backupOriginalLayer()
                        : "NO_HANDLER";
                    var doc = app.activeDocument;
                    var layerName = "【原图参考】";
                    for (var i = 0; i < doc.layers.length; i++) {
                        if (doc.layers[i].name === layerName) {
                            doc.layers[i].visible = false;
                            return result || "SUCCESS";
                        }
                    }
                    return result || "NO_LAYER";
                } catch (e) {
                    return "ERROR:" + e.toString();
                }
            })()
        `;

        this.cs.evalScript(script, (res) => {
            if (typeof callback === 'function') callback(res);
        });
    }

    handleImportClick() {
        if (!this.btnImport) return;

        const oldText = this.btnImport.innerText;
        this.btnImport.innerText = '正在打开文件选择器...';
        this.btnImport.disabled = true;

        setTimeout(() => {
            const isWin = navigator.platform.toLowerCase().indexOf('win') > -1;
            const filterStr = isWin
                ? '所有文件 (*.*):*.*,图像文件 (*.jpg;*.jpeg;*.png;*.tiff;*.webp;*.bmp):*.jpg;*.jpeg;*.png;*.tiff;*.webp;*.bmp,Photoshop 文档 (*.psd):*.psd'
                : 'function(f) { return (f instanceof Folder) || f.name.match(/\\.(jpg|jpeg|png|tiff|webp|bmp|psd)$/i); }';

            const script = `
                (function () {
                    try {
                        var filter = ${isWin ? '"' + filterStr + '"' : filterStr};
                        var result = File.openDialog("请选择要导入的漫画页面", filter, true);
                        if (result) {
                            var paths = [];
                            for (var i = 0; i < result.length; i++) {
                                paths.push(result[i].fsName);
                            }
                            return JSON.stringify(paths);
                        }
                        return "[]";
                    } catch (e) {
                        return "ERROR:" + e.toString();
                    }
                })()
            `;

            this.cs.evalScript(script, (res) => {
                this.btnImport.innerText = oldText;
                this.btnImport.disabled = false;

                if (!res || res.indexOf('ERROR:') === 0 || res === '[]') return;

                try {
                    const filePaths = JSON.parse(res);
                    if (Array.isArray(filePaths) && filePaths.length > 0) {
                        this.handleImportedFiles(filePaths);
                    }
                } catch (err) {
                    console.error('解析导入路径失败', err);
                    showToast('解析导入结果失败', 'error');
                }
            });
        }, 100);
    }

    removeSelectedPages() {
        const checkboxes = Array.from(document.querySelectorAll('.page-checkbox:checked'));
        if (checkboxes.length === 0) {
            showToast('请先勾选要移除的页面（点击右上角复选框）', 'error');
            return;
        }

        const pathsToRemove = new Set(checkboxes.map(cb => cb.value));
        this.pages = this.pages.filter(page => !pathsToRemove.has(page.path));

        if (this.activePageIndex >= this.pages.length) {
            this.activePageIndex = this.pages.length - 1;
        }

        this.renderThumbnails();
        this.syncSelectionSummary();
        this.scheduleSaveProjectState();
        this.syncPagesToHost();
    }

    clearAllPages() {
        this.pages = [];
        this.activePageIndex = -1;
        this.renderThumbnails();
        this.syncSelectionSummary();
        this.scheduleSaveProjectState();
        this.syncPagesToHost();
        if (this.modalClearConfirm) this.modalClearConfirm.classList.remove('show');
    }

    batchRenamePages() {
        if (this.pages.length === 0) {
            showToast('页面队列为空', 'error');
            return;
        }

        const desc = [
            '命名模板说明：',
            '  {n}    = 页码序号，例如 1, 2, 3',
            '  {nn}   = 两位页码，例如 01, 02',
            '  {name} = 原文件名（不含扩展名）',
            '',
            '示例：第06话_{nn} -> 第06话_01.jpg',
            '',
            '请输入命名模板：'
        ].join('\n');

        showPromptModal(desc, '第00话_{nn}', (template) => {
            if (!template) return;

            this.pages.forEach((page, idx) => {
                const dotIdx = page.name.lastIndexOf('.');
                const baseName = dotIdx > 0 ? page.name.substring(0, dotIdx) : page.name;
                const ext = dotIdx > 0 ? page.name.substring(dotIdx) : '';
                const pageNum = idx + 1;
                const nn = String(pageNum).padStart(2, '0');
                page.name = template
                    .replace(/\{nn\}/g, nn)
                    .replace(/\{n\}/g, String(pageNum))
                    .replace(/\{name\}/g, baseName)
                    + ext;
            });

            this.renderThumbnails();
            this.scheduleSaveProjectState();
        }, '批量改名');
    }

    detectActivePageStatus() {
        if (this.activePageIndex < 0) {
            showToast('请先点击页面列表中的一个页面以激活它', 'error');
            return;
        }

        this.callHost('detectDocumentStatus', [], (res) => {
            if (!res || res === 'none') return;
            this.pages[this.activePageIndex].status = res;
            this.renderThumbnails();
            this.scheduleSaveProjectState();
            this.restoreActiveThumbnail(this.activePageIndex);
        });
    }

    advanceToNextPage() {
        if (this.pages.length === 0) {
            showToast('页面列表为空', 'error');
            return;
        }

        if (this.activePageIndex >= 0) {
            const current = this.pages[this.activePageIndex];
            if (current.status === 'untouched') current.status = 'retouched';
            else if (current.status === 'retouched') current.status = 'typeset';
            else if (current.status === 'typeset') current.status = 'done';
        }

        let nextIdx = -1;
        for (let i = this.activePageIndex + 1; i < this.pages.length; i += 1) {
            if (this.pages[i].status !== 'done') {
                nextIdx = i;
                break;
            }
        }

        if (nextIdx < 0) {
            for (let i = 0; i < this.pages.length; i += 1) {
                if (this.pages[i].status !== 'done') {
                    nextIdx = i;
                    break;
                }
            }
        }

        this.renderThumbnails();
        this.scheduleSaveProjectState();

        if (nextIdx < 0) {
            showToast('全部页面均已完成', 'success');
            return;
        }

        const nextPage = this.pages[nextIdx];
        this.activePageIndex = nextIdx;
        this.callHost('openOrSwitchDocument', [nextPage.path], () => {
            this.syncCompareAfterDocumentSwitch();
        });

        setTimeout(() => this.restoreActiveThumbnail(nextIdx, true), 100);
        this.scheduleSaveProjectState();
    }

    selectExportDirectory() {
        const result = window.cep.fs.showOpenDialog(false, true, '选择批量导出保存的文件夹', '', []);
        if (result.err === window.cep.fs.NO_ERROR && result.data.length > 0) {
            this.inputExportDir.value = result.data[0];
            this.scheduleSaveProjectState();
        }
    }

    batchExportPages() {
        if (this.pages.length === 0) {
            showToast('当前列表为空，无图可导', 'error');
            return;
        }

        const outDir = this.inputExportDir ? this.inputExportDir.value : '';
        if (!outDir) {
            showToast('请先选择导出文件夹', 'error');
            return;
        }

        const format = this.selExportFormat ? this.selExportFormat.value : 'jpg';
        this.btnBatchExport.innerText = '⏳ 跑批处理中，请勿操作...';
        this.btnBatchExport.disabled = true;

        this.callHost('batchExportAllPages', [JSON.stringify(this.pages), outDir, format], (res) => {
            showAlertModal(res, '批量导出结果', () => {
                this.btnBatchExport.innerText = '一键根据排序输出全部页面';
                this.btnBatchExport.disabled = false;
            });
        });
    }

    batchSaveOpenDocs() {
        if (this.pages.length === 0) {
            showToast('当前列表为空', 'error');
            return;
        }

        this.btnBatchSavePsd.innerText = '批量保存中...';
        this.btnBatchSavePsd.disabled = true;

        this.callHost('batchSaveAllDocs', [], (res) => {
            showAlertModal(res, '批量保存结果', () => {
                this.btnBatchSavePsd.innerText = '批量静默保存列表的所有 PSD';
                this.btnBatchSavePsd.disabled = false;
            });
        });
    }

    handleImportedFiles(filePaths) {
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
        const sortedPaths = [...filePaths].sort((a, b) => collator.compare(this.getFileName(a), this.getFileName(b)));

        sortedPaths.forEach(path => {
            if (this.pages.some(page => page.path === path)) return;
            this.pages.push({
                path,
                name: this.getFileName(path),
                status: 'untouched'
            });
        });

        this.renderThumbnails();
        this.syncSelectionSummary();
        this.scheduleSaveProjectState();
        this.syncPagesToHost();
    }

    syncPagesToHost() {
        this.callHost('receiveImportedPages', [JSON.stringify(this.pages)]);
    }

    renderThumbnails() {
        if (!this.thumbnailContainer) return;

        this.thumbnailContainer.innerHTML = '';
        if (this.pages.length === 0) {
            this.thumbnailContainer.innerHTML = '<div class="placeholder">暂无页面，请点击上方导入</div>';
            this.updatePageSummary(0, 0, 0);
            return;
        }

        const filterVal = this.selStateFilter ? this.selStateFilter.value : 'all';
        let renderedCount = 0;

        this.pages.forEach((page, index) => {
            if (filterVal !== 'all' && page.status !== filterVal) return;
            renderedCount += 1;

            const item = document.createElement('div');
            item.className = 'page-item';
            item.draggable = true;
            item.dataset.index = index;
            if (this.activePageIndex === index) item.classList.add('active');

            const statusDot = document.createElement('div');
            statusDot.className = `page-status-dot status-${page.status}`;
            statusDot.title = `当前状态：${this.getStatusLabel(page.status)}。右键可修改状态`;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'page-checkbox';
            checkbox.value = page.path;
            checkbox.title = '选中该页';
            checkbox.addEventListener('click', (event) => {
                event.stopPropagation();
                this.syncSelectionSummary();
            });

            const imageWrapper = document.createElement('div');
            imageWrapper.className = 'page-img-wrapper';
            imageWrapper.title = page.name;

            const image = document.createElement('img');
            image.src = `file:///${page.path.replace(/\\/g, '/')}`;
            image.alt = page.name;
            image.loading = 'lazy';
            imageWrapper.appendChild(image);

            const nameNode = document.createElement('div');
            nameNode.className = 'page-name';
            nameNode.textContent = page.name;

            item.appendChild(statusDot);
            item.appendChild(checkbox);
            item.appendChild(imageWrapper);
            item.appendChild(nameNode);

            item.addEventListener('click', () => this.activatePage(index));
            item.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                this.cyclePageStatus(index);
            });
            item.addEventListener('dragstart', (event) => this.handleDragStart(event, index, item));
            item.addEventListener('dragend', () => this.handleDragEnd(item));
            item.addEventListener('dragover', (event) => this.handleDragOver(event, index, item));
            item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
            item.addEventListener('drop', (event) => this.handleDrop(event, index, item));

            this.thumbnailContainer.appendChild(item);
        });

        if (renderedCount === 0) {
            this.thumbnailContainer.innerHTML = '<div class="placeholder">当前筛选下没有页面</div>';
        }

        this.updatePageSummary(this.pages.length, renderedCount, this.getSelectedVisibleCount());
    }

    activatePage(index) {
        const page = this.pages[index];
        if (!page) return;

        document.querySelectorAll('.page-item').forEach(el => el.classList.remove('active'));
        this.activePageIndex = index;
        this.scheduleSaveProjectState();

        this.callHost('openOrSwitchDocument', [page.path], () => {
            this.syncCompareAfterDocumentSwitch();
            this.callHost('detectDocumentStatus', [], (statusRes) => {
                if (!statusRes || statusRes === 'none' || statusRes === 'untouched') return;

                const order = ['untouched', 'retouched', 'typeset', 'done'];
                const currentIdx = order.indexOf(this.pages[index].status);
                const newIdx = order.indexOf(statusRes);
                if (newIdx > currentIdx) {
                    this.pages[index].status = statusRes;
                    this.renderThumbnails();
                    this.scheduleSaveProjectState();
                }
                this.restoreActiveThumbnail(index);
            });
        });
    }

    cyclePageStatus(index) {
        const states = ['untouched', 'retouched', 'typeset', 'done'];
        const currentIdx = states.indexOf(this.pages[index].status);
        this.pages[index].status = states[(currentIdx + 1) % states.length];
        this.renderThumbnails();
        this.scheduleSaveProjectState();
        this.restoreActiveThumbnail(index);
    }

    handleDragStart(event, index, item) {
        this.draggedItemIndex = index;
        event.dataTransfer.effectAllowed = 'move';
        setTimeout(() => item.classList.add('dragging'), 0);
    }

    handleDragEnd(item) {
        this.draggedItemIndex = null;
        item.classList.remove('dragging');
        document.querySelectorAll('.page-item').forEach(el => el.classList.remove('drag-over'));
    }

    handleDragOver(event, index, item) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        if (this.draggedItemIndex !== null && this.draggedItemIndex !== index) {
            item.classList.add('drag-over');
        }
    }

    handleDrop(event, index, item) {
        event.preventDefault();
        item.classList.remove('drag-over');
        if (this.draggedItemIndex === null || this.draggedItemIndex === index) return;

        const draggedData = this.pages.splice(this.draggedItemIndex, 1)[0];
        this.pages.splice(index, 0, draggedData);

        if (this.activePageIndex === this.draggedItemIndex) {
            this.activePageIndex = index;
        } else if (this.activePageIndex > -1 && this.draggedItemIndex < this.activePageIndex && index >= this.activePageIndex) {
            this.activePageIndex -= 1;
        } else if (this.activePageIndex > -1 && this.draggedItemIndex > this.activePageIndex && index <= this.activePageIndex) {
            this.activePageIndex += 1;
        }

        this.renderThumbnails();
        this.scheduleSaveProjectState();
    }

    restoreActiveThumbnail(index, scrollIntoView) {
        const items = this.thumbnailContainer ? this.thumbnailContainer.querySelectorAll('.page-item') : [];
        items.forEach(el => {
            if (parseInt(el.dataset.index, 10) === index) {
                el.classList.add('active');
                if (scrollIntoView) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        });
    }

    updatePageSummary(totalCount, visibleCount, selectedCount) {
        if (!this.pageSummary) return;
        const visiblePart = visibleCount === totalCount ? '' : ` · 可见 ${visibleCount}`;
        const selectedPart = selectedCount > 0 ? ` · 已选 ${selectedCount}` : '';
        this.pageSummary.textContent = `共 ${totalCount} 页${visiblePart}${selectedPart}`;
    }

    getSelectedVisibleCount() {
        if (!this.thumbnailContainer) return 0;
        return this.thumbnailContainer.querySelectorAll('.page-checkbox:checked').length;
    }

    syncSelectionSummary() {
        const visibleCount = this.thumbnailContainer
            ? this.thumbnailContainer.querySelectorAll('.page-item').length
            : 0;
        this.updatePageSummary(this.pages.length, visibleCount, this.getSelectedVisibleCount());
    }

    toggleVisibleSelection(checked) {
        if (!this.thumbnailContainer) return;

        const boxes = this.thumbnailContainer.querySelectorAll('.page-checkbox');
        if (boxes.length === 0) {
            showToast('当前没有可操作的页面', 'error');
            this.updatePageSummary(0, 0, 0);
            return;
        }

        boxes.forEach(box => {
            box.checked = checked;
        });
        this.syncSelectionSummary();
    }

    getFileName(path) {
        return String(path).split('\\').pop().split('/').pop();
    }

    getStatusLabel(status) {
        return {
            untouched: '未处理',
            retouched: '已修图',
            typeset: '已嵌字',
            done: '已完成'
        }[status] || status;
    }
}
