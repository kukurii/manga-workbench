// typeset.js - 嵌字与翻译文稿管理

class TypesetManager {
    constructor(csInterface, extPath) {
        this.cs = csInterface;
        this.extPath = extPath;
        this.parsedData = []; // [{ pageName: '001.jpg', pageNum: 1, dialogs: [{id: 1, text: 'xxx'}, ...] }]
        this.currentPageIndex = 0;

        this.initDOM();
        this.bindEvents();
    }

    initDOM() {
        // Tab 切换控制
        this.modeBtns = document.getElementById('typeset-mode-tabs');
        this.importTools = document.getElementById('typeset-import-tools');
        this.correctTools = document.getElementById('typeset-correct-tools');

        // 第一区：导入与生成
        this.btnImportTxt = document.getElementById('btn-import-txt');
        this.btnCopyAIPrompt = document.getElementById('btn-copy-ai-prompt');
        this.btnParseTxt = document.getElementById('btn-parse-txt');
        this.btnAutoTypeset = document.getElementById('btn-auto-typeset');
        this.txtSource = document.getElementById('txt-source');
        this.selPageList = document.getElementById('sel-page-list');
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
        this.btnSyncWrite = document.getElementById('btn-sync-write-layer');
        this.btnAutoBreak = document.getElementById('btn-auto-break-text');
        this.inputSyncText = document.getElementById('input-sync-text');
        this.inputAutoBreakNum = document.getElementById('input-auto-break-num');

        // 字体加载统一由 fontTool.js 接管
        this.loadStylePresets();
    }

