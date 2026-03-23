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
        this.btnStrokeCustom = document.getElementById('btn-stroke-custom');
        this.btnClearLayerStyle = document.getElementById('btn-clear-layer-style');

        // 文字颜色修改按钮
        this.btnTextColorWhite = document.getElementById('btn-text-color-white');
        this.btnTextColorBlack = document.getElementById('btn-text-color-black');

        // 外发光
        this.inputGlowSize = document.getElementById('input-glow-size');
        this.btnAddOuterGlow = document.getElementById('btn-add-outer-glow');

        // 投影
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

    getPositiveNumber(input, fallback) {
        const raw = input ? input.value : '';
        const value = parseFloat(raw);
        return !isNaN(value) && value > 0 ? value : fallback;
    }

    bindEvents() {
        // 文字改白
        if (this.btnTextColorWhite) {
            this.btnTextColorWhite.addEventListener('click', () => {
                // 调用 JSX：将文本图层字色改为白色 (255,255,255)
                this.cs.evalScript(`setTextLayerColor(255, 255, 255)`, this.handleRes);
            });
        }

        // 文字改黑
        if (this.btnTextColorBlack) {
            this.btnTextColorBlack.addEventListener('click', () => {
                // 调用 JSX：将文本图层字色改为黑色 (0,0,0)
                this.cs.evalScript(`setTextLayerColor(0, 0, 0)`, this.handleRes);
            });
        }

        if (this.btnStrokeBlack) {
            this.btnStrokeBlack.addEventListener('click', () => {
                const size = parseFloat(this.inputStrokeSize.value);
                if (isNaN(size) || size <= 0) return showToast('请输入有效的像素大小', 'error');
                this.cs.evalScript(`applyLayerStroke(0, 0, 0, ${size})`, this.handleRes);
            });
        }

        if (this.btnStrokeWhite) {
            this.btnStrokeWhite.addEventListener('click', () => {
                const size = parseFloat(this.inputStrokeSize.value);
                if (isNaN(size) || size <= 0) return showToast('请输入有效的像素大小', 'error');
                this.cs.evalScript(`applyLayerStroke(255, 255, 255, ${size})`, this.handleRes);
            });
        }

        if (this.btnStrokeCustom) {
            this.btnStrokeCustom.addEventListener('click', () => {
                const size = parseFloat(this.inputStrokeSize.value);
                if (isNaN(size) || size <= 0) return showToast('请输入有效的像素大小', 'error');
                const hex = window.getPickerColor ? window.getPickerColor('stroke-color') : '#000000';
                const { r, g, b } = this.hexToRgb(hex);
                this.cs.evalScript(`applyLayerStroke(${r}, ${g}, ${b}, ${size})`, this.handleRes);
            });
        }

        if (this.btnClearLayerStyle) {
            this.btnClearLayerStyle.addEventListener('click', () => {
                this.cs.evalScript('hideLayerEffects()', (res) => {
                    if (!res) return;
                    if (res.indexOf('错误') > -1 || res.indexOf('閿欒') > -1) {
                        showToast(res, 'error');
                    } else {
                        showToast(res, 'success');
                    }
                });
            });
        }

        // 外发光
        if (this.btnAddOuterGlow) {
            this.btnAddOuterGlow.addEventListener('click', () => {
                const size = this.getPositiveNumber(this.inputGlowSize, 5);
                const hex = window.getPickerColor ? window.getPickerColor('glow-color') : '#ffffff';
                const { r, g, b } = this.hexToRgb(hex);
                this.cs.evalScript(`addOuterGlow(${r}, ${g}, ${b}, ${size})`, this.handleRes);
            });
        }

        // 投影
        if (this.btnAddDropShadow) {
            this.btnAddDropShadow.addEventListener('click', () => {
                const dist = this.getPositiveNumber(this.inputShadowDist, 3);
                const size = dist; // 模糊大小与距离保持一致，简洁操作
                const hex = window.getPickerColor ? window.getPickerColor('shadow-color') : '#000000';
                const { r, g, b } = this.hexToRgb(hex);
                this.cs.evalScript(`addDropShadow(${r}, ${g}, ${b}, ${dist}, ${size})`, this.handleRes);
            });
        }
    }

    handleRes(res) {
        if (res && (res.indexOf('错误') > -1 || res.indexOf('ERROR:') === 0)) {
            showToast(res, 'error');
        }
    }
}
