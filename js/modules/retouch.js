// retouch.js - 快捷修图面板逻辑前端

class RetouchManager {
    constructor(csInterface, extPath) {
        this.cs = csInterface;
        this.extPath = extPath;

        this.initDOM();
        this.bindEvents();
    }

    initDOM() {
        this.btnAutoErase = document.getElementById('btn-auto-erase');
        this.btnFillWhite = document.getElementById('btn-fill-white');
        this.inputExpandPixel = document.getElementById('input-expand-pixel');

        this.btnSelectAuto = document.getElementById('btn-create-selection-auto');
        this.inputExpandPixel = document.getElementById('input-expand-pixel');
    }

    bindEvents() {
        if (this.btnAutoErase) {
            this.btnAutoErase.addEventListener('click', () => {
                const expandPx = this.inputExpandPixel ? this.inputExpandPixel.value : 3;
                this.cs.evalScript(`autoEraseSelection(${expandPx})`, (res) => {
                    if (res && res.indexOf("失败") > -1) {
                        alert(res);
                    }
                });
            });
        }

        if (this.btnFillWhite) {
            this.btnFillWhite.addEventListener('click', () => {
                const expandPx = this.inputExpandPixel ? this.inputExpandPixel.value : 3;
                this.cs.evalScript(`fillWhiteSelection(${expandPx})`, (res) => {
                    if (res && res.indexOf("失败") > -1) {
                        alert(res);
                    }
                });
            });
        }

        if (this.btnSelectAuto) {
            this.btnSelectAuto.addEventListener('click', () => {
                this.cs.evalScript(`healSelectionHoles()`, (res) => {
                    if (res && res.indexOf("错误") > -1) {
                        alert(res);
                    } else if (res) {
                        alert(res); // 错误或提示
                    }
                });
            });
        }

        // 绑定常用工具快捷切换按钮
        const toolBtns = document.querySelectorAll('.tool-btn');
        toolBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const toolId = e.target.getAttribute('data-tool');
                if (toolId) {
                    this.cs.evalScript(`switchTool("${toolId}")`);
                }
            });
        });
    }
}