    loadStylePresets() {
        if (!this.selTypesetPreset) return;
        const path = this.extPath + "/data/style_presets.json";
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

    loadSystemFonts() {
        // 已废弃。该逻辑移动至 fontTool.js 的 loadFonts 统一处理缓存。
    }

    bindEvents() {
        // 二级导航标签模式切换
        if (this.modeBtns) {
            this.modeBtns.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON') return;

                // 移除所有激活状态
                Array.from(this.modeBtns.children).forEach(btn => btn.classList.remove('active'));

                // 添加当前点击的按钮为激活
                e.target.classList.add('active');

                const targetMode = e.target.getAttribute('data-mode');

                if (targetMode === 'import') {
                    if (this.importTools) this.importTools.style.display = 'block';
                    if (this.correctTools) this.correctTools.style.display = 'none';
                } else if (targetMode === 'correct') {
                    if (this.importTools) this.importTools.style.display = 'none';
                    if (this.correctTools) this.correctTools.style.display = 'block';
                }
            });
        }

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
                        alert("读取文件失败");
                    }
                }
            });
        }

        if (this.btnParseTxt) {
            this.btnParseTxt.addEventListener('click', () => {
                if (!this.txtSource.value.trim()) {
                    alert("文稿内容为空，请先粘贴或导入。");
                    return;
                }
                this.parseText(this.txtSource.value);
            });
        }

        // 复制 AI 提示词到剪贴板
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
                    alert("✅ 已经将 AI 翻译格式要求复制到剪贴板！\n快去发给 AI 助手吧！");
                } catch (e) {
                    alert("复制失败，请手动选取复制以下内容：\n\n" + promptTemplate);
                }
                document.body.removeChild(ta);
            });
        }

        // 粘贴板由于 CEP 环境安全限制通常需前端 navigator.clipboard
        if (this.btnParseClip) {
            this.btnParseClip.addEventListener('click', async () => {
                try {
                    const text = await navigator.clipboard.readText();
                    this.txtSource.value = text;
                    this.parseText(text);
                } catch (e) {
                    alert("无法读取剪贴板，请手动粘贴到输入框内。\n(原因: " + e.message + ")");
                }
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
                    // 覆写通用字体
                    if (this.selFontFamily && preset.fontPostScriptName) {
                        this.selFontFamily.value = preset.fontPostScriptName;
                    }
                    // 覆写字号
                    if (this.inputFontSize && preset.fontSize) {
                        this.inputFontSize.value = preset.fontSize;
                    }

                    // 注: 别的详细参数(如行距) 在嵌字生成时并不适用。
                    // 嵌字主要决定初步图层生成，复杂的格式推荐通过样式面板赋予。
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
                    alert("当前页没有可生成的对白");
                    return;
                }

                this.btnAutoTypeset.innerText = "生成中...";
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
                    alert(res);
                    this.btnAutoTypeset.innerText = "批量生成文本图层";
                    this.btnAutoTypeset.style.opacity = "1";
                });
            });
        }

        // 修正文本标点规范
        if (this.btnFixPunctuation) {
            this.btnFixPunctuation.addEventListener('click', () => {
                this.cs.evalScript(`fixPunctuationStyle()`, (res) => {
                    if (res && res.indexOf("错误") > -1) alert(res);
                });
            });
        }

        // 缝合破折号
        if (this.btnFixDash) {
            this.btnFixDash.addEventListener('click', () => {
                this.cs.evalScript(`fixDashKerning()`, (res) => {
                    if (res && res.indexOf("错误") > -1) alert(res);
                });
            });
        }

        // 处理感叹问号 (!?) 形态转换 (替换为自带立排的单字 Unicode)
        if (this.btnFixBangQuestion) {
            this.btnFixBangQuestion.addEventListener('click', () => {
                this.cs.evalScript(`fixBangQuestion()`, (res) => {
                    if (res && res.indexOf("错误") > -1) alert(res);
                });
            });
        }

        // --- 中间态双向绑定事件 ---
        if (this.btnSyncRead) {
            this.btnSyncRead.addEventListener('click', () => {
                this.cs.evalScript(`readActiveLayerText()`, (res) => {
                    if (res && res.indexOf("错误") > -1) {
                        alert(res);
                    } else if (res) {
                        // 返回的内容可能带有 PS 特殊的回车符 \r，为了 html textarea 更好显示，全替换为 \n
                        this.inputSyncText.value = res.replace(/\r/g, '\n');
                    }
                });
            });
        }

        if (this.btnSyncWrite) {
            this.btnSyncWrite.addEventListener('click', () => {
                const text = this.inputSyncText.value;
                if (!text) return alert('请输入文本');
                // 传给 ExtendScript 之前把 \n 替换成 \r 
                const safeJson = JSON.stringify(text.replace(/\n/g, '\r'));
                this.cs.evalScript(`writeActiveLayerText(${safeJson})`, (res) => {
                    if (res && res.indexOf("错误") > -1) alert(res);
                });
            });
        }

        if (this.inputSyncText) {
            // 失去焦点时自动同步一次 (增强连贯体验)
            this.inputSyncText.addEventListener('blur', () => {
                const text = this.inputSyncText.value;
                if (!text) return;
                const safeJson = JSON.stringify(text.replace(/\n/g, '\r'));
                this.cs.evalScript(`writeActiveLayerText(${safeJson})`);
            });
        }

        if (this.btnAutoBreak) {
            this.btnAutoBreak.addEventListener('click', () => {
                const rawText = this.inputSyncText.value;
                if (!rawText) return;
                const limit = parseInt(this.inputAutoBreakNum.value, 10);
                if (isNaN(limit) || limit < 2) return alert('无效字数约束');

                // 去除可能已有的换行符，变成单行纯文字再重新气泡断行
                const flatText = rawText.replace(/\r?\n/g, '');
                let resultText = '';
                for (let i = 0; i < flatText.length; i += limit) {
                    resultText += flatText.substring(i, i + limit) + '\n';
                }

                // 去掉最后多出来的回车
                this.inputSyncText.value = resultText.trim();

                // 顺手写入画布
                const safeJson = JSON.stringify(this.inputSyncText.value.replace(/\n/g, '\r'));
                this.cs.evalScript(`writeActiveLayerText(${safeJson})`);
            });
        }
    }

    parseText(rawText) {
        // 支持 \r\n 或 \n
        const lines = rawText.split(/\r?\n/);
        let ObjectPages = [];
        let currentPage = null;
        let currentDialog = null;

        // 匹配页码分隔： === 第 1 页: 001.jpg ===
        const pageRegex = /^===\s*第\s*(\d+)\s*页:\s*(.*?)\s*===$/;
        // 匹配对话编号： [1] 为什么，赛。
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
                    currentPage = { pageNum: "1", pageName: "未分配页面", dialogs: [] };
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
            alert("未能根据格式解析出正确的页面及对白，请检查您的格式！\n如: === 第 x 页: name ===\n[1] 翻译内容");
            return;
        }

        this.parsedData = ObjectPages;
        this.currentPageIndex = 0;

        this.uiArea.style.display = "block";
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
            this.dialogList.innerHTML = '<div class="placeholder">本页无对白数据</div>';
            return;
        }

        page.dialogs.forEach(diag => {
            const row = document.createElement('div');
            row.className = 'dialog-row';

            // 将内部的 \r 转回 <br> 用于前端显示
            const displayStr = diag.text.replace(/\r/g, '<br>');

            row.innerHTML = `
                <div class="dialog-id">[${diag.id}]</div>
                <div class="dialog-text">${displayStr}</div>
            `;
            // 可选：添加点击按钮用于单句手动生成，当前先实现一键生成
            this.dialogList.appendChild(row);
        });
    }
}
