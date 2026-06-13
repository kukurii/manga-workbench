// namespaceManager.js - 全局命名空间整理
// 将所有插件对象收归到统一的 window.app 命名空间

/**
 * App - 插件命名空间管理器
 *
 * 目标：
 * 1. 避免全局变量污染
 * 2. 统一管理所有管理器和工具
 * 3. 提供清晰的 API 结构
 * 4. 便于调试和维护
 */
class App {
    constructor() {
        // 版本信息
        this.version = '2.0.0';
        this.buildDate = '2026-06-13';

        // 核心工具（实例化后赋值）
        this.tools = {
            batchHelper: null,      // 批量调用助手
            eventManager: null,     // 事件管理器
            errorHandler: null,     // 错误处理器
            progressBar: null,      // 进度条
            encodingFixer: null     // 编码修复器
        };

        // 业务管理器（延迟初始化）
        this.managers = {
            page: null,             // 页面管理器
            typeset: null,          // 排版管理器
            style: null,            // 样式管理器
            fx: null,               // 特效管理器
            retouch: null,          // 修图管理器
            font: null,             // 字体管理器
            presets: null           // 预设管理器
        };

        // CEP 相关
        this.cs = null;             // CSInterface 实例
        this.extPath = null;        // 插件路径
        this.dataDir = null;        // 数据目录

        // 状态管理
        this.state = {
            initialized: false,     // 是否已初始化
            currentPanel: 'page',   // 当前激活面板
            loading: false          // 是否正在加载
        };

        // 兼容性：保留旧的全局引用（逐步废弃）
        this._setupLegacyAliases();
    }

    /**
     * 初始化应用（由 main.js 调用）
     * @param {CSInterface} csInterface - CEP 接口
     * @param {string} extensionPath - 插件路径
     * @param {string} dataDirectory - 数据目录
     */
    init(csInterface, extensionPath, dataDirectory) {
        this.cs = csInterface;
        this.extPath = extensionPath;
        this.dataDir = dataDirectory;

        // 初始化核心工具
        this._initTools();

        this.state.initialized = true;
        console.log(`[App] 初始化完成 v${this.version}`);
    }

    /**
     * 初始化核心工具
     * @private
     */
    _initTools() {
        // 这些工具应该已经在各自的文件中实例化到 window 上了
        this.tools.batchHelper = window.batchHelper || new window.BatchHelper(this.cs);
        this.tools.eventManager = window.eventManager || new window.EventManager();
        this.tools.errorHandler = window.errorHandler || new window.ErrorHandler();
        this.tools.progressBar = window.progressBar || new window.ProgressBar();
        this.tools.encodingFixer = window.encodingFixer || new window.EncodingFixer();

        // 如果 window 上还没有，赋值回去（向后兼容）
        if (!window.batchHelper) window.batchHelper = this.tools.batchHelper;
        if (!window.eventManager) window.eventManager = this.tools.eventManager;
        if (!window.errorHandler) window.errorHandler = this.tools.errorHandler;
        if (!window.progressBar) window.progressBar = this.tools.progressBar;
        if (!window.encodingFixer) window.encodingFixer = this.tools.encodingFixer;
    }

    /**
     * 注册管理器
     * @param {string} name - 管理器名称
     * @param {Object} manager - 管理器实例
     */
    registerManager(name, manager) {
        if (this.managers[name] === undefined) {
            console.warn(`[App] 未知的管理器名称: ${name}`);
        }
        this.managers[name] = manager;

        // 向后兼容：同时赋值到 window
        const legacyName = name + 'Manager';
        if (!window[legacyName]) {
            window[legacyName] = manager;
        }
    }

    /**
     * 获取管理器
     * @param {string} name - 管理器名称
     * @returns {Object|null}
     */
    getManager(name) {
        return this.managers[name] || null;
    }

    /**
     * 获取工具
     * @param {string} name - 工具名称
     * @returns {Object|null}
     */
    getTool(name) {
        return this.tools[name] || null;
    }

    /**
     * 切换面板
     * @param {string} panelId - 面板 ID
     */
    switchPanel(panelId) {
        this.state.currentPanel = panelId;
        console.log(`[App] 切换到面板: ${panelId}`);
    }

    /**
     * 获取应用状态
     * @returns {Object}
     */
    getState() {
        return {
            ...this.state,
            version: this.version,
            buildDate: this.buildDate
        };
    }

    /**
     * 调试信息
     */
    debug() {
        console.group('[App Debug]');
        console.log('版本:', this.version);
        console.log('构建日期:', this.buildDate);
        console.log('状态:', this.state);
        console.log('已加载的工具:', Object.keys(this.tools).filter(k => this.tools[k] !== null));
        console.log('已加载的管理器:', Object.keys(this.managers).filter(k => this.managers[k] !== null));
        console.groupEnd();
    }

    /**
     * 设置旧的全局引用（向后兼容）
     * @private
     */
    _setupLegacyAliases() {
        // 注意：这些别名会在未来版本中逐步移除
        // 新代码应该使用 window.app.xxx 而不是 window.xxx
    }

    /**
     * 清理资源（插件卸载时调用）
     */
    destroy() {
        // 清理事件监听器
        if (this.tools.eventManager) {
            this.tools.eventManager.clearAll();
        }

        // 清理进度条
        if (this.tools.progressBar) {
            this.tools.progressBar.clearAll();
        }

        // 清理批量队列
        if (this.tools.batchHelper) {
            this.tools.batchHelper.clear();
        }

        console.log('[App] 资源已清理');
    }
}

// 创建全局应用实例
window.app = new App();

// 开发环境：将 app 暴露到控制台
if (typeof console !== 'undefined') {
    console.log(`
╔════════════════════════════════════════╗
║   漫画汉化工作台 v${window.app.version}   ║
║   构建日期: ${window.app.buildDate}      ║
║   命名空间: window.app                  ║
╚════════════════════════════════════════╝

使用 app.debug() 查看详细信息
    `);
}

/**
 * 便捷的全局辅助函数（可选）
 */

// 快速访问工具
window.getTool = function(name) {
    return window.app.getTool(name);
};

// 快速访问管理器
window.getManager = function(name) {
    return window.app.getManager(name);
};

// 全局调试快捷方式
window.appDebug = function() {
    window.app.debug();
};
