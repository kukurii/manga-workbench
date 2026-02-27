// typeset.js - 嵌字与翻译文稿管理

class TypesetManager {
    constructor(csInterface, extPath, dataDir) {
        this.cs = csInterface;
        this.extPath = extPath;
        this.dataDir = dataDir; // 持久化数据目录
        this.parsedData = []; // [{ pageName: '001.jpg', pageNum: 1, dialogs: [{id: 1, text: 'xxx'}, ...] }]
        this.currentPageIndex = 0;

        this.initDOM();
        this.bindEvents();
    }

    initDOM() {
        // 取消旧的 Tab 切换控制 variables

        // 第一区：导入与生成
        this.btnImportTxt = document.getElementById('btn-import-txt');
        this.btnCopyAIPrompt = document.getElementById('btn-copy-ai-prompt');
        this.btnParseTxt = document.getElementById('btn-parse-txt');
        this.btnAutoTypeset = document.getElementById('btn-auto-typeset');
        this.txtSource = document.getElementById('txt-source');
        this.selPageList = document.getElementById('sel-page-list');
        this.sharedList = document.getElementById('typeset-shared-list');
        this.uiArea = document.getElementById('typeset-ui-area');
        this.dialogList = document.getElementById('dialog-list');

        this.selFontFamily = document.getElementById('sel-font-family');
        this.selTextDirection = document.getElementById('sel-text-direction');
        this.inputFontSize = document.getElementById('input-font-size');
        this.selTypesetPreset = document.getElementById('sel-typeset-preset');

        this.stylePresets = []; // 本地缓存从样式面板同步过来的预设数据

        // 第二区：修正控制与双向同步
        this.btnFixPunctuation = document.getElementById('btn-fix-punctuation');
        this.btnFixDash = document.getElementById('btn-fix-dash');
        this.btnFixBangQuestion = document.getElementById('btn-fix-bang-question');

        this.btnSyncRead = document.getElementById('btn-sync-read-layer');
        this.btnSyncReadAll = document.getElementById('btn-sync-read-all');
        this.btnSyncWrite = document.getElementById('btn-sync-write-layer');
        this.btnAutoBreak = document.getElementById('btn-auto-break-text');
        this.inputSyncText = document.getElementById('input-sync-text');
        this.selSyncFont = document.getElementById('sel-sync-font');
        this.inputSyncSize = document.getElementById('input-sync-size');
        this.inputSyncLeading = document.getElementById('input-sync-leading');
        // 颜色由自定义颜色选择器管理，无需 DOM 引用
        this.inputAutoBreakNum = document.getElementById('input-auto-break-num');

        // 字体加载统一由 fontTool.js 接管
        this.loadStylePresets();
    }

    loadStylePresets() {
        if (!this.selTypesetPreset) return;
        const path = this.dataDir + "/style_presets.json";
        const readResult = window.cep.fs.readFile(path);

        let presets = [];
        if (readResult.err === window.cep.fs.NO_ERROR && readResult.data) {
            try {
                presets = JSON.parse(readResult.data);
            } catch (e) { }
        }

        this.stylePresets = presets;

        // 渲染下拉
        this.selTypesetPreset.innerHTML = '<option value="">（选择参数后自动覆盖下方配置）</option>';
        presets.forEach((p, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = `[预设] ${p.name || '未命名'}`;
            this.selTypesetPreset.appendChild(opt);
        });
    }

