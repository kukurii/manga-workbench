// presets.js - 全局预设、本地存储与缓存管理

class PresetsManager {
    constructor(csInterface, extPath) {
        this.cs = csInterface;
        this.extPath = extPath;

        this.initDOM();
        this.bindEvents();
        this.loadSettings();
    }

    initDOM() {
        this.btnClearFontCache = document.getElementById('btn-clear-font-cache');
        this.inputApiKey = document.getElementById('input-api-key');
        this.btnSaveApiKey = document.getElementById('btn-save-api-key');
        this.btnReload = document.getElementById('btn-reload-extension');
    }

    bindEvents() {
        // 清理字体缓存文件
        if (this.btnClearFontCache) {
            this.btnClearFontCache.addEventListener('click', () => {
                if (confirm("确定要清理通过长时间深层扫描生成的字体缓存文件吗？\n下次打开应用将再次耗费大量时间重新生成缓存！")) {
                    const cachePath = this.extPath + "/data/font_cache.json";
                    const result = window.cep.fs.deleteFile(cachePath);
                    if (result.err === window.cep.fs.NO_ERROR) {
                        alert("字体缓存清理成功。");
                        // 如果在同一会话中又切换回了字体面板，可以考虑重置 FontManager
                        if (window.fontManager) {
                            window.fontManager.allFonts = [];
                            document.getElementById('font-list-container').innerHTML = '<div class="placeholder-text">缓存已清空，请点击顶部按钮重新生成。</div>';
                        }
                    } else {
                        alert("缓存不存在或清理失败。");
                    }
                }
            });
        }

        // 保存 API Key
        if (this.btnSaveApiKey) {
            this.btnSaveApiKey.addEventListener('click', () => {
                if (this.inputApiKey) {
                    localStorage.setItem('manga_workbench_api_key', this.inputApiKey.value.trim());
                }
                alert("API 配置已成功保存在本地环境的安全存储中！");
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

    // 从本地存储读取设置项
    loadSettings() {
        if (this.inputApiKey) {
            const savedKey = localStorage.getItem('manga_workbench_api_key');
            if (savedKey) this.inputApiKey.value = savedKey;
        }
    }
}
