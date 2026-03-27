// styleTool.js - paragraph style preset library

class StyleManager {
    constructor(csInterface, extPath, dataDir) {
        this.cs = csInterface;
        this.extPath = extPath;
        this.dataDir = dataDir;
        this.presets = [];
        this.storageKey = 'manga-workbench.style-form';
        this.editingPresetId = null;
        this.initDOM();
        this.bindEvents();
        this.restoreFormState();
        this.loadPresets();
    }

    initDOM() {
        this.presetsContainer = document.getElementById('style-presets-container');
        this.selFont = document.getElementById('sel-style-font');
        this.inputSize = document.getElementById('input-style-size');
        this.selLeadingType = document.getElementById('sel-style-leading-type');
        this.inputLeadingVal = document.getElementById('input-style-leading-val');
        this.labLeadingUnit = document.getElementById('lab-style-leading-unit');
        this.chkFauxBold = document.getElementById('chk-style-faux-bold');

        this.btnApplyNow = document.getElementById('btn-apply-style-now');
        this.btnSavePreset = document.getElementById('btn-save-style-preset');

        this.ensureEditControls();
    }

    ensureEditControls() {
        if (!this.btnSavePreset || !this.btnSavePreset.parentNode) return;

        let actionsRow = document.getElementById('style-preset-edit-actions');
        if (!actionsRow) {
            actionsRow = document.createElement('div');
            actionsRow.id = 'style-preset-edit-actions';
            actionsRow.className = 'btn-row mt-2';
            this.btnSavePreset.parentNode.insertAdjacentElement('afterend', actionsRow);
        }

        this.btnUpdatePreset = document.getElementById('btn-update-style-preset');
        if (!this.btnUpdatePreset) {
            this.btnUpdatePreset = document.createElement('button');
            this.btnUpdatePreset.id = 'btn-update-style-preset';
            this.btnUpdatePreset.className = 'btn btn--tint';
            this.btnUpdatePreset.disabled = true;
            this.btnUpdatePreset.innerText = '更新当前预设';
            actionsRow.appendChild(this.btnUpdatePreset);
        }

        this.btnCancelEdit = document.getElementById('btn-cancel-style-preset-edit');
        if (!this.btnCancelEdit) {
            this.btnCancelEdit = document.createElement('button');
            this.btnCancelEdit.id = 'btn-cancel-style-preset-edit';
            this.btnCancelEdit.className = 'btn btn--ghost';
            this.btnCancelEdit.style.display = 'none';
            this.btnCancelEdit.innerText = '取消编辑';
            actionsRow.appendChild(this.btnCancelEdit);
        }

        this.editHint = document.getElementById('style-preset-editing-hint');
        if (!this.editHint) {
            this.editHint = document.createElement('p');
            this.editHint.id = 'style-preset-editing-hint';
            this.editHint.className = 'hint mt-2';
            this.editHint.style.display = 'none';
            this.editHint.style.marginBottom = '0';
            actionsRow.insertAdjacentElement('afterend', this.editHint);
        }

        this.updateEditModeUI();
    }

    bindEvents() {
        if (this.selLeadingType) {
            this.selLeadingType.addEventListener('change', () => {
                if (this.selLeadingType.value === 'auto') {
                    this.labLeadingUnit.innerText = '%';
                    if (this.inputLeadingVal.value == '14' || this.inputLeadingVal.value == '') this.inputLeadingVal.value = 125;
                } else {
                    this.labLeadingUnit.innerText = 'pt';
                    if (this.inputLeadingVal.value == '125' || this.inputLeadingVal.value == '') this.inputLeadingVal.value = 14;
                }
                this.persistFormState();
            });
        }

        [this.selFont, this.inputSize, this.inputLeadingVal, this.chkFauxBold].forEach((el) => {
            if (!el) return;
            el.addEventListener('change', () => {
                this.persistFormState();
            });
        });

        if (this.btnApplyNow) {
            this.btnApplyNow.addEventListener('click', () => {
                this.applyStyle();
            });
        }

        if (this.btnSavePreset) {
            this.btnSavePreset.addEventListener('click', () => {
                showPromptModal("请为该段落预设起一个好记的名字 (如: 对话-方正宋体-36pt):", "对话样式A", (name) => {
                    if (!name) return;

                    const formData = this.collectFormData();
                    if (!formData) return;

                    const preset = {
                        id: Date.now().toString(),
                        name: name,
                        fontPostScriptName: formData.fontPostScriptName,
                        fontName: formData.fontName,
                        size: formData.size,
                        leadingType: formData.leadingType,
                        leadingValue: formData.leadingValue,
                        fauxBold: formData.fauxBold
                    };

                    this.presets.push(preset);
                    this.savePresets();
                    this.renderPresets();
                    this.persistFormState();
                    this.startEditingPreset(preset.id);
                    showToast('预设已保存，可继续修改后更新', 'success');
                });
            });
        }

        if (this.btnUpdatePreset) {
            this.btnUpdatePreset.addEventListener('click', () => {
                this.updateEditingPreset();
            });
        }

        if (this.btnCancelEdit) {
            this.btnCancelEdit.addEventListener('click', () => {
                this.cancelEditingPreset();
            });
        }
    }

