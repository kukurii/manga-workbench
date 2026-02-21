// fxTool.js - 图层外框描边与特效管理

class FxManager {
    constructor(csInterface, extPath) {
        this.cs = csInterface;
        this.extPath = extPath;
        this.initDOM();
        this.bindEvents();
    }

    initDOM() {
        this.inputStrokeSize = document.getElementById('input-stroke-size');
        this.btnStrokeBlack = document.getElementById('btn-stroke-black');
        this.btnStrokeWhite = document.getElementById('btn-stroke-white');
        this.btnClearLayerStyle = document.getElementById('btn-clear-layer-style');
    }

    bindEvents() {
        if (this.btnStrokeBlack) {
            this.btnStrokeBlack.addEventListener('click', () => {
                const size = parseFloat(this.inputStrokeSize.value);
                if (isNaN(size) || size <= 0) return alert('请输入有效的像素大小');
                // Black: RGB(0,0,0)
                this.cs.evalScript(`applyLayerStroke(0, 0, 0, ${size})`, this.handleRes);
            });
        }

        if (this.btnStrokeWhite) {
            this.btnStrokeWhite.addEventListener('click', () => {
                const size = parseFloat(this.inputStrokeSize.value);
                if (isNaN(size) || size <= 0) return alert('请输入有效的像素大小');
                // White: RGB(255,255,255)
                this.cs.evalScript(`applyLayerStroke(255, 255, 255, ${size})`, this.handleRes);
            });
        }

        if (this.btnClearLayerStyle) {
            this.btnClearLayerStyle.addEventListener('click', () => {
                this.cs.evalScript(`clearLayerStyle()`, this.handleRes);
            });
        }
    }

    handleRes(res) {
        if (res && res.indexOf("错误") > -1) {
            alert(res);
        }
    }
}
