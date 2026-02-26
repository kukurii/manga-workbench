// retouch.js - 快捷修图面板逻辑前端

class RetouchManager {
    constructor(csInterface, extPath) {
        this.cs = csInterface;
        this.extPath = extPath;
        this.healPending = false; // 是否处于"等待确认填充"状态

        this.initDOM();
        this.bindEvents();
    }

    initDOM() {
        this.btnAutoErase = document.getElementById('btn-auto-erase');
        this.btnFillWhite = document.getElementById('btn-fill-white');
        this.btnFillColor = document.getElementById('btn-fill-color');
        this.inputFillColor = document.getElementById('input-fill-color');
        this.inputExpandPixel = document.getElementById('input-expand-pixel');

        this.btnHealSelection = document.getElementById('btn-create-selection-auto');
        this.btnHealConfirm = document.getElementById('btn-heal-confirm');
        this.btnHealCancel = document.getElementById('btn-heal-cancel');
        this.healConfirmRow = document.getElementById('heal-confirm-row');
    }

    bindEvents() {
        const shouldAlert = (res) => {
            return !!(res && (res.indexOf("错误") > -1 || res.indexOf("失败") > -1 || res.indexOf("中断") > -1));
        };

        if (this.btnAutoErase) {
            this.btnAutoErase.addEventListener('click', () => {
                const expandPx = this.inputExpandPixel ? this.inputExpandPixel.value : 3;
                this.cs.evalScript(`autoEraseSelection(${expandPx})`, (res) => {
                    if (shouldAlert(res)) {
                        alert(res);
                    }
                });
            });
        }

        if (this.btnFillWhite) {
            this.btnFillWhite.addEventListener('click', () => {
                const expandPx = this.inputExpandPixel ? this.inputExpandPixel.value : 3;
                this.cs.evalScript(`fillWhiteSelection(${expandPx})`, (res) => {
                    if (shouldAlert(res)) {
                        alert(res);
                    }
                });
            });
        }

        // 取色填充按钮
        if (this.btnFillColor) {
            this.btnFillColor.addEventListener('click', () => {
                const hex = this.inputFillColor ? this.inputFillColor.value : '#ffffff';
                const rgb = this._hexToRgb(hex);
                const expandPx = this.inputExpandPixel ? this.inputExpandPixel.value : 0;
                this.cs.evalScript(`fillColorSelection(${rgb.r}, ${rgb.g}, ${rgb.b}, ${expandPx})`, (res) => {
                    if (shouldAlert(res)) {
                        alert(res);
                    }
                });
            });
        }

        // 两步流程：第一步 - 修复选区
        if (this.btnHealSelection) {
            this.btnHealSelection.addEventListener('click', () => {
                if (this.healPending) return; // 防止重复触发

                this.cs.evalScript(`healSelectionHolesOnly()`, (res) => {
                    if (res && (res.indexOf("错误") > -1 || res.indexOf("失败") > -1 || res.indexOf("中断") > -1)) {
                        alert(res);
                        return;
                    }
                    if (res === "READY") {
                        // 进入确认状态
                        this.healPending = true;
                        this.btnHealSelection.disabled = true;
                        this.btnHealSelection.style.opacity = '0.5';
                        if (this.healConfirmRow) this.healConfirmRow.style.display = 'flex';
                    }
                });
            });
        }

        // 两步流程：确认填充
        if (this.btnHealConfirm) {
            this.btnHealConfirm.addEventListener('click', () => {
                this.cs.evalScript(`fillWhiteSelection(0)`, (res) => {
                    if (shouldAlert(res)) {
                        alert(res);
                    }
                    this._resetHealState();
                });
            });
        }

        // 两步流程：取消
        if (this.btnHealCancel) {
            this.btnHealCancel.addEventListener('click', () => {
                this._resetHealState();
            });
        }

        // 绑定常用工具快捷切换按钮
        const toolBtns = document.querySelectorAll('.tool-btn[data-tool]');
        toolBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const toolId = e.currentTarget.getAttribute('data-tool');
                if (toolId) {
                    this.cs.evalScript(`switchTool("${toolId}")`);
                }
            });
        });
    }

    _resetHealState() {
        this.healPending = false;
        if (this.btnHealSelection) {
            this.btnHealSelection.disabled = false;
            this.btnHealSelection.style.opacity = '';
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