    collectFormData() {
        const size = parseFloat(this.inputSize.value);
        const leadingValue = parseFloat(this.inputLeadingVal.value);
        if (isNaN(size) || size <= 0) {
            showToast('请输入有效的字号');
            return null;
        }
        if (isNaN(leadingValue) || leadingValue <= 0) {
            showToast('请输入有效的行距');
            return null;
        }

        const fontPostName = this.selFont ? (this.selFont.value || '') : '';
        const fontSelectObj = this.selFont && this.selFont.selectedIndex >= 0
            ? this.selFont.options[this.selFont.selectedIndex]
            : null;

        return {
            fontPostScriptName: fontPostName,
            fontName: fontSelectObj ? fontSelectObj.text : '',
            size: size,
            leadingType: this.selLeadingType ? this.selLeadingType.value : 'fixed',
            leadingValue: leadingValue,
            fauxBold: this.chkFauxBold ? this.chkFauxBold.checked : false
        };
    }

    syncFonts(fontList, getDisplayName) {
        if (!this.selFont) return;
        const previousValue = this.selFont.value;
        this.selFont.innerHTML = '<option value="">(保持图层原字体不改变)</option>';
        fontList.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.postScriptName;
            if (getDisplayName) {
                const display = getDisplayName(f);
                opt.innerText = display.source !== 'fallback'
                    ? `${display.primary} (${f.name})`
                    : f.name;
            } else {
                opt.innerText = f.name;
            }
            this.selFont.appendChild(opt);
        });
        const nextValue = previousValue || this._pendingFontValue || '';
        if (nextValue) this.selFont.value = nextValue;
    }

    applyStyle(presetObj = null) {
        let fontPostName, size, leadingType, leadingValue, fauxBold;
        if (presetObj) {
            fontPostName = presetObj.fontPostScriptName || "";
            size = presetObj.size;
            leadingType = presetObj.leadingType;
            leadingValue = presetObj.leadingValue;
            fauxBold = presetObj.fauxBold === true;
            if (this.chkFauxBold) this.chkFauxBold.checked = fauxBold;
        } else {
            const formData = this.collectFormData();
            if (!formData) return;
            fontPostName = formData.fontPostScriptName;
            size = formData.size;
            leadingType = formData.leadingType;
            leadingValue = formData.leadingValue;
            fauxBold = formData.fauxBold;
        }

        const safeFont = fontPostName ? fontPostName : '';
        this.cs.evalScript(`applyParagraphStyle(${JSON.stringify(safeFont)}, ${size}, ${JSON.stringify(leadingType)}, ${leadingValue}, ${fauxBold})`, (res) => {
            if (res && res.indexOf("错误") > -1) {
                showToast(res);
            } else {
                this.persistFormState();
            }
        });
    }

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
        this.updateEditModeUI();
    }

    savePresets() {
        const path = this.dataDir + "/style_presets.json";
        window.cep.fs.writeFile(path, JSON.stringify(this.presets));
    }

    renderPresets() {
        if (!this.presetsContainer) return;
        this.presetsContainer.innerHTML = '';

        if (this.presets.length === 0) {
            this.editingPresetId = null;
            this.updateEditModeUI();
            this.presetsContainer.innerHTML = '<div class="placeholder" style="padding:20px 0;">尚未创建任何预设。在下方配置好参数并保存，即可在这里一键调用。</div>';
            return;
        }

        let dragSrcIdx = -1;

        const clearDropIndicators = () => {
            this.presetsContainer.querySelectorAll('.preset-drag-over-before, .preset-drag-over-after')
                .forEach(el => el.classList.remove('preset-drag-over-before', 'preset-drag-over-after'));
        };

        this.presets.forEach((p, idx) => {
            const btn = document.createElement('div');
            btn.className = 'btn btn--secondary style-preset-card';
            btn.style.flex = '1 1 45%';
            btn.style.justifyContent = 'space-between';
            btn.style.alignItems = 'center';
            btn.title = `字体: ${p.fontName}\n字号: ${p.size}pt\n行距: ${p.leadingType === 'auto' ? '自动 ' + p.leadingValue + '%' : '固定 ' + p.leadingValue + 'pt'}\n仿粗体: ${p.fauxBold ? '开' : '关'}`;
            btn.dataset.idx = idx;
            btn.draggable = false;

            if (p.id === this.editingPresetId) {
                btn.classList.add('is-active');
                btn.style.outline = '1px solid var(--accent)';
                btn.style.boxShadow = '0 0 0 1px rgba(80, 140, 255, 0.22)';
            }

            const nameSpan = document.createElement('span');
            nameSpan.innerText = p.name;
            nameSpan.className = 'flex-1';
            nameSpan.style.textAlign = 'left';
            nameSpan.style.overflow = 'hidden';
            nameSpan.style.textOverflow = 'ellipsis';
            nameSpan.style.whiteSpace = 'nowrap';

            const dragHandle = document.createElement('span');
            dragHandle.className = 'style-preset-drag-handle';
            dragHandle.innerText = '⋮⋮';
            dragHandle.style.cursor = 'grab';
            dragHandle.style.opacity = '0.65';
            dragHandle.style.userSelect = 'none';
            dragHandle.title = '拖拽排序';

            const actionWrap = document.createElement('span');
            actionWrap.style.display = 'inline-flex';
            actionWrap.style.alignItems = 'center';
            actionWrap.style.gap = '8px';
            actionWrap.style.marginLeft = '8px';
            actionWrap.style.flexShrink = '0';

            const editSpan = document.createElement('span');
            editSpan.innerText = '编辑';
            editSpan.style.cursor = 'pointer';
            editSpan.style.opacity = '0.75';
            editSpan.title = '载入到下方参数区继续修改';
            editSpan.addEventListener('mouseenter', () => editSpan.style.opacity = '1');
            editSpan.addEventListener('mouseleave', () => editSpan.style.opacity = '0.75');

            const delSpan = document.createElement('span');
            delSpan.innerText = '×';
            delSpan.style.cursor = 'pointer';
            delSpan.style.opacity = '0.5';
            delSpan.title = '删除预设';
            delSpan.addEventListener('mouseenter', () => delSpan.style.opacity = '1');
            delSpan.addEventListener('mouseleave', () => delSpan.style.opacity = '0.5');

            actionWrap.appendChild(editSpan);
            actionWrap.appendChild(delSpan);

            btn.appendChild(nameSpan);
            btn.appendChild(dragHandle);
            btn.appendChild(actionWrap);

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.target === dragHandle || e.target === editSpan || e.target === delSpan) return;
                this.applyStyle(p);
            });

            editSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                this.startEditingPreset(p.id);
            });

            delSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                showConfirmModal('确定要彻底删除段落预设 ' + p.name + ' 吗？', () => {
                    if (p.id === this.editingPresetId) {
                        this.editingPresetId = null;
                        this.updateEditModeUI();
                    }
                    this.presets.splice(idx, 1);
                    this.savePresets();
                    this.renderPresets();
                });
            });

            dragHandle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                btn.draggable = true;
            });

            dragHandle.addEventListener('mouseup', () => {
                btn.draggable = false;
            });

            dragHandle.addEventListener('mouseleave', () => {
                btn.draggable = false;
            });

            btn.addEventListener('dragstart', (e) => {
                if (!btn.draggable) {
                    e.preventDefault();
                    return;
                }
                dragSrcIdx = idx;
                btn.classList.add('preset-dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', idx);
            });

            btn.addEventListener('dragend', () => {
                btn.classList.remove('preset-dragging');
                btn.draggable = false;
                clearDropIndicators();
            });

            btn.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragSrcIdx === idx) return;
                clearDropIndicators();
                const rect = btn.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                if (e.clientY < midY) {
                    btn.classList.add('preset-drag-over-before');
                } else {
                    btn.classList.add('preset-drag-over-after');
                }
            });

            btn.addEventListener('dragleave', (e) => {
                if (!btn.contains(e.relatedTarget)) {
                    btn.classList.remove('preset-drag-over-before', 'preset-drag-over-after');
                }
            });

            btn.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const targetIdx = parseInt(btn.dataset.idx, 10);
                if (dragSrcIdx === -1 || dragSrcIdx === targetIdx) return;

                const rect = btn.getBoundingClientRect();
                const insertBefore = e.clientY < rect.top + rect.height / 2;
                let insertAt = insertBefore ? targetIdx : targetIdx + 1;

                const moved = this.presets.splice(dragSrcIdx, 1)[0];
                if (dragSrcIdx < insertAt) insertAt--;
                this.presets.splice(insertAt, 0, moved);

                this.savePresets();
                this.renderPresets();
            });

            this.presetsContainer.appendChild(btn);
        });
    }

    startEditingPreset(presetId) {
        const preset = this.presets.find(item => item.id === presetId);
        if (!preset) return;

        this.editingPresetId = presetId;
        this.fillFormFromPreset(preset);
        this.persistFormState();
        this.updateEditModeUI();
        this.renderPresets();
        showToast('已载入预设参数，修改后点“更新当前预设”即可覆盖保存', 'info');
    }

    cancelEditingPreset(silent) {
        this.editingPresetId = null;
        this.updateEditModeUI();
        this.renderPresets();
        if (!silent) {
            showToast('已退出预设编辑模式', 'info');
        }
    }

    fillFormFromPreset(preset) {
        if (this.selFont) {
            this.selFont.value = preset.fontPostScriptName || '';
            this._pendingFontValue = preset.fontPostScriptName || '';
        }
        if (this.inputSize) this.inputSize.value = preset.size;
        if (this.selLeadingType) this.selLeadingType.value = preset.leadingType || 'fixed';
        if (this.inputLeadingVal) this.inputLeadingVal.value = preset.leadingValue;
        if (this.chkFauxBold) this.chkFauxBold.checked = preset.fauxBold === true;
        this.updateLeadingUnit();
    }

    updateEditingPreset() {
        if (!this.editingPresetId) {
            showToast('请先点预设卡片右侧的“编辑”');
            return;
        }

        const formData = this.collectFormData();
        if (!formData) return;

        const presetIndex = this.presets.findIndex(item => item.id === this.editingPresetId);
        if (presetIndex === -1) {
            this.cancelEditingPreset(true);
            showToast('未找到要更新的预设');
            return;
        }

        const oldPreset = this.presets[presetIndex];
        this.presets[presetIndex] = {
            id: oldPreset.id,
            name: oldPreset.name,
            fontPostScriptName: formData.fontPostScriptName,
            fontName: formData.fontName,
            size: formData.size,
            leadingType: formData.leadingType,
            leadingValue: formData.leadingValue,
            fauxBold: formData.fauxBold
        };

        this.savePresets();
        this.persistFormState();
        this.renderPresets();
        this.updateEditModeUI();
        showToast('预设参数已更新', 'success');
    }

    updateEditModeUI() {
        const preset = this.presets.find(item => item.id === this.editingPresetId) || null;

        if (this.btnUpdatePreset) {
            this.btnUpdatePreset.disabled = !preset;
        }

        if (this.btnCancelEdit) {
            this.btnCancelEdit.style.display = preset ? 'inline-flex' : 'none';
        }

        if (this.editHint) {
            if (preset) {
                this.editHint.style.display = 'block';
                this.editHint.innerText = `当前正在编辑预设：${preset.name}。修改下方参数后，点击“更新当前预设”即可覆盖保存。`;
            } else {
                this.editHint.style.display = 'none';
                this.editHint.innerText = '';
            }
        }
    }

    restoreFormState() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) {
                this.updateLeadingUnit();
                return;
            }

            const data = JSON.parse(raw);
            if (this.inputSize && data.size) this.inputSize.value = data.size;
            if (this.selLeadingType && data.leadingType) this.selLeadingType.value = data.leadingType;
            if (this.inputLeadingVal && data.leadingValue) this.inputLeadingVal.value = data.leadingValue;
            if (this.chkFauxBold && typeof data.fauxBold === 'boolean') this.chkFauxBold.checked = data.fauxBold;

            this._pendingFontValue = data.fontPostScriptName || '';
            this.updateLeadingUnit();
        } catch (err) {
            this.updateLeadingUnit();
        }
    }

    persistFormState() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                fontPostScriptName: this.selFont ? this.selFont.value : '',
                size: this.inputSize ? this.inputSize.value : '',
                leadingType: this.selLeadingType ? this.selLeadingType.value : 'fixed',
                leadingValue: this.inputLeadingVal ? this.inputLeadingVal.value : '',
                fauxBold: this.chkFauxBold ? !!this.chkFauxBold.checked : false
            }));
        } catch (err) { }
    }

    updateLeadingUnit() {
        if (!this.selLeadingType || !this.labLeadingUnit) return;
        this.labLeadingUnit.innerText = this.selLeadingType.value === 'auto' ? '%' : 'pt';
    }
}
