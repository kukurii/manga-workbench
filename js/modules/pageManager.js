// pageManager.js - 页面管理面板逻辑前端
class PageManager {
    constructor(csInterface, extPath, dataDir) {
        this.cs = csInterface;
        this.extPath = extPath;
        this.dataDir = dataDir || null;

        this.pages = []; // 存储导入的文件对象: {path,name,status}

        // ==== 项目持久化 ====
        this.projectStatePath = this.dataDir ? (this.dataDir + "/project_state.json") : null;
        this._saveTimer = null;

        this.initDOM();
        this.bindEvents();

        // 恢复上次项目（若存在）
        this.loadProjectState();
    }

    initDOM() {
        this.btnImport = document.getElementById('btn-import-pages');
        this.btnRemoveSel = document.getElementById('btn-remove-selected');
        this.btnClear = document.getElementById('btn-clear-pages');
        this.thumbnailContainer = document.getElementById('page-thumbnails');

        // ==== 状态与跑批设置 ====
        this.selStateFilter = document.getElementById('sel-page-state-filter');
        this.btnBatchRename = document.getElementById('btn-batch-rename');
        this.inputExportDir = document.getElementById('input-export-dir');
        this.btnSelExportDir = document.getElementById('btn-sel-export-dir');
        this.selExportFormat = document.getElementById('sel-export-format');
        this.btnBatchExport = document.getElementById('btn-batch-export');
        this.btnBatchSavePsd = document.getElementById('btn-batch-save-psd');

        // ==== 全局文档操作 ====
        this.btnSavePsd = document.getElementById('btn-save-psd');
        this.btnSavePsdCompare = document.getElementById('btn-save-psd-compare');

        // ==== 原图对比 ====
        this.btnToggleCompare = document.getElementById('btn-toggle-compare');
        this.compareOpacityRow = document.getElementById('compare-opacity-row');
        this.inputCompareOpacity = document.getElementById('input-compare-opacity');
        this.compareOpacityVal = document.getElementById('compare-opacity-val');
        this.compareGroupVisible = false;

        // ==== 工作流：下一页 ====
        this.btnNextPage = document.getElementById('btn-next-page');
        this.btnAutoDetectStatus = document.getElementById('btn-auto-detect-status');

        // ==== 弹窗元素 ====
        this.modalClearConfirm = document.getElementById('modal-clear-confirm');
        this.btnConfirmClear = document.getElementById('btn-confirm-clear');
        this.btnCancelClear = document.getElementById('btn-cancel-clear');

        // 当前激活的页面索引（与 pages 数组对应）
        this.activePageIndex = -1;
    }