    bindEvents() {
        // ── 折叠面板通用逻辑 ──
        document.querySelectorAll('.collapse-header').forEach(header => {
            header.addEventListener('click', () => {
                const section = header.closest('.collapse-section');
                const bodyId = header.dataset.toggle;
                const body = document.getElementById(bodyId);
                const arrow = header.querySelector('.collapse-arrow');

                const isOpen = section.classList.toggle('open');
                body.style.display = isOpen ? 'block' : 'none';
                arrow.textContent = isOpen ? '▼' : '▶';
            });
        });

        if (this.btnImportTxt) {
            this.btnImportTxt.addEventListener('click', () => {
                const result = window.cep.fs.showOpenDialog(
                    false, false,
                    "请选择TXT翻译文稿",
                    "",
                    ["txt"]
                );

                if (result.err === window.cep.fs.NO_ERROR && result.data.length > 0) {
                    const filePath = result.data[0];
                    const readResult = window.cep.fs.readFile(filePath);
                    if (readResult.err === window.cep.fs.NO_ERROR) {
                        this.txtSource.value = readResult.data;
                        this.parseText(readResult.data);
                    } else {
                        showToast("读取文件失败");
                    }
                }
            });
        }

        if (this.btnParseTxt) {
            this.btnParseTxt.addEventListener('click', () => {
                if (!this.txtSource.value.trim()) {
                    showToast('文稿内容为空，请先粘贴或导入…', 'error');
                    return;
                }
                this.parseText(this.txtSource.value);
            });
        }

        // 复制 AI 提示词到剪贴…
        if (this.btnCopyAIPrompt) {
            this.btnCopyAIPrompt.addEventListener('click', () => {
                const promptTemplate = `请帮我翻译以下漫画页面。为了方便我直接导入工作流，请务必严格按照以下格式输出每页的翻译结果：

=== 第 1 页: 001.jpg ===
[1] 这里是第一页第一句对白的翻译
[2] 这里是第二句对白的翻译
还可以自由换行
[3] 第三句对白

=== 第 2 页: 002.jpg ===
[1] 第二页的第一句话
...以此类推，请保持原有的序号和空行结构。`;

                // 使用兜底方案将文本写入剪贴板
                const ta = document.createElement('textarea');
                ta.value = promptTemplate;
                document.body.appendChild(ta);
                ta.select();
                try {
                    document.execCommand('copy');
                    showToast('…AI 翻译格式要求已复制到剪贴板！', 'success');
                } catch (e) {
                    showToast('复制失败，请手动复制', 'error');
                }
                document.body.removeChild(ta);
            });
        }

        // --- 预设覆盖联动 --- 
        if (this.selTypesetPreset) {
            // 当鼠标移入选框时动态刷新文件内容，以防在另一个面板刚建好预设
            this.selTypesetPreset.addEventListener('mouseenter', () => {
                this.loadStylePresets();
            });
            this.selTypesetPreset.addEventListener('focus', () => {
                this.loadStylePresets();
            });

            this.selTypesetPreset.addEventListener('change', (e) => {
                const idx = e.target.value;
                if (idx === "") return;
                const preset = this.stylePresets[idx];
                if (preset) {
                    let fontFound = false;
                    // 覆写通用字体
                    if (this.selFontFamily && preset.fontPostScriptName) {
                        // 检查字体是否存在于下拉列表…
                        for (let i = 0; i < this.selFontFamily.options.length; i++) {
                            if (this.selFontFamily.options[i].value === preset.fontPostScriptName) {
                                this.selFontFamily.selectedIndex = i;
                                fontFound = true;
                                break;
                            }
                        }
                        if (!fontFound) {
                            showToast(`预设字体 "${preset.fontName || preset.fontPostScriptName}" 在当前字体列表中未找到，请检查字体是否已安装。`);
                        }
                    }
                    // 覆写字号
                    if (this.inputFontSize && preset.fontSize) {
                        this.inputFontSize.value = preset.fontSize;
                    }
                }
            });
        }

        if (this.selPageList) {
            this.selPageList.addEventListener('change', (e) => {
                this.currentPageIndex = e.target.selectedIndex;
                this.renderDialogList();
            });
        }

        if (this.btnAutoTypeset) {
            this.btnAutoTypeset.addEventListener('click', () => {
                if (this.parsedData.length === 0) return;
                const pageData = this.parsedData[this.currentPageIndex];
                if (!pageData || pageData.dialogs.length === 0) {
                    showToast("当前页没有可生成的对…");
                    return;
                }

                this.btnAutoTypeset.innerText = "生成…..";
                this.btnAutoTypeset.style.opacity = "0.7";

                const safeJson = JSON.stringify(pageData.dialogs);

                // 收集用户选择的样式与排版配置
                const styleParams = {
                    fontPostScriptName: this.selFontFamily ? this.selFontFamily.value : "",
                    fontSize: this.inputFontSize ? this.inputFontSize.value : "16",
                    direction: this.selTextDirection ? this.selTextDirection.value : "VERTICAL"
                };
                const styleJson = JSON.stringify(styleParams);

                // 调用 JSX 进行图层批量生成，并传入样式配置
                this.cs.evalScript(`generateTextLayersBulk(${JSON.stringify(safeJson)}, ${JSON.stringify(styleJson)})`, (res) => {
                    showToast(res);
                    this.btnAutoTypeset.innerText = "批量生成文本图层";
                    this.btnAutoTypeset.style.opacity = "1";
                });
            });
        }

        // 框选气……创建文本…
        const btnCreateFromSel = document.getElementById('btn-create-from-selection');
        if (btnCreateFromSel) {
            btnCreateFromSel.addEventListener('click', () => {
                const textVal = (document.getElementById('input-selection-text') || {}).value || '';
                const font = this.selFontFamily ? this.selFontFamily.value : '';
                const size = this.inputFontSize ? this.inputFontSize.value : '16';
                const dir = this.selTextDirection ? this.selTextDirection.value : 'VERTICAL';

                const safeText = JSON.stringify(textVal);
                const safeFont = JSON.stringify(font);
                const safeSize = JSON.stringify(size);
                const safeDir = JSON.stringify(dir);

                btnCreateFromSel.textContent = '创建中…';
                btnCreateFromSel.disabled = true;

                this.cs.evalScript(
                    `createTextLayerInSelection(${safeText}, ${safeFont}, ${safeSize}, ${safeDir})`,
                    (res) => {
                        btnCreateFromSel.textContent = '🔲 框选气……创建文本…';
                        btnCreateFromSel.disabled = false;
                        if (res && res !== 'SUCCESS') {
                            showToast(res);
                        }
                    }
                );
            });
        }

        // 修正文本标点规范
        if (this.btnFixPunctuation) {
            this.btnFixPunctuation.addEventListener('click', () => {
                this.cs.evalScript(`fixPunctuationStyle()`, (res) => {
                    if (res && res.indexOf("错误") > -1) showToast(res);
                });
            });
        }

        // 缝合破折…
        if (this.btnFixDash) {
            this.btnFixDash.addEventListener('click', () => {
                this.cs.evalScript(`fixDashKerning()`, (res) => {
                    if (res && res.indexOf("错误") > -1) showToast(res);
                });
            });
        }

        // 处理感叹问号 (!?) 形态转…(替换为自带立排的单字 Unicode)
        if (this.btnFixBangQuestion) {
            this.btnFixBangQuestion.addEventListener('click', () => {
                this.cs.evalScript(`fixBangQuestion()`, (res) => {
                    if (res && res.indexOf("错误") > -1) showToast(res);
                });
            });
        }

        // --- 中间态双向绑定事…---
        // --- 属性双向联动引…---
        if (this.btnSyncRead) {
            this.btnSyncRead.addEventListener('click', () => {
                this.cs.evalScript(`readActiveLayerProperties()`, (res) => {
                    this.populateSyncUI(res, true);
                });
            });
        }

        if (this.btnSyncReadAll) {
            this.btnSyncReadAll.addEventListener('click', () => {
                this.cs.evalScript(`exportAllTextLayersToTXT()`, (res) => {
                    if (res && res.indexOf("错误") > -1) {
                        showToast(res);
                    } else if (res && res.startsWith("EXPORT_TXT_SUCCESS|||")) {
                        // 剥离头部标识，将内容反填回翻译文本框
                        const outputTxt = res.replace("EXPORT_TXT_SUCCESS|||", "");
                        this.txtSource.value = outputTxt;

                        // 直接强行执行一次解析并弹窗提示
                        this.parseText(outputTxt);
                        showToast("提取成功！已将画板内的所有文字反推至源文稿列表中…");
                    }
                });
            });
        }

        if (this.btnSyncWrite) {
            this.btnSyncWrite.addEventListener('click', () => {
                const params = {
                    text: this.inputSyncText.value.replace(/\n/g, '\r')
                };

                if (this.selSyncFont && this.selSyncFont.value) params.font = this.selSyncFont.value;
                if (this.inputSyncSize && this.inputSyncSize.value) params.size = this.inputSyncSize.value;
                if (this.inputSyncLeading && this.inputSyncLeading.value) params.leading = this.inputSyncLeading.value;
                // 读取自定义颜色选择器的…
                const syncColor = window.getPickerColor ? window.getPickerColor('sync-color') : '#000000';
                if (syncColor) params.color = syncColor;

                const safeJson = JSON.stringify(params);
                const escapedForJSX = safeJson.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                this.cs.evalScript(`applyActiveLayerProperties('${escapedForJSX}')`, (res) => {
                    if (res && res.indexOf("错误") > -1) showToast(res);
                });
            });
        }

        if (this.inputSyncText) {
            // 失去焦点时不再自动同步所有属性，以防误改字体字号…
            // 仅对单纯的文本失去焦点不再进行隐式写入，让用户明确点击[应用属性]
        }

        if (this.btnAutoBreak) {
            this.btnAutoBreak.addEventListener('click', () => {
                const rawText = this.inputSyncText.value;
                if (!rawText) return;
                const limit = parseInt(this.inputAutoBreakNum.value, 10);
                if (isNaN(limit) || limit < 2) return showToast('无效字数约束');

                // 去除可能已有的换行符，变成单行纯文字再重新气泡断…
                const flatText = rawText.replace(/\r?\n/g, '');
                let resultText = '';
                for (let i = 0; i < flatText.length; i += limit) {
                    resultText += flatText.substring(i, i + limit) + '\n';
                }

                // 去掉最后多出来的回…
                this.inputSyncText.value = resultText.trim();

                // 顺手写入画布（使…applyActiveLayerProperties，与"应用属…按钮保持一致）
                const params = { text: this.inputSyncText.value.replace(/\n/g, '\r') };
                const safeJson = JSON.stringify(params);
                const escapedForJSX = safeJson.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                this.cs.evalScript(`applyActiveLayerProperties('${escapedForJSX}')`, (res) => {
                    if (res && res.indexOf("错误") > -1) console.warn(res);
                });
            });
        }
    }

