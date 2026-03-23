// retouch.js - retouch panel frontend logic

class RetouchManager {
    constructor(csInterface, extPath) {
        this.cs = csInterface;
        this.extPath = extPath;
        this.healPending = false;
        this.activeToolId = '';
        this.storageKey = 'manga-workbench.retouch';

        this.initDOM();
        this.injectEnhancements();
        this.restoreSettings();
        this.bindEvents();
        this.updatePresetState();
        this.updateStatus('等待修图操作...');
    }

    initDOM() {
        this.panel = document.getElementById('panel-retouch');
        this.btnAutoErase = document.getElementById('btn-auto-erase');
        this.btnFillWhite = document.getElementById('btn-fill-white');
        this.btnFillColor = document.getElementById('btn-fill-color');
        this.inputExpandPixel = document.getElementById('input-expand-pixel');
        this.toolBtns = Array.from(document.querySelectorAll('.tool-btn[data-tool]'));

        this.btnHealSelection = document.getElementById('btn-create-selection-auto');
        this.btnHealConfirm = document.getElementById('btn-heal-confirm');
        this.btnHealCancel = document.getElementById('btn-heal-cancel');
        this.healConfirmRow = document.getElementById('heal-confirm-row');
    }

    injectEnhancements() {
        if (!this.panel || !this.inputExpandPixel) return;

        const expandBar = this.inputExpandPixel.closest('.inline-bar');
        if (expandBar && !this.panel.querySelector('.retouch-preset-row')) {
            const presetRow = document.createElement('div');
            presetRow.className = 'retouch-preset-row mb-3';
            [-8, -4, 0, 4, 8].forEach((value) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn btn--ghost btn--xs';
                btn.dataset.expandPreset = String(value);
                btn.textContent = value > 0 ? `+${value}` : String(value);
                presetRow.appendChild(btn);
            });
            expandBar.insertAdjacentElement('afterend', presetRow);
        }

        const healSectionHead = this.panel.querySelector('.section-title--pink');
        if (healSectionHead && !document.getElementById('input-heal-expand-pixel')) {
            const healBar = document.createElement('div');
            healBar.className = 'inline-bar mb-2';
            healBar.innerHTML = [
                '<span class="form-label">修复强度</span>',
                '<input type="number" id="input-heal-expand-pixel" value="15" min="1" max="100" class="input--sm">',
                '<span class="form-hint">用于闭合选区破洞</span>'
            ].join('');
            healSectionHead.closest('.section-head').insertAdjacentElement('afterend', healBar);
        }

        const healBlock = this.btnHealSelection ? this.btnHealSelection.closest('.btn-col') : null;
        if (healBlock && !document.getElementById('retouch-status')) {
            const status = document.createElement('div');
            status.id = 'retouch-status';
            status.className = 'code-output retouch-status';
            status.textContent = '等待修图操作...';
            healBlock.insertAdjacentElement('afterend', status);
        }

