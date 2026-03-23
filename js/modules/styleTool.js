// styleTool.js - 排版段落预设库

class StyleManager {
    constructor(csInterface, extPath, dataDir) {
        this.cs = csInterface;
        this.extPath = extPath;
        this.dataDir = dataDir;
        this.presets = []; // [{ id, name, fontPostScriptName, fontName, size, leadingType, leadingValue, fauxBold }]
        this.initDOM();
        this.bindEvents();
        this.loadPresets();
    }

    initDOM() {
        this.presetsContainer = document.getElementById('style-presets-container');
        this.selFont = document.getElementById('sel-style-font');
        this.inputSize = document.getElementById('input-style-size');
        this.selLeadingType = document.getElementById('sel-style-leading-type');
        this.inputLeadingVal = document.getElementById('input-style-leading-val');
        this.labLeadingUnit = document.getElementById('lab-style-leading-unit');
        this.chkFauxBold = document.getElementById('chk-style-faux-bold'); // 仿粗体复选框

        this.btnApplyNow = document.getElementById('btn-apply-style-now');
        this.btnSavePreset = document.getElementById('btn-save-style-preset');
    }

    bindEvents() {
        if (this.selLeadingType) {
            this.selLeadingType.addEventListener('change', () => {
                if (this.selLeadingType.value === 'auto') {
                    this.labLeadingUnit.innerText = '%';
                    if (this.inputLeadingVal.value == '14' || this.inputLeadingVal.value == '') this.inputLeadingVal.value = 125;
                } else {
                    this.labLeadingUnit.innerText = 'pt';
                    // 如果原先填的很大的比率（比如125）则重置为正常固定间距
                    if (this.inputLeadingVal.value == '125' || this.inputLeadingVal.value == '') this.inputLeadingVal.value = 14;
                }
            });
        }

        if (this.btnApplyNow) {
            this.btnApplyNow.addEventListener('click', () => {
                this.applyStyle();
            });
        }

        if (this.btnSavePreset) {
            this.btnSavePreset.addEventListener('click', () => {
                showPromptModal("请为该段落预设起一个好记的名字 (如 对话-方正宋体-36pt):", "对话样式A", (name) => {
                    if (!name) return;

                    const size = parseFloat(this.inputSize.value);
                    const leadingValue = parseFloat(this.inputLeadingVal.value);
                    if (isNaN(size) || size <= 0) return showToast('璇疯緭鍏ユ湁鏁堢殑瀛楀彿');
                    if (isNaN(leadingValue) || leadingValue <= 0) return showToast('璇疯緭鍏ユ湁鏁堢殑琛岃窛');

                    const fontPostName = this.selFont.value;
                    const fontSelectObj = this.selFont.options[this.selFont.selectedIndex];
                    const fontName = fontSelectObj ? fontSelectObj.text : '';

                    const preset = {
                        id: Date.now().toString(),
                        name: name,
                        fontPostScriptName: fontPostName,
                        fontName: fontName,
                        size: size,
                        leadingType: this.selLeadingType.value,
                        leadingValue: leadingValue,
                        fauxBold: this.chkFauxBold ? this.chkFauxBold.checked : false // 仿粗体
                    };

                    this.presets.push(preset);
                    this.savePresets();
                    this.renderPresets();
                });
            });
        }
    }