    parseText(rawText) {
        // 支持 \r\n …\n
        const lines = rawText.split(/\r?\n/);
        let ObjectPages = [];
        let currentPage = null;
        let currentDialog = null;

        // 匹配页码分隔…=== …1 … 001.jpg ===
        const pageRegex = /^===\s*第\s*(\d+)\s*…\s*(.*?)\s*===$/;
        // 匹配对话编号…[1] 为什么，赛…
        const dialogRegex = /^\[(\d+)\]\s*(.*)$/;

        lines.forEach(line => {
            let trimmed = line.trim();
            if (!trimmed) return;

            let pageMatch = trimmed.match(pageRegex);
            if (pageMatch) {
                currentPage = {
                    pageNum: pageMatch[1],
                    pageName: pageMatch[2] || `Page ${pageMatch[1]}`,
                    dialogs: []
                };
                ObjectPages.push(currentPage);
                currentDialog = null;
                return;
            }

            let dialogMatch = trimmed.match(dialogRegex);
            if (dialogMatch) {
                currentDialog = {
                    id: dialogMatch[1],
                    text: dialogMatch[2]
                };
                if (!currentPage) {
                    // 若无页码头，强制创建一个默认的
                    currentPage = { pageNum: "1", pageName: "未分配页", dialogs: [] };
                    ObjectPages.push(currentPage);
                }
                currentPage.dialogs.push(currentDialog);
                return;
            }

            // 若无命中正则且已有正在记录的对话，则认为是多行对话的延伸内容
            if (currentDialog) {
                // Photoshop JSX 中的文本换行符通常使用 \r
                currentDialog.text += '\r' + trimmed;
            }
        });

        if (ObjectPages.length === 0) {
            showToast("未能根据格式解析出正确的页面及对白，请检查格式！", 'error');
            return;
        }

        // --- Diff (版本比对) 引擎 ---
        // 留存快照，以便于比较是否有小幅度修改
        if (this.parsedData) {
            this.lastParsedData = JSON.parse(JSON.stringify(this.parsedData));
        }

        // 核心：若有历史数据，则比对当前页下的所…Dialog，不一样的打上 changed 标签
        if (this.lastParsedData) {
            ObjectPages.forEach((newPage) => {
                let oldPage = this.lastParsedData.find(p => p.pageNum === newPage.pageNum);
                if (oldPage) {
                    newPage.dialogs.forEach((newDiag) => {
                        let oldDiag = oldPage.dialogs.find(d => d.id === newDiag.id);
                        if (oldDiag && oldDiag.text !== newDiag.text) {
                            newDiag.isChanged = true; // 挂载被修改过的高亮标…
                        }
                    });
                }
            });
        }

        this.parsedData = ObjectPages;
        this.currentPageIndex = 0;

        this.uiArea.style.display = "block";
        if (this.sharedList) this.sharedList.style.display = "block";
        this.renderPageSelector();
    }