        this.expandPresetBtns = Array.from(this.panel.querySelectorAll('[data-expand-preset]'));
        this.inputHealExpandPixel = document.getElementById('input-heal-expand-pixel');
        this.statusBox = document.getElementById('retouch-status');
    }

    restoreSettings() {
        const saved = this.readSettings();
        if (this.inputExpandPixel && typeof saved.expandPixel === 'number') {
            this.inputExpandPixel.value = saved.expandPixel;
        }
        if (this.inputHealExpandPixel && typeof saved.healExpandPixel === 'number') {
            this.inputHealExpandPixel.value = saved.healExpandPixel;
        }
        if (saved.fillColor && window.setPickerColor) {
            window.setPickerColor('fill-color', saved.fillColor);
        }
        if (saved.activeToolId) {
            this.activeToolId = saved.activeToolId;
            this.updateToolState(saved.activeToolId);
        }
    }

    bindEvents() {
        if (this.inputExpandPixel) {
            this.inputExpandPixel.addEventListener('change', () => {
                this.inputExpandPixel.value = this.normalizeInt(this.inputExpandPixel.value, -50, 50, -4);
                this.persistSettings();
                this.updatePresetState();
            });
        }

        if (this.inputHealExpandPixel) {
            this.inputHealExpandPixel.addEventListener('change', () => {
                this.inputHealExpandPixel.value = this.normalizeInt(this.inputHealExpandPixel.value, 1, 100, 15);
                this.persistSettings();
            });
        }

        this.expandPresetBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                if (!this.inputExpandPixel) return;
                this.inputExpandPixel.value = btn.dataset.expandPreset || '0';
                this.persistSettings();
                this.updatePresetState();
                this.updateStatus(`扩边像素已设为 ${this.inputExpandPixel.value}`);
            });
        });

        if (this.btnAutoErase) {
            this.btnAutoErase.addEventListener('click', () => {
                const expandPx = this.getExpandPixel();
                this.runScript(
                    `autoEraseSelection(${expandPx})`,
                    this.btnAutoErase,
                    '正在执行一键去字...',
                    `一键去字已完成，扩边 ${expandPx}px`
                );
            });
        }

        if (this.btnFillWhite) {
            this.btnFillWhite.addEventListener('click', () => {
                const expandPx = this.getExpandPixel();
                this.runScript(
                    `fillWhiteSelection(${expandPx})`,
                    this.btnFillWhite,
                    '正在填充白底...',
                    `白底填充已完成，扩边 ${expandPx}px`
                );
            });
        }

        if (this.btnFillColor) {
            this.btnFillColor.addEventListener('click', () => {
                const hex = window.getPickerColor ? window.getPickerColor('fill-color') : '#ffffff';
                const rgb = this._hexToRgb(hex);
                const expandPx = this.getExpandPixel(0);
                this.persistSettings({ fillColor: hex });
                this.runScript(
                    `fillColorSelection(${rgb.r}, ${rgb.g}, ${rgb.b}, ${expandPx})`,
                    this.btnFillColor,
                    '正在执行取色填充...',
                    `取色填充已完成，颜色 ${hex.toUpperCase()}，扩边 ${expandPx}px`
                );
            });
        }

        if (this.btnHealSelection) {
            this.btnHealSelection.addEventListener('click', () => {
                if (this.healPending) return;
                const healExpandPx = this.getHealExpandPixel();
                this.setBusy(this.btnHealSelection, true);
                this.updateStatus(`正在修复选区，闭合强度 ${healExpandPx}px...`);
                this.cs.evalScript(`healSelectionHolesOnly(${healExpandPx})`, (res) => {
                    this.setBusy(this.btnHealSelection, false);
                    if (this.isErrorResult(res)) {
                        this.updateStatus(res || '修复选区失败');
                        showToast(res || '修复选区失败', 'error');
                        return;
                    }
                    if (res === 'READY') {
                        this.healPending = true;
                        this.btnHealSelection.disabled = true;
                        this.btnHealSelection.classList.add('is-disabled');
                        if (this.healConfirmRow) this.healConfirmRow.style.display = 'flex';
                        this.updateStatus('选区已修复，请检查 Photoshop 中的预览后确认填充。');
                        showToast('选区修复完成，请确认后再填充。', 'success');
                    }
                });
            });
        }

        if (this.btnHealConfirm) {
            this.btnHealConfirm.addEventListener('click', () => {
                this.runScript(
                    'fillWhiteSelection(0)',
                    this.btnHealConfirm,
                    '正在确认并填充白色...',
                    '已确认修复结果并完成白色填充。',
                    () => this._resetHealState()
                );
            });
        }

        if (this.btnHealCancel) {
            this.btnHealCancel.addEventListener('click', () => {
                this._resetHealState();
                this.updateStatus('已取消本次修复确认，选区仍保留在 Photoshop 中。');
            });
        }

        this.toolBtns.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const toolId = e.currentTarget.getAttribute('data-tool');
                if (!toolId) return;
                this.cs.evalScript(`switchTool("${toolId}")`, (res) => {
                    if (res === 'false') {
                        this.updateStatus('工具切换失败，请确认 Photoshop 当前可响应。');
                        showToast('工具切换失败', 'error');
                        return;
                    }
                    this.activeToolId = toolId;
                    this.updateToolState(toolId);
                    this.persistSettings();
                    this.updateStatus(`已切换工具: ${this.getToolLabel(e.currentTarget)}`);
                });
            });
        });
    }

    runScript(script, triggerBtn, pendingMessage, successMessage, afterRun) {
        this.setBusy(triggerBtn, true);
        this.updateStatus(pendingMessage);
        this.cs.evalScript(script, (res) => {
            this.setBusy(triggerBtn, false);
            if (this.isErrorResult(res)) {
                this.updateStatus(res || '操作失败');
                showToast(res || '操作失败', 'error');
            } else {
                const message = res && res !== 'true' ? res : successMessage;
                this.updateStatus(message);
                showToast(message, 'success');
            }

            if (typeof afterRun === 'function') {
                afterRun(res);
            }
        });
    }

    setBusy(button, isBusy) {
        if (!button) return;
        button.disabled = isBusy;
        button.classList.toggle('is-disabled', isBusy);
    }

    updateStatus(message) {
        if (this.statusBox) {
            this.statusBox.textContent = message;
        }
    }

    updatePresetState() {
        const current = String(this.getExpandPixel());
        (this.expandPresetBtns || []).forEach((btn) => {
            btn.classList.toggle('is-active', btn.dataset.expandPreset === current);
        });
    }

    updateToolState(toolId) {
        this.toolBtns.forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.tool === toolId);
        });
    }

    getToolLabel(btn) {
        return (btn.textContent || '').replace(/\s+/g, ' ').trim() || btn.dataset.tool || '工具';
    }

    getExpandPixel(fallback) {
        const defaultValue = typeof fallback === 'number' ? fallback : -4;
        return this.normalizeInt(this.inputExpandPixel ? this.inputExpandPixel.value : defaultValue, -50, 50, defaultValue);
    }

    getHealExpandPixel() {
        return this.normalizeInt(this.inputHealExpandPixel ? this.inputHealExpandPixel.value : 15, 1, 100, 15);
    }

    normalizeInt(value, min, max, fallback) {
        const parsed = parseInt(value, 10);
        if (Number.isNaN(parsed)) return fallback;
        return Math.min(max, Math.max(min, parsed));
    }

    isErrorResult(res) {
        return !!(res && (res.indexOf('閿欒') > -1 || res.indexOf('澶辫触') > -1 || res.indexOf('涓柇') > -1));
    }

    readSettings() {
        try {
            const raw = window.localStorage.getItem(this.storageKey);
            return raw ? JSON.parse(raw) : {};
        } catch (err) {
            return {};
        }
    }

    persistSettings(extra) {
        try {
            const next = Object.assign({}, this.readSettings(), {
                expandPixel: this.getExpandPixel(),
                healExpandPixel: this.getHealExpandPixel(),
                activeToolId: this.activeToolId || ''
            }, extra || {});
            window.localStorage.setItem(this.storageKey, JSON.stringify(next));
        } catch (err) {
            // ignore storage failures inside CEP panel
        }
    }

    _resetHealState() {
        this.healPending = false;
        if (this.btnHealSelection) {
            this.btnHealSelection.disabled = false;
            this.btnHealSelection.classList.remove('is-disabled');
        }
        if (this.healConfirmRow) this.healConfirmRow.style.display = 'none';
    }

    _hexToRgb(hex) {
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        const n = parseInt(hex, 16);
        return {
            r: (n >> 16) & 255,
            g: (n >> 8) & 255,
            b: n & 255
        };
    }
}
