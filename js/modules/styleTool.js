// styleTool.js - 排版段落预设�?

class StyleManager {
    constructor(csInterface, extPath, dataDir) {
        this.cs = csInterface;
        this.extPath = extPath;
        this.dataDir = dataDir;
        this.presets = []; // [{ id, name, fontPostScriptName, fontName, size, leadingType, leadingValue }]
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
                    // 如果原先填的很大的比率（比如125）则重置为正常固定间�?
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
                const name = showPromptModal("请为该段落预设起一个好记的名字 (�? 对话-方正宋体-36pt):", "对话样式A");
                if (!name) return;

                const fontPostName = this.selFont.value;
                const fontSelectObj = this.selFont.options[this.selFont.selectedIndex];
                const fontName = fontSelectObj ? fontSelectObj.text : '';

                const preset = {
                    id: Date.now().toString(),
                    name: name,
                    fontPostScriptName: fontPostName,
                    fontName: fontName,
                    size: parseFloat(this.inputSize.value),
                    leadingType: this.selLeadingType.value,
                    leadingValue: parseFloat(this.inputLeadingVal.value)
                };

                this.presets.push(preset);
                this.savePresets();
                this.renderPresets();
            });
        }
    }

    // �?fontTool.js 回调，用来同步系统字体到此处的下拉菜�?
    syncFonts(fontList) {
        if (!this.selFont) return;
        this.selFont.innerHTML = '<option value="">(保持图层原字体不改变)</option>';
        fontList.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.postScriptName;
            opt.innerText = f.name;
            this.selFont.appendChild(opt);
        });
    }

    applyStyle(presetObj = null) {
        let fontPostName, size, leadingType, leadingValue;
        if (presetObj) {
            fontPostName = presetObj.fontPostScriptName || "";
            size = presetObj.size;
            leadingType = presetObj.leadingType;
            leadingValue = presetObj.leadingValue;
        } else {
            fontPostName = this.selFont.value || "";
            size = parseFloat(this.inputSize.value);
            leadingType = this.selLeadingType.value;
            leadingValue = parseFloat(this.inputLeadingVal.value);
        }

        if (isNaN(size) || size <= 0) return showToast('请输入有效的字号');
        if (isNaN(leadingValue) || leadingValue <= 0) return showToast('请输入有效的行距');

        // 发送到 ExtendScript 统一处理段落三参�?
        // 为避免空�?fontPostName 变成字面�?'undefined' 传进 JSX 导致报错，必须拦�?
        const safeFont = fontPostName ? fontPostName : '';
        this.cs.evalScript(`applyParagraphStyle('${safeFont}', ${size}, '${leadingType}', ${leadingValue})`, (res) => {
            if (res && res.indexOf("错误") > -1) {
                showToast(res);
            }
        });
    }

    // JSON 预设文件化存�?
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

        this.presets.forEach(p => {
            const btn = document.createElement('div');
            btn.className = 'btn btn--secondary';
            btn.style.flex = '1 1 45%';
            btn.style.justifyContent = 'space-between';
            btn.title = `字体: ${p.fontName}\n字号: ${p.size}pt\n行距: ${p.leadingType === 'auto' ? '自动 ' + p.leadingValue + '%' : '固定 ' + p.leadingValue + 'pt'}`;

            const nameSpan = document.createElement('span');
            nameSpan.innerText = p.name;
            nameSpan.className = 'flex-1';
            nameSpan.style.textAlign = 'left';

            const delSpan = document.createElement('span');
            delSpan.innerText = '�?;
            delSpan.style.cursor = 'pointer';
            delSpan.style.marginLeft = '6px';
            delSpan.style.opacity = '0.5';
            delSpan.addEventListener('mouseenter', () => delSpan.style.opacity = '1');
            delSpan.addEventListener('mouseleave', () => delSpan.style.opacity = '0.5');

            btn.appendChild(nameSpan);
            btn.appendChild(delSpan);

            nameSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                this.applyStyle(p);
            });

            delSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('确定要彻底删除段落预�? ' + p.name + ' 吗？')) {
                    this.presets = this.presets.filter(p2 => p2.id !== p.id);
                    this.savePresets();
                    this.renderPresets();
                }
            });

            this.presetsContainer.appendChild(btn);
        });
    }
}
