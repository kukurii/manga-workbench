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
        this.inputStrokeColor = document.getElementById('input-stroke-color');
        this.btnStrokeBlack = document.getElementById('btn-stroke-black');
        this.btnStrokeWhite = document.getElementById('btn-stroke-white');
        this.btnStrokeCustom = document.getElementById('btn-stroke-custom');
        this.btnClearLayerStyle = document.getElementById('btn-clear-layer-style');

        // 外发光
        this.inputGlowColor = document.getElementById('input-glow-color');
        this.inputGlowSize = document.getElementById('input-glow-size');
        this.btnAddOuterGlow = document.getElementById('btn-add-outer-glow');

        // 投影
        this.inputShadowColor = document.getElementById('input-shadow-color');
        this.inputShadowDist = document.getElementById('input-shadow-dist');
        this.btnAddDropShadow = document.getElementById('btn-add-drop-shadow');
    }

    /** 将 #rrggbb 十六进制颜色字符串转换为 {r,g,b} 对象 */
    hexToRgb(hex) {
        const h = hex.replace('#', '');
        return {
            r: parseInt(h.substring(0, 2), 16),
            g: parseInt(h.substring(2, 4), 16),
            b: parseInt(h.substring(4, 6), 16)
        };
    }

    bindEvents() {
        if (this.btnStrokeBlack) {
            this.btnStrokeBlack.addEventListener('click', () => {
                const size = parseFloat(this.inputStrokeSize.value);
                if (isNaN(size) || size <= 0) return alert('请输入有效的像素大小');
                this.cs.evalScript(`applyLayerStroke(0, 0, 0, ${size})`, this.handleRes);
            });
        }

        if (this.btnStrokeWhite) {
            this.btnStrokeWhite.addEventListener('click', () => {
                const size = parseFloat(this.inputStrokeSize.value);
                if (isNaN(size) || size <= 0) return alert('请输入有效的像素大小');
                this.cs.evalScript(`applyLayerStroke(255, 255, 255, ${size})`, this.handleRes);
            });
        }

        if (this.btnStrokeCustom) {
            this.btnStrokeCustom.addEventListener('click', () => {
                const size = parseFloat(this.inputStrokeSize.value);
                if (isNaN(size) || size <= 0) return alert('请输入有效的像素大小');
                const hex = this.inputStrokeColor ? this.inputStrokeColor.value : '#000000';
                const { r, g, b } = this.hexToRgb(hex);
                this.cs.evalScript(`applyLayerStroke(${r}, ${g}, ${b}, ${size})`, this.handleRes);
            });
        }

        if (this.btnClearLayerStyle) {
            this.btnClearLayerStyle.addEventListener('click', () => {
                this.cs.evalScript(`clearLayerStyle()`, this.handleRes);
            });
        }

        // 外发光
        if (this.btnAddOuterGlow) {
            this.btnAddOuterGlow.addEventListener('click', () => {
                const size = parseFloat(this.inputGlowSize ? this.inputGlowSize.value : 5);
                const hex = this.inputGlowColor ? this.inputGlowColor.value : '#ffffff';
                const { r, g, b } = this.hexToRgb(hex);
                this.cs.evalScript(`addOuterGlow(${r}, ${g}, ${b}, ${size})`, this.handleRes);
            });
        }

        // 投影
        if (this.btnAddDropShadow) {
            this.btnAddDropShadow.addEventListener('click', () => {
                const dist = parseFloat(this.inputShadowDist ? this.inputShadowDist.value : 3);
                const size = dist; // 模糊大小与距离保持一致，简洁操作
                const hex = this.inputShadowColor ? this.inputShadowColor.value : '#000000';
                const { r, g, b } = this.hexToRgb(hex);
                this.cs.evalScript(`addDropShadow(${r}, ${g}, ${b}, ${dist}, ${size})`, this.handleRes);
            });
        }
    }

    handleRes(res) {
        if (res && res.indexOf('错误') > -1) {
            alert(res);
        }
    }
}