    // 由 fontTool.js 回调，用来同步系统字体到此处的下拉菜单
    // getDisplayName: 可选回调 (f) => { primary, secondary, source }，由 FontManager 传入
    syncFonts(fontList, getDisplayName) {
        if (!this.selFont) return;
        this.selFont.innerHTML = '<option value="">(保持图层原字体不改变)</option>';
        fontList.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.postScriptName;
            if (getDisplayName) {
                const display = getDisplayName(f);
                opt.innerText = display.source !== 'fallback'
                    ? `${display.primary}（${f.name}）`
                    : f.name;
            } else {
                opt.innerText = f.name;
            }
            this.selFont.appendChild(opt);
        });
    }

    applyStyle(presetObj = null) {
        let fontPostName, size, leadingType, leadingValue, fauxBold;
        if (presetObj) {
            fontPostName = presetObj.fontPostScriptName || "";
            size = presetObj.size;
            leadingType = presetObj.leadingType;
            leadingValue = presetObj.leadingValue;
            fauxBold = presetObj.fauxBold === true;
            // 同步更新 UI 复选框状态（让用户看到当前预设里的仿粗体值）
            if (this.chkFauxBold) this.chkFauxBold.checked = fauxBold;
        } else {
            fontPostName = this.selFont.value || "";
            size = parseFloat(this.inputSize.value);
            leadingType = this.selLeadingType.value;
            leadingValue = parseFloat(this.inputLeadingVal.value);
            fauxBold = this.chkFauxBold ? this.chkFauxBold.checked : false;
        }

        if (isNaN(size) || size <= 0) return showToast('请输入有效的字号');
        if (isNaN(leadingValue) || leadingValue <= 0) return showToast('请输入有效的行距');

        // 发送到 ExtendScript，第5个参数为仿粗体开关（true/false）
        const safeFont = fontPostName ? fontPostName : '';
        this.cs.evalScript(`applyParagraphStyle('${safeFont}', ${size}, '${leadingType}', ${leadingValue}, ${fauxBold})`, (res) => {
            if (res && res.indexOf("错误") > -1) {
                showToast(res);
            }
        });
    }

    // JSON 预设文件化存储
    loadPresets() {
        const path = this.dataDir + "/style_presets.json";
        const readResult = window.cep.fs.readFile(path);
        if (readResult.err === window.cep.fs.NO_ERROR && readResult.data) {
            try {
                this.presets = JSON.parse(readResult.data);
            } catch (e) {
                this.presets = [];
            }
        }
        this.renderPresets();
    }

    savePresets() {
        const path = this.dataDir + "/style_presets.json";
        window.cep.fs.writeFile(path, JSON.stringify(this.presets));
    }

    renderPresets() {
        if (!this.presetsContainer) return;
        this.presetsContainer.innerHTML = '';

        if (this.presets.length === 0) {
            this.presetsContainer.innerHTML = '<div class="placeholder" style="padding:20px 0;">尚未创建任何预设。在下方配置好参数并保存即可在此一键调用！</div>';
            return;
        }

        // 拖拽状态
        let dragSrcIdx = -1;

        const clearDropIndicators = () => {
            this.presetsContainer.querySelectorAll('.preset-drag-over-before, .preset-drag-over-after')
                .forEach(el => el.classList.remove('preset-drag-over-before', 'preset-drag-over-after'));
        };

        this.presets.forEach((p, idx) => {
            const btn = document.createElement('div');
            btn.className = 'btn btn--secondary';
            btn.style.flex = '1 1 45%';
            btn.style.justifyContent = 'space-between';
            btn.title = `字体: ${p.fontName}\n字号: ${p.size}pt\n行距: ${p.leadingType === 'auto' ? '自动 ' + p.leadingValue + '%' : '固定 ' + p.leadingValue + 'pt'}\n仿粗体: ${p.fauxBold ? '开' : '关'}`;
            btn.dataset.idx = idx;
            btn.draggable = true;

            const nameSpan = document.createElement('span');
            nameSpan.innerText = p.name;
            nameSpan.className = 'flex-1';
            nameSpan.style.textAlign = 'left';

            const delSpan = document.createElement('span');
            delSpan.innerText = '×';
            delSpan.style.cursor = 'pointer';
            delSpan.style.marginLeft = '6px';
            delSpan.style.opacity = '0.5';
            delSpan.addEventListener('mouseenter', () => delSpan.style.opacity = '1');
            delSpan.addEventListener('mouseleave', () => delSpan.style.opacity = '0.5');

            btn.appendChild(nameSpan);
            btn.appendChild(delSpan);

            // ── 点击应用 / 删除 ──
            nameSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                this.applyStyle(p);
            });

            delSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                showConfirmModal('确定要彻底删除段落预设 ' + p.name + ' 吗？', () => {
                    this.presets.splice(idx, 1);
                    this.savePresets();
                    this.renderPresets();
                });
            });

            // ── 拖拽事件 ──
            btn.addEventListener('dragstart', (e) => {
                dragSrcIdx = idx;
                btn.classList.add('preset-dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', idx);
            });

            btn.addEventListener('dragend', () => {
                btn.classList.remove('preset-dragging');
                clearDropIndicators();
            });

            btn.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragSrcIdx === idx) return;
                clearDropIndicators();
                // 根据鼠标在卡片内的上/下半区决定插入线方向
                const rect = btn.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                if (e.clientY < midY) {
                    btn.classList.add('preset-drag-over-before');
                } else {
                    btn.classList.add('preset-drag-over-after');
                }
            });

            btn.addEventListener('dragleave', (e) => {
                // 仅当鼠标真正离开该元素（不是移到子元素）时才清除
                if (!btn.contains(e.relatedTarget)) {
                    btn.classList.remove('preset-drag-over-before', 'preset-drag-over-after');
                }
            });

            btn.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const targetIdx = parseInt(btn.dataset.idx, 10);
                if (dragSrcIdx === -1 || dragSrcIdx === targetIdx) return;

                // 判断插入在目标的前面还是后面
                const rect = btn.getBoundingClientRect();
                const insertBefore = e.clientY < rect.top + rect.height / 2;
                let insertAt = insertBefore ? targetIdx : targetIdx + 1;

                const moved = this.presets.splice(dragSrcIdx, 1)[0];
                if (dragSrcIdx < insertAt) insertAt--;   // 移除后索引偏移修正
                this.presets.splice(insertAt, 0, moved);

                this.savePresets();
                this.renderPresets();
            });

            this.presetsContainer.appendChild(btn);
        });
    }
}