    renderPageSelector() {
        this.selPageList.innerHTML = '';
        this.parsedData.forEach((page, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.innerText = `第 ${page.pageNum} 页: ${page.pageName}`;
            this.selPageList.appendChild(opt);
        });

        this.selPageList.selectedIndex = 0;
        this.renderDialogList();
    }

    renderDialogList() {
        this.dialogList.innerHTML = '';
        const page = this.parsedData[this.currentPageIndex];

        if (!page || page.dialogs.length === 0) {
            this.dialogList.innerHTML = '<div class="placeholder">本页无对白数…/div>';
            return;
        }

        page.dialogs.forEach(diag => {
            const row = document.createElement('div');
            // 如果比对出了变更，则注入高亮 class
            row.className = diag.isChanged ? 'dialog-row changed' : 'dialog-row';

            // 将内部的 \r 转回 <br> 用于前端显示
            const displayStr = diag.text.replace(/\r/g, '<br>');

            row.innerHTML = `
                <div class="dialog-id">[${diag.id}]</div>
                <div class="dialog-text">${displayStr}</div>
                ${diag.isChanged ? '<div class="dialog-badge">已修改</div>' : ''}
            `;

            // 为每句对白绑定点击事件：点击后通知 PS 选中对应的文本图…
            row.addEventListener('click', () => {
                // UI 高亮排他
                const allRows = this.dialogList.querySelectorAll('.dialog-row');
                allRows.forEach(r => r.classList.remove('active-row'));
                row.classList.add('active-row');

                // 调用 JSX 接口，按…ID 精准定位图层 
                this.cs.evalScript(`locateTextLayer("${diag.id}")`, (res) => {
                    if (res && res.indexOf("错误") > -1) {
                        // 找不到图层静默处理或不弹扰人窗，仅在控制台告…
                        console.warn(res);
                    } else {
                        // 定位成功后，顺便读取该图层的全套属性充填到“修改与修正”的排版盘中
                        this.cs.evalScript(`readActiveLayerProperties()`, (propRes) => {
                            this.populateSyncUI(propRes, false);
                        });
                    }
                });
            });

            this.dialogList.appendChild(row);
        });
    }

