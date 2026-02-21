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

        this.btnSelectBlack = document.getElementById('btn-create-selection-black');
        this.btnSelectWhite = document.getElementById('btn-create-selection-white');
        this.btnSelectFg = document.getElementById('btn-create-selection-foreground');
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

        // 色彩范围选取多态绑定
        const bindColorSelect = (btn, mode) => {
            if (btn) {
                btn.addEventListener('click', () => {
                    this.cs.evalScript(`selectByColorRange("${mode}")`, (res) => {
                        if (res && res.indexOf("失败") > -1) alert(res);
                    });
                });
            }
        };

        bindColorSelect(this.btnSelectBlack, "black");
        bindColorSelect(this.btnSelectWhite, "white");
        bindColorSelect(this.btnSelectFg, "foreground");

        if (this.btnSelectAuto) {
            this.btnSelectAuto.addEventListener('click', () => {
                this.cs.evalScript(`autoSelectBubbles()`, (res) => {
                    if (res && res.indexOf("失败") > -1) {
                        alert(res);
                    } else if (res) {
                        alert(res); // 成功的话也要弹出提示用户去点去字
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
