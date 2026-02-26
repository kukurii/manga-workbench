// presets.js - 全局预设、本地存储与缓存管理

class PresetsManager {
    constructor(csInterface, extPath, dataDir) {
        this.cs = csInterface;
        this.extPath = extPath;
        this.dataDir = dataDir;

        this.initDOM();
        this.bindEvents();
        this.loadSettings();
    }

    initDOM() {
        this.btnClearFontCache = document.getElementById('btn-clear-font-cache');
        this.inputApiKey = document.getElementById('input-api-key');
        this.selModelType = document.getElementById('sel-api-model-type');
        this.inputBaseUrl = document.getElementById('input-api-base-url');
        this.inputModelName = document.getElementById('input-api-model-name');
        this.apiOpenaiExtra = document.getElementById('api-openai-extra');
        this.btnSaveApiKey = document.getElementById('btn-save-api-key');
        this.btnReload = document.getElementById('btn-reload-extension');
    }

    bindEvents() {
        // 切换模型类型时显示/隐藏 OpenAI 额外配置
        if (this.selModelType) {
            this.selModelType.addEventListener('change', () => {
                this._updateApiExtraVisibility();
            });
        }

        // 清理字体缓存文件
        if (this.btnClearFontCache) {
            this.btnClearFontCache.addEventListener('click', () => {
                if (confirm("确定要清理字体列表缓存吗？\n下次打开字体面板将重新扫描系统字体。")) {
                    const cachePath = this.dataDir + "/font_cache.json";
                    const result = window.cep.fs.deleteFile(cachePath);
                    if (result.err === window.cep.fs.NO_ERROR || result.err === window.cep.fs.ERR_NOT_FOUND) {
                        alert("字体缓存清理成功。");
                        if (window.fontManager) {
                            window.fontManager.allFonts = [];
                            const container = document.getElementById('font-list-container');
                            if (container) container.innerHTML = '<div class="placeholder">缓存已清空，点击刷新按钮重新生成。</div>';
                        }
                    } else {
                        alert("缓存不存在或清理失败，错误码：" + result.err);
                    }
                }
            });
        }

        // 保存 API 配置
        if (this.btnSaveApiKey) {
            this.btnSaveApiKey.addEventListener('click', () => {
                this.saveApiSettings();
                alert("✅ API 配置已保存在本地！");
            });
        }

        // 强杀重载整个 CEP 插件前端环境
        if (this.btnReload) {
            this.btnReload.addEventListener('click', () => {
                if (confirm("遇到卡死或严重显示 Bug 时，可以执行紧急热重载强杀扩展再重启，确定执行吗？")) {
                    window.location.reload(true);
                }
            });
        }
    }

    _updateApiExtraVisibility() {
        if (!this.selModelType || !this.apiOpenaiExtra) return;
        this.apiOpenaiExtra.style.display = this.selModelType.value === 'openai' ? 'block' : 'none';
    }

    // ── API 配置读写 ──
    loadSettings() {
        // 恢复 API Key
        if (this.inputApiKey) {
            const savedKey = localStorage.getItem('manga_wb_api_key');
            if (savedKey) this.inputApiKey.value = savedKey;
        }
        // 恢复模型类型
        if (this.selModelType) {
            const modelType = localStorage.getItem('manga_wb_model_type') || 'gemini';
            this.selModelType.value = modelType;
            this._updateApiExtraVisibility();
        }
        // 恢复 Base URL
        if (this.inputBaseUrl) {
            const url = localStorage.getItem('manga_wb_base_url') || '';
            this.inputBaseUrl.value = url;
        }
        // 恢复模型名称
        if (this.inputModelName) {
            const name = localStorage.getItem('manga_wb_model_name') || '';
            this.inputModelName.value = name;
        }
    }

    saveApiSettings() {
        if (this.inputApiKey) localStorage.setItem('manga_wb_api_key', this.inputApiKey.value.trim());
        if (this.selModelType) localStorage.setItem('manga_wb_model_type', this.selModelType.value);
        if (this.inputBaseUrl) localStorage.setItem('manga_wb_base_url', this.inputBaseUrl.value.trim());
        if (this.inputModelName) localStorage.setItem('manga_wb_model_name', this.inputModelName.value.trim());
        // 旧 key 兼容保留
        if (this.inputApiKey) localStorage.setItem('manga_workbench_api_key', this.inputApiKey.value.trim());
    }

    // ── 静态工具：供其他模块读取 API 配置 ──
    static getApiConfig() {
        return {
            apiKey: localStorage.getItem('manga_wb_api_key') || localStorage.getItem('manga_workbench_api_key') || '',
            modelType: localStorage.getItem('manga_wb_model_type') || 'gemini',
            baseUrl: localStorage.getItem('manga_wb_base_url') || '',
            modelName: localStorage.getItem('manga_wb_model_name') || '',
        };
    }
}