    /**
     * 从 JSX 传回的多维图层属性 JSON 解析并填充到右侧“修改与修正”的各个控件中
     * @param {string} res 
     * @param {boolean} showErr 是否通过弹窗强制打断报错
     */
    populateSyncUI(res, showErr = false) {
        if (!res) return;
        if (res.indexOf("错误") > -1) {
            if (showErr) showToast(res);
            else console.warn(res);
            return;
        }

        if (res.startsWith("SUCCESS|||")) {
            try {
                const jsonStr = res.replace("SUCCESS|||", "");
                const data = JSON.parse(jsonStr);

                if (this.inputSyncText) {
                    this.inputSyncText.value = data.text ? data.text.replace(/\r/g, '\n') : "";
                }

                if (this.selSyncFont) {
                    // 如果下拉框还没有选项，从全局主板拷贝
                    if (this.selSyncFont.options.length <= 1 && this.selFontFamily) {
                        this.selSyncFont.innerHTML = this.selFontFamily.innerHTML;
                    }
                    if (data.font) {
                        this.selSyncFont.value = data.font;
                    } else {
                        this.selSyncFont.selectedIndex = 0;
                    }
                }

                if (this.inputSyncSize) {
                    this.inputSyncSize.value = data.size || "";
                }

                if (this.inputSyncLeading) {
                    // 空代表 PS 是自动行距(AutoLeading=true)
                    this.inputSyncLeading.value = data.leading || "";
                }

                if (this.inputSyncColor && data.color) {
                    // 回填颜色到自定义颜色选择器
                    if (window.setPickerColor) window.setPickerColor('sync-color', data.color);
                }
            } catch (e) {
                console.error("解析图层属性拉取失败", e);
            }
        }
    }
}
