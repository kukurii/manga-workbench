// pageManager.js - 页面管理面板逻辑前端
class PageManager {
    constructor(csInterface, extPath) {
        this.cs = csInterface;
        this.extPath = extPath;
        this.pages = []; // 存储导入的文件路径

        this.initDOM();
        this.bindEvents();
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
    }

    bindEvents() {
        if (this.btnImport) {
            this.btnImport.addEventListener('click', () => {
                const result = window.cep.fs.showOpenDialog(
                    true, false,
                    "请选择要导入的漫画页面 (支持JPG/PNG/PSD等)",
                    "",
                    ["jpg", "jpeg", "png", "tiff", "psd"]
                );

                if (result.err === window.cep.fs.NO_ERROR && result.data.length > 0) {
                    this.handleImportedFiles(result.data);
                }
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
                this.renderThumbnails();
            });
        }

        if (this.btnClear) {
            this.btnClear.addEventListener('click', () => {
                if (confirm("确定要清空所有已导入的页面列表吗？")) {
                    this.pages = [];
                    this.renderThumbnails();
                }
            });
        }

        // ==== 页面流转与批处理 ====
        if (this.selStateFilter) {
            this.selStateFilter.addEventListener('change', () => {
                this.renderThumbnails();
            });
        }

        if (this.btnBatchRename) {
            this.btnBatchRename.addEventListener('click', () => {
                if (this.pages.length === 0) return alert("队列为空");
                const prefix = prompt("请输入要批量添加给所有画板文件名的前缀\n如输入 [第06话]：", "第00话_");
                if (prefix) {
                    this.pages.forEach((p, idx) => {
                        // 防止多次叠加同一个前缀
                        if (!p.name.startsWith(prefix)) {
                            // 为了保持原文件扩展名格式，做简单的字符串拼接，实际重命名发生在导出阶段
                            p.name = prefix + p.name;
                        }
                    });
                    this.renderThumbnails();
                }
            });
        }

        if (this.btnSelExportDir) {
            this.btnSelExportDir.addEventListener('click', () => {
                const result = window.cep.fs.showOpenDialog(false, true, "选择批量导出保存的文件夹", "", []);
                if (result.err === window.cep.fs.NO_ERROR && result.data.length > 0) {
                    this.inputExportDir.value = result.data[0];
                }
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

                // 将现有的排好序的并且被重命名过的对象数组发送给ExtendScript处理
                // 为了避免 JSON 传递引号被截断，进行安全化包转
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

        // 可选：立即通知 PS 后台将这些文件全部打开或只打开第一页
        // 传递对象数组给 JSX 让其知道有哪些图
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

            // 左键单击：PS激活文档
            item.addEventListener('click', () => {
                document.querySelectorAll('.page-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                this.cs.evalScript(`openOrSwitchDocument("${path.replace(/\\/g, '\\\\')}")`);
            });

            // 右键菜单：状态流转 (简便轮换)
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const states = ['untouched', 'retouched', 'typeset', 'done'];
                let nidx = states.indexOf(this.pages[index].status) + 1;
                if (nidx >= states.length) nidx = 0;
                this.pages[index].status = states[nidx];
                this.renderThumbnails();
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

                this.renderThumbnails();
            });

            this.thumbnailContainer.appendChild(item);
        });
    }
}