    // -------------------- 项目持久化 --------------------

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
                pages: this.pages || [],
                activePageIndex: this.activePageIndex,
                stateFilter: this.selStateFilter ? this.selStateFilter.value : 'all',
                exportDir: this.inputExportDir ? this.inputExportDir.value : '',
                exportFormat: this.selExportFormat ? this.selExportFormat.value : 'jpg'
            };

            window.cep.fs.writeFile(this.projectStatePath, JSON.stringify(state, null, 2));
        } catch (e) {
            console.warn('[project state] save failed:', e);
        }
    }

    loadProjectState() {
        if (!this.projectStatePath) return;

        try {
            const readResult = window.cep.fs.readFile(this.projectStatePath);
            if (readResult.err !== window.cep.fs.NO_ERROR || !readResult.data) return;

            const parsed = JSON.parse(readResult.data);

            if (parsed && Array.isArray(parsed.pages)) {
                // 仅保留最核心字段，防止未来结构变更导致异常
                this.pages = parsed.pages
                    .filter(p => p && p.path)
                    .map(p => ({
                        path: p.path,
                        name: p.name || (String(p.path).split('\\').pop().split('/').pop()),
                        status: p.status || 'untouched'
                    }));

                // 恢复 UI 状态
                if (this.selStateFilter && parsed.stateFilter) this.selStateFilter.value = parsed.stateFilter;
                if (this.inputExportDir && parsed.exportDir) this.inputExportDir.value = parsed.exportDir;
                if (this.selExportFormat && parsed.exportFormat) this.selExportFormat.value = parsed.exportFormat;

                this.activePageIndex = typeof parsed.activePageIndex === 'number' ? parsed.activePageIndex : -1;

                this.renderThumbnails();

                // 重新激活高亮（如果该项在过滤后仍可见）
                if (this.activePageIndex >= 0) {
                    setTimeout(() => {
                        const items = this.thumbnailContainer ? this.thumbnailContainer.querySelectorAll('.page-item') : [];
                        items.forEach(el => {
                            if (parseInt(el.dataset.index) === this.activePageIndex) el.classList.add('active');
                        });
                    }, 50);
                }

                // 同步给 JSX 后端（可选）
                if (this.cs && typeof this.cs.evalScript === 'function') {
                    try {
                        this.cs.evalScript(`receiveImportedPages(${JSON.stringify(this.pages)})`);
                    } catch (e) { }
                }
            }
        } catch (e) {
            console.warn('[project state] load failed:', e);
        }
    }

    // -------------------- 事件绑定 --------------------

    bindEvents() {
        if (this.btnImport) {
            this.btnImport.addEventListener('click', () => {
                // 显示轻提示增强交互感
                const oldText = this.btnImport.innerText;
                this.btnImport.innerText = "正在唤起文件选择器...";
                this.btnImport.disabled = true;

                setTimeout(() => {
                    const result = window.cep.fs.showOpenDialog(
                        true, false,
                        "请选择要导入的漫画页面 (支持JPG/PNG/PSD等)",
                        "",
                        ["jpg", "jpeg", "png", "tiff", "psd"]
                    );

                    this.btnImport.innerText = oldText;
                    this.btnImport.disabled = false;

                    if (result.err === window.cep.fs.NO_ERROR && result.data.length > 0) {
                        this.handleImportedFiles(result.data);
                    }
                }, 100);
            });
        }

        if (this.btnRemoveSel) {
            this.btnRemoveSel.addEventListener('click', () => {
                const checkboxes = document.querySelectorAll('.page-checkbox:checked');
                if (checkboxes.length === 0) {
                    alert("请先在列表中勾选要移除的页面（点击图片右上角复选框）");
                    return;
                }
                const pathsToRemove = Array.from(checkboxes).map(cb => cb.value);
                this.pages = this.pages.filter(p => !pathsToRemove.includes(p.path));
                // 防止 active 指向非法
                if (this.activePageIndex >= this.pages.length) this.activePageIndex = this.pages.length - 1;
                this.renderThumbnails();
                this.scheduleSaveProjectState();
            });
        }

        if (this.btnClear) {
            this.btnClear.addEventListener('click', () => {
                if (this.modalClearConfirm) {
                    this.modalClearConfirm.classList.add('show');
                }
            });
        }

        if (this.btnConfirmClear) {
            this.btnConfirmClear.addEventListener('click', () => {
                this.pages = [];
                this.activePageIndex = -1;
                this.renderThumbnails();
                this.scheduleSaveProjectState();
                if (this.modalClearConfirm) this.modalClearConfirm.classList.remove('show');
            });
        }

        if (this.btnCancelClear) {
            this.btnCancelClear.addEventListener('click', () => {
                if (this.modalClearConfirm) this.modalClearConfirm.classList.remove('show');
            });
        }

        // ==== 页面流转与批处理 ====
        if (this.selStateFilter) {
            this.selStateFilter.addEventListener('change', () => {
                this.renderThumbnails();
                this.scheduleSaveProjectState();
            });
        }

        if (this.btnBatchRename) {
            this.btnBatchRename.addEventListener('click', () => {
                if (this.pages.length === 0) return alert("队列为空");
                const template = prompt(
                    "命名模板说明：\n" +
                    "  {prefix}  = 你输入的前缀文字\n" +
                    "  {n}       = 页码序号（从1开始，如 1、2、3…）\n" +
                    "  {nn}      = 两位页码（如 01、02…）\n" +
                    "  {name}    = 原始文件名（不含扩展名）\n\n" +
                    "示例：第06话_{nn}  →  第06话_01.jpg\n\n" +
                    "请输入命名模板：",
                    "第00话_{nn}"
                );
                if (!template) return;

                this.pages.forEach((p, idx) => {
                    // 提取原始名（不含扩展名）
                    const dotIdx = p.name.lastIndexOf('.');
                    const origBase = dotIdx > 0 ? p.name.substring(0, dotIdx) : p.name;
                    const origExt = dotIdx > 0 ? p.name.substring(dotIdx) : '';
                    const pageNum = idx + 1;
                    const nn = String(pageNum).padStart(2, '0');

                    const newBase = template
                        .replace(/\{prefix\}/g, '')
                        .replace(/\{nn\}/g, nn)
                        .replace(/\{n\}/g, String(pageNum))
                        .replace(/\{name\}/g, origBase);

                    p.name = newBase + origExt;
                });
                this.renderThumbnails();
                this.scheduleSaveProjectState();
            });
        }

        // 自动检测当前文档状态并同步到页面列表
        if (this.btnAutoDetectStatus) {
            this.btnAutoDetectStatus.addEventListener('click', () => {
                if (this.activePageIndex < 0) return alert("请先点击页面列表中的一个页面以激活它");
                this.cs.evalScript(`detectDocumentStatus()`, (res) => {
                    if (res && res !== 'none') {
                        this.pages[this.activePageIndex].status = res;
                        this.renderThumbnails();
                        this.scheduleSaveProjectState();
                        // 重新激活高亮
                        const items = this.thumbnailContainer.querySelectorAll('.page-item');
                        items.forEach(el => {
                            if (parseInt(el.dataset.index) === this.activePageIndex) {
                                el.classList.add('active');
                            }
                        });
                    }
                });
            });
        }

        // 下一页工作流：将当前页状态推进一级，并打开下一页
        if (this.btnNextPage) {
            this.btnNextPage.addEventListener('click', () => {
                if (this.pages.length === 0) return alert("页面列表为空");

                // 先将当前页状态推进到 typeset（若已是 done 则保持）
                if (this.activePageIndex >= 0) {
                    const cur = this.pages[this.activePageIndex];
                    if (cur.status === 'untouched') cur.status = 'retouched';
                    else if (cur.status === 'retouched') cur.status = 'typeset';
                    else if (cur.status === 'typeset') cur.status = 'done';
                    // done 保持不变
                }

                // 找到下一个未完成的页面
                let nextIdx = -1;
                for (let i = this.activePageIndex + 1; i < this.pages.length; i++) {
                    if (this.pages[i].status !== 'done') {
                        nextIdx = i;
                        break;
                    }
                }
                // 如果后面没有未完成页，从头找
                if (nextIdx < 0) {
                    for (let i = 0; i < this.pages.length; i++) {
                        if (this.pages[i].status !== 'done') {
                            nextIdx = i;
                            break;
                        }
                    }
                }

                this.renderThumbnails();
                this.scheduleSaveProjectState();

                if (nextIdx < 0) {
                    alert("🎉 全部页面均已完成！");
                    return;
                }

                // 打开下一页
                const nextPage = this.pages[nextIdx];
                this.activePageIndex = nextIdx;
                this.cs.evalScript(`openOrSwitchDocument("${nextPage.path.replace(/\\/g, '\\\\')}")`);

                // 高亮下一页
                setTimeout(() => {
                    const items = this.thumbnailContainer.querySelectorAll('.page-item');
                    items.forEach(el => {
                        el.classList.remove('active');
                        if (parseInt(el.dataset.index) === nextIdx) {
                            el.classList.add('active');
                            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                    });
                }, 100);

                this.scheduleSaveProjectState();
            });
        }

        if (this.btnSelExportDir) {
            this.btnSelExportDir.addEventListener('click', () => {
                const result = window.cep.fs.showOpenDialog(false, true, "选择批量导出保存的文件夹", "", []);
                if (result.err === window.cep.fs.NO_ERROR && result.data.length > 0) {
                    this.inputExportDir.value = result.data[0];
                    this.scheduleSaveProjectState();
                }
            });
        }

        if (this.selExportFormat) {
            this.selExportFormat.addEventListener('change', () => {
                this.scheduleSaveProjectState();
            });
        }

        if (this.btnBatchExport) {
            this.btnBatchExport.addEventListener('click', () => {
                if (this.pages.length === 0) return alert("当前列表为空，无图可导");

                const outDir = this.inputExportDir ? this.inputExportDir.value : '';
                if (!outDir) return alert("请先选择导出文件夹");

                const format = this.selExportFormat ? this.selExportFormat.value : 'jpg';

                this.btnBatchExport.innerText = "⏳ 跑批处理中，请勿操作...";
                this.btnBatchExport.disabled = true;

                const safeJson = JSON.stringify(this.pages);

                this.cs.evalScript(`batchExportAllPages(${JSON.stringify(safeJson)}, '${outDir.replace(/\\/g, '\\\\')}', '${format}')`, (res) => {
                    alert(res);
                    this.btnBatchExport.innerText = "🚀 一键根据排序输出全部页面";
                    this.btnBatchExport.disabled = false;
                });
            });
        }

        if (this.btnBatchSavePsd) {
            this.btnBatchSavePsd.addEventListener('click', () => {
                if (this.pages.length === 0) return alert("当前列表为空");

                this.btnBatchSavePsd.innerText = "⏳ 批量保存中...";
                this.btnBatchSavePsd.disabled = true;

                const safeJson = JSON.stringify(this.pages);
                this.cs.evalScript(`batchSaveAllDocs(${JSON.stringify(safeJson)})`, (res) => {
                    alert(res);
                    this.btnBatchSavePsd.innerText = "💾 批量静默保存列表的所有 PSD";
                    this.btnBatchSavePsd.disabled = false;
                });
            });
        }

        // --- 全局文档保存操作 ---
        if (this.btnSavePsd) {
            this.btnSavePsd.addEventListener('click', () => {
                this.cs.evalScript(`saveCurrentDocumentAsPsd(false)`, (res) => {
                    if (res && res.indexOf("错误") > -1) alert(res);
                });
            });
        }

        if (this.btnSavePsdCompare) {
            this.btnSavePsdCompare.addEventListener('click', () => {
                this.cs.evalScript(`saveCurrentDocumentAsPsd(true)`, (res) => {
                    if (res && res.indexOf("错误") > -1) alert(res);
                });
            });
        }

        // ==== 原图对比：开关 ====
        if (this.btnToggleCompare) {
            this.btnToggleCompare.addEventListener('click', () => {
                this.compareGroupVisible = !this.compareGroupVisible;

                if (this.compareGroupVisible) {
                    // 尝试显示原图参考组；若不存在，先调用 backupOriginalLayer 创建
                    this.cs.evalScript(
                        `(function(){
                            try {
                                if (app.documents.length === 0) return "错误：没有打开的文档";
                                var doc = app.activeDocument;
                                var found = false;
                                for (var i = 0; i < doc.layers.length; i++) {
                                    if (doc.layers[i].name === "【原图参考】") {
                                        doc.layers[i].visible = true;
                                        found = true;
                                        break;
                                    }
                                }
                                if (!found && typeof backupOriginalLayer === "function") {
                                    backupOriginalLayer();
                                }
                                return "SUCCESS";
                            } catch(e) { return e.toString(); }
                        })()`,
                        (res) => {
                            if (res && res.indexOf('错误') > -1) {
                                alert(res);
                                this.compareGroupVisible = false;
                                return;
                            }
                            if (this.btnToggleCompare) {
                                this.btnToggleCompare.innerText = '关闭原图对比';
                                this.btnToggleCompare.classList.add('active');
                            }
                            if (this.compareOpacityRow) this.compareOpacityRow.style.display = 'flex';
                        }
                    );
                } else {
                    // 隐藏原图参考组
                    this.cs.evalScript(
                        `(function(){
                            try {
                                if (app.documents.length === 0) return "SUCCESS";
                                var doc = app.activeDocument;
                                for (var i = 0; i < doc.layers.length; i++) {
                                    if (doc.layers[i].name === "【原图参考】") {
                                        doc.layers[i].visible = false;
                                        break;
                                    }
                                }
                                return "SUCCESS";
                            } catch(e) { return e.toString(); }
                        })()`,
                        () => {
                            if (this.btnToggleCompare) {
                                this.btnToggleCompare.innerText = '开启原图对比';
                                this.btnToggleCompare.classList.remove('active');
                            }
                            if (this.compareOpacityRow) this.compareOpacityRow.style.display = 'none';
                        }
                    );
                }
            });
        }

        // ==== 原图对比：透明度滑块 ====
        if (this.inputCompareOpacity) {
            this.inputCompareOpacity.addEventListener('input', () => {
                const val = parseInt(this.inputCompareOpacity.value, 10);
                if (this.compareOpacityVal) this.compareOpacityVal.innerText = val + '%';
                this.cs.evalScript(`setCompareGroupOpacity("【原图参考】", ${val})`, (res) => {
                    if (res && res.indexOf('错误') > -1) console.warn('[compare opacity]', res);
                });
            });
        }
    }

    handleImportedFiles(filePaths) {
        // 对文件路径按照字母/数字顺序进行自然排序，确保页码顺序正确
        const pCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
        const sortedPaths = filePaths.sort(pCollator.compare);

        // 记录状态对象 (简单去重合并)
        sortedPaths.forEach(path => {
            if (!this.pages.find(p => p.path === path)) {
                const fileName = path.split('\\').pop().split('/').pop();
                this.pages.push({
                    path: path,
                    name: fileName,
                    status: 'untouched' // untouched, retouched, typeset, done
                });
            }
        });

        this.renderThumbnails();
        this.scheduleSaveProjectState();

        // 通知 PS 后台
        this.cs.evalScript(`receiveImportedPages(${JSON.stringify(this.pages)})`);
    }

    renderThumbnails() {
        this.thumbnailContainer.innerHTML = '';
        if (this.pages.length === 0) {
            this.thumbnailContainer.innerHTML = '<div class="placeholder">暂无页面，请点击上方按钮导入</div>';
            return;
        }

        const filterVal = this.selStateFilter ? this.selStateFilter.value : 'all';

        this.pages.forEach((pageData, index) => {
            if (filterVal !== 'all' && pageData.status !== filterVal) {
                return; // 跳过不符合过滤条件的
            }

            const path = pageData.path;
            const fileName = pageData.name;
            const status = pageData.status;

            const item = document.createElement('div');
            item.className = 'page-item';
            item.draggable = true;
            item.dataset.index = index;

            if (this.activePageIndex === index) item.classList.add('active');

            // 根据状态渲染对应的圆点颜色类
            const statusClass = `status-${status}`;

            // 四个原生状态对于的文字映射，给气泡提示用
            const statusMap = {
                untouched: '未处理',
                retouched: '已去字',
                typeset: '已嵌字',
                done: '终审完结'
            };

            // 添加复选框、状态指示圆点以及无变形封存的图片内容
            item.innerHTML = `
                <div class="page-status-dot ${statusClass}" title="当前状态：${statusMap[status]}。右键可修改状态"></div>
                <input type="checkbox" class="page-checkbox" value="${path}" title="选取该页" />
                <div class="page-img-wrapper" title="${fileName}">
                    <img src="file:///${path.replace(/\\/g, '/')}" alt="${fileName}" loading="lazy"/>
                </div>
                <div class="page-name">${fileName}</div>
            `;

            // 阻止复选框冒泡
            const checkbox = item.querySelector('.page-checkbox');
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // 左键单击：PS激活文档，并自动检测文档状态
            item.addEventListener('click', () => {
                document.querySelectorAll('.page-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                this.activePageIndex = index;
                this.scheduleSaveProjectState();

                this.cs.evalScript(`openOrSwitchDocument("${path.replace(/\\/g, '\\\\')}")`, () => {
                    // 打开文档后自动检测状态
                    this.cs.evalScript(`detectDocumentStatus()`, (statusRes) => {
                        if (statusRes && statusRes !== 'none' && statusRes !== 'untouched') {
                            // 仅在检测到更高阶状态时才自动升级（不降级）
                            const order = ['untouched', 'retouched', 'typeset', 'done'];
                            const curIdx = order.indexOf(this.pages[index].status);
                            const newIdx = order.indexOf(statusRes);
                            if (newIdx > curIdx) {
                                this.pages[index].status = statusRes;
                                this.renderThumbnails();
                                this.scheduleSaveProjectState();
                                // 保持高亮
                                const allItems = this.thumbnailContainer.querySelectorAll('.page-item');
                                allItems.forEach(el => {
                                    if (parseInt(el.dataset.index) === index) el.classList.add('active');
                                });
                            }
                        }
                    });
                });
            });

            // 右键菜单：状态流转 (简便轮换)
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const states = ['untouched', 'retouched', 'typeset', 'done'];
                let nidx = states.indexOf(this.pages[index].status) + 1;
                if (nidx >= states.length) nidx = 0;
                this.pages[index].status = states[nidx];
                this.renderThumbnails();
                this.scheduleSaveProjectState();
            });

            // --- HTML5 原生拖拽 API ---
            item.addEventListener('dragstart', (e) => {
                this.draggedItemIndex = index;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => item.classList.add('dragging'), 0);
            });

            item.addEventListener('dragend', () => {
                this.draggedItemIndex = null;
                item.classList.remove('dragging');
                document.querySelectorAll('.page-item').forEach(el => el.classList.remove('drag-over'));
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                // 拖到另一张图片上方时给出虚线框高亮
                if (this.draggedItemIndex !== null && this.draggedItemIndex !== index) {
                    item.classList.add('drag-over');
                }
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                if (this.draggedItemIndex === null || this.draggedItemIndex === index) return;

                // 在数组里进行位置交换
                const draggedData = this.pages.splice(this.draggedItemIndex, 1)[0];
                this.pages.splice(index, 0, draggedData);

                // 调整 active 索引：如果拖拽涉及 active 项，修正指向
                if (this.activePageIndex === this.draggedItemIndex) {
                    this.activePageIndex = index;
                } else if (
                    this.activePageIndex > -1 &&
                    this.draggedItemIndex < this.activePageIndex &&
                    index >= this.activePageIndex
                ) {
                    // dragged 从 active 前面移到后面，active 左移一位
                    this.activePageIndex -= 1;
                } else if (
                    this.activePageIndex > -1 &&
                    this.draggedItemIndex > this.activePageIndex &&
                    index <= this.activePageIndex
                ) {
                    // dragged 从 active 后面移到前面，active 右移一位
                    this.activePageIndex += 1;
                }

                this.renderThumbnails();
                this.scheduleSaveProjectState();
            });

            this.thumbnailContainer.appendChild(item);
        });
    }
}
