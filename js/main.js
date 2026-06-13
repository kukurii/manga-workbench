// ═══════════════════════════════════════
// 全局工具：自定义颜色选择器
// ═══════════════════════════════════════

/**
 * ColorPicker — 管理页面内所有自定义颜色选择器
 * HTML 结构：.cp-wrap[data-cp-id][data-cp-value] > .cp-swatch + .cp-panel
 */
(function () {
    // 预设颜色面板色板（16色）
    const PRESETS = [
        '#000000', '#ffffff', '#808080', '#c0c0c0',
        '#ff0000', '#ff6600', '#ffff00', '#00cc00',
        '#00ccff', '#0066ff', '#6600ff', '#ff00ff',
        '#994400', '#006633', '#003399', '#660033'
    ];

    function buildPanel(wrap) {
        const panel = wrap.querySelector('.cp-panel');
        if (panel.dataset.built) return;
        panel.dataset.built = '1';

        // 色板网格
        const grid = document.createElement('div');
        grid.className = 'cp-swatches';
        PRESETS.forEach(color => {
            const btn = document.createElement('button');
            btn.className = 'cp-color-btn';
            btn.style.background = color;
            btn.title = color;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                applyColor(wrap, color);
                closePanel(wrap);
            });
            grid.appendChild(btn);
        });
        panel.appendChild(grid);

        // Hex 输入行
        const hexRow = document.createElement('div');
        hexRow.className = 'cp-hex-row';
        const hexLabel = document.createElement('span');
        hexLabel.className = 'cp-hex-label';
        hexLabel.textContent = '#';
        const hexInput = document.createElement('input');
        hexInput.className = 'cp-hex-input';
        hexInput.maxLength = 6;
        hexInput.placeholder = 'rrggbb';
        hexInput.value = (wrap.dataset.cpValue || '#000000').replace('#', '');

        hexInput.addEventListener('click', e => e.stopPropagation());
        hexInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = '#' + hexInput.value.replace(/[^0-9a-fA-F]/g, '').substring(0, 6);
                if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                    applyColor(wrap, val);
                    closePanel(wrap);
                }
            }
        });
        hexRow.appendChild(hexLabel);
        hexRow.appendChild(hexInput);
        panel.appendChild(hexRow);
    }

    function applyColor(wrap, hex) {
        wrap.dataset.cpValue = hex;
        const swatch = wrap.querySelector('.cp-swatch');
        if (swatch) swatch.style.background = hex;
        // 更新 hex 输入框（如果面板已构建）
        const hexInput = wrap.querySelector('.cp-hex-input');
        if (hexInput) hexInput.value = hex.replace('#', '');
        // 更新选中标记
        wrap.querySelectorAll('.cp-color-btn').forEach(btn => {
            btn.classList.toggle('cp-selected', btn.style.background === hexToRgb(hex));
        });
    }

    function hexToRgb(hex) {
        // 用于比较，返回 CSS rgb() 字符串格式
        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0, 2), 16);
        const g = parseInt(h.substring(2, 4), 16);
        const b = parseInt(h.substring(4, 6), 16);
        return `rgb(${r}, ${g}, ${b})`;
    }

    function openPanel(wrap) {
        buildPanel(wrap);
        const panel = wrap.querySelector('.cp-panel');
        // 同步当前值到 hex 输入框
        const hexInput = panel.querySelector('.cp-hex-input');
        if (hexInput) hexInput.value = (wrap.dataset.cpValue || '#000000').replace('#', '');
        panel.style.display = 'block';
        wrap.dataset.open = '1';
    }

    function closePanel(wrap) {
        const panel = wrap.querySelector('.cp-panel');
        if (panel) panel.style.display = 'none';
        delete wrap.dataset.open;
    }

    function closeAll(except) {
        document.querySelectorAll('.cp-wrap[data-open]').forEach(w => {
            if (w !== except) closePanel(w);
        });
    }

    // 初始化所有颜色选择器
    function initAll() {
        document.querySelectorAll('.cp-wrap').forEach(wrap => {
            const swatch = wrap.querySelector('.cp-swatch');
            if (!swatch) return;
            swatch.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = wrap.dataset.open === '1';
                closeAll(wrap);
                if (isOpen) {
                    closePanel(wrap);
                } else {
                    openPanel(wrap);
                }
            });
        });

        // 点击文档其他区域关闭所有面板
        document.addEventListener('click', () => closeAll(null));
    }

    // 暴露全局读取函数（供各模块获取颜色值）
    window.getPickerColor = function (cpId) {
        const wrap = document.querySelector(`.cp-wrap[data-cp-id="${cpId}"]`);
        return wrap ? (wrap.dataset.cpValue || '#000000') : '#000000';
    };

    window.setPickerColor = function (cpId, hex) {
        const wrap = document.querySelector(`.cp-wrap[data-cp-id="${cpId}"]`);
        if (wrap) applyColor(wrap, hex);
    };

    // DOM 加载后执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }
})();


// ═══════════════════════════════════════
// 全局工具：Toast 通知
// ═══════════════════════════════════════

/**
 * 弹出轻量 Toast 通知（自动消失）
 * @param {string} msg 消息内容
 * @param {'info'|'success'|'error'} type 类型
 * @param {number} duration 毫秒，默认 3000
 */
window.showToast = function (msg, type, duration) {
    const container = document.getElementById('toast-container');
    if (!container) { console.warn('[toast]', msg); return; }

    duration = duration || 3000;
    const toast = document.createElement('div');
    toast.className = 'toast';
    if (type === 'error') toast.className += ' toast--error';
    else if (type === 'success') toast.className += ' toast--success';
    else if (type === 'warning') toast.className += ' toast--warning';
    toast.textContent = window.normalizeUIString ? window.normalizeUIString(msg) : msg;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastOut .25s ease forwards';
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 280);
    }, duration);
};


// ═══════════════════════════════════════
// 全局工具：自定义 Alert Modal
// ═══════════════════════════════════════

/**
 * 替代 alert()，使用自定义弹窗
 * @param {string} msg 消息
 * @param {string} [title] 标题，默认"提示"
 * @param {Function} [onOk] 点击确定后回调
 */
window.showAlertModal = function (msg, title, onOk) {
    const overlay = document.getElementById('modal-alert');
    if (!overlay) { alert(msg); if (onOk) onOk(); return; }

    // 一次性赋值，同时做乱码兜底处理
    const normAlert = window.normalizeUIString || function(v) { return v; };
    document.getElementById('modal-alert-title').textContent = normAlert(title || '提示');
    document.getElementById('modal-alert-msg').textContent = normAlert(msg);
    overlay.classList.add('show');

    const btn = document.getElementById('btn-alert-ok');
    const handler = function () {
        overlay.classList.remove('show');
        btn.removeEventListener('click', handler);
        if (onOk) onOk();
    };
    btn.addEventListener('click', handler);
};


// ═══════════════════════════════════════
// 全局工具：自定义 Confirm Modal
// ═══════════════════════════════════════

/**
 * 替代 confirm()，使用自定义弹窗
 * @param {string} msg 消息
 * @param {Function} onOk 确认回调
 * @param {Function} [onCancel] 取消回调
 * @param {string} [title] 标题，默认"确认操作"
 */
window.showConfirmModal = function (msg, onOk, onCancel, title) {
    const overlay = document.getElementById('modal-confirm');
    if (!overlay) {
        if (confirm(msg)) {
            if (onOk) onOk();
        } else {
            if (onCancel) onCancel();
        }
        return;
    }

    // 一次性赋值，同时做乱码兜底处理
    const normConfirm = window.normalizeUIString || function(v) { return v; };
    document.getElementById('modal-confirm-title').textContent = normConfirm(title || '确认操作');
    document.getElementById('modal-confirm-msg').textContent = normConfirm(msg);
    overlay.classList.add('show');

    const btnOk = document.getElementById('btn-confirm-ok');
    const btnCancel = document.getElementById('btn-confirm-cancel');

    function cleanup() {
        overlay.classList.remove('show');
        btnOk.removeEventListener('click', handleOk);
        btnCancel.removeEventListener('click', handleCancel);
    }
    
    function handleOk() { cleanup(); if (onOk) onOk(); }
    function handleCancel() { cleanup(); if (onCancel) onCancel(); }

    btnOk.addEventListener('click', handleOk);
    btnCancel.addEventListener('click', handleCancel);
};


// ═══════════════════════════════════════
// 全局工具：自定义 Prompt Modal
// ═══════════════════════════════════════

/**
 * 替代 prompt()，使用自定义弹窗，通过 callback 返回输入值
 * @param {string} desc 说明文字
 * @param {string} defaultVal 默认值
 * @param {Function} callback function(value|null)
 * @param {string} [title] 标题，默认"输入"
 */
window.showPromptModal = function (desc, defaultVal, callback, title) {
    const overlay = document.getElementById('modal-prompt');
    if (!overlay) {
        const val = prompt(desc, defaultVal);
        callback(val);
        return;
    }

    // 一次性赋值，同时做乱码兜底处理
    const normPrompt = window.normalizeUIString || function(v) { return v; };
    document.getElementById('modal-prompt-title').textContent = normPrompt(title || '输入');
    document.getElementById('modal-prompt-desc').textContent = normPrompt(desc);
    const input = document.getElementById('modal-prompt-input');
    input.value = defaultVal || '';
    overlay.classList.add('show');
    setTimeout(() => input.focus(), 80);

    const btnOk = document.getElementById('btn-prompt-ok');
    const btnCancel = document.getElementById('btn-prompt-cancel');

    // 追踪 IME（输入法）组合状态：中文拼音选字期间不触发 Enter/Escape
    let isComposing = false;

    function cleanup() {
        overlay.classList.remove('show');
        btnOk.removeEventListener('click', onOk);
        btnCancel.removeEventListener('click', onCancel);
        input.removeEventListener('keydown', onKey);
        input.removeEventListener('compositionstart', onCompositionStart);
        input.removeEventListener('compositionend', onCompositionEnd);
    }
    function onOk() { const v = input.value; cleanup(); callback(v); }
    function onCancel() { cleanup(); callback(null); }

    // compositionstart：用户开始用输入法输拼音（组合开始）
    function onCompositionStart() { isComposing = true; }
    // compositionend：用户完成选字，汉字已写入输入框（组合结束）
    function onCompositionEnd() { isComposing = false; }

    function onKey(e) {
        // 阻止事件冒泡，防止 CEP 宿主层拦截输入法的组合按键
        e.stopPropagation();
        // 如果正在 IME 组合输入（如：正在选汉字），不响应 Enter/Escape
        if (isComposing || e.isComposing) return;
        if (e.key === 'Enter') onOk();
        if (e.key === 'Escape') onCancel();
    }

    btnOk.addEventListener('click', onOk);
    btnCancel.addEventListener('click', onCancel);
    input.addEventListener('keydown', onKey);
    input.addEventListener('compositionstart', onCompositionStart);
    input.addEventListener('compositionend', onCompositionEnd);
};

window.callHostScript = function (csInterface, fnName, args, callback, options) {
    if (!csInterface || typeof csInterface.evalScript !== 'function') {
        if (typeof callback === 'function') callback('ERROR: CSInterface unavailable');
        return;
    }

    const serializedArgs = (args || []).map(arg => JSON.stringify(arg)).join(', ');
    const script = `${fnName}(${serializedArgs})`;

    // 【优化】支持批量调用模式和超时控制
    options = options || {};
    const timeout = options.timeout || 30000; // 默认 30 秒超时

    // 创建超时包装的回调
    let timeoutId = null;
    let completed = false;
    const wrappedCallback = function(result) {
        if (completed) return; // 防止超时和正常返回同时触发
        completed = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (callback) callback(result);
    };

    // 设置超时定时器
    timeoutId = setTimeout(() => {
        if (completed) return;
        completed = true;
        console.warn(`[Timeout] ${fnName} 超时 (${timeout}ms)`);
        if (callback) callback('ERROR: 操作超时，Photoshop 可能卡住或正在处理大文件');
    }, timeout);

    if (options.batch && window.batchHelper) {
        // 使用批量助手收集调用，减少通信开销
        window.batchHelper.enqueue(script, wrappedCallback, options.immediate);
    } else {
        // 传统模式：直接调用
        csInterface.evalScript(script, wrappedCallback);
    }
};

window.normalizeUIString = function (value) {
    if (typeof value !== 'string' || !value) return value;

    const replacements = [
        ['姝ｅ湪鍞よ捣鏂囦欢閫夋嫨鍣?..', '正在打开文件选择器...'],
        ['闃熷垪涓虹┖', '页面队列为空'],
        ['璇峰厛鐐瑰嚮椤甸潰鍒楄〃涓殑涓€涓〉闈互婵€娲诲畠', '请先在列表中选中一个页面'],
        ['椤甸潰鍒楄〃涓虹┖', '页面列表为空'],
        ['鍏ㄩ儴椤甸潰鍧囧凡瀹屾垚锛?', '全部页面都已完成'],
        ['褰撳墠鍒楄〃涓虹┖锛屾棤鍥惧彲瀵?', '当前列表为空，没有可导出的页面'],
        ['璇峰厛閫夋嫨瀵煎嚭鏂囦欢澶?', '请先选择导出文件夹'],
        ['鎵归噺瀵煎嚭缁撴灉', '批量导出结果'],
        ['鎵归噺淇濆瓨缁撴灉', '批量保存结果'],
        ['鏆傛棤椤甸潰锛岃鐐瑰嚮涓婃柟鎸夐挳瀵煎叆', '暂无页面，请点击上方按钮导入'],
        ['褰撳墠绛涢€変笅娌℃湁椤甸潰', '当前筛选下没有页面'],
        ['閫夊彇璇ラ〉', '选中该页'],
        ['Parsed ', '解析完成：'],
        [' pages, ', ' 页，'],
        [' dialogs. Press Ctrl+Enter to reparse.', ' 条对白。可用 Ctrl+Enter 快速重新解析。'],
        ['Changed', '已修改'],
        ['绛夊緟淇浘鎿嶄綔...', '等待修图操作...']
    ];

    let text = value;
    replacements.forEach(([from, to]) => {
        text = text.split(from).join(to);
    });
    return text;
};

window.onload = function () {

    // 监听导航标签切换
    const navBtns = document.querySelectorAll('.nav-btn');
    const panels = document.querySelectorAll('.panel');

    navBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const targetId = this.getAttribute('data-target');

            // 【优化】延迟加载：首次切换到面板时加载对应的 JSX 模块和管理器
            loadPanelModules(targetId, () => {
                initPanelManager(targetId);

                // 重置状态
                navBtns.forEach(b => b.classList.remove('active'));
                panels.forEach(p => p.classList.remove('active'));

                // 激活当前点击的标签及对应面板
                this.classList.add('active');
                document.getElementById(targetId).classList.add('active');

                // 【优化】同步面板状态到 app
                window.app.switchPanel(targetId);
            });
        });
    });

    // 绑定联通性测试按钮点击事件
    const btnTest = document.getElementById('btn-test-ps-conn');
    const responseBox = document.getElementById('ps-response');

    if (btnTest) {
        btnTest.addEventListener('click', function () {
            try {
                // 初始化 CEP 通信接口 CSInterface
                const csInterface = new CSInterface();
                const msg = "【漫画汉化工作台】来自 HTML 前端的调用测试！";

                responseBox.innerText = "正在发送请求到 ExtendScript...";
                // ... 省略测试返回...
            } catch (e) {
                console.error(e);
            }
        });
    }

    // --- 动态加载 JSX 后端文件，完美避开相对路径坑 ---
    const cs = new CSInterface();
    const extPath = cs.getSystemPath(SystemPath.EXTENSION);

    // 确保数据目录存在 (放置 font 缓存、收藏、最近使用等 json 文件)
    // 统一使用插件自身的 data/ 目录，便于直接读取预置的 font-cn-cache.json
    const dataDir = extPath + "/data";
    const dirResult = window.cep.fs.stat(dataDir);
    if (dirResult.err !== window.cep.fs.NO_ERROR) {
        window.cep.fs.makedir(dataDir);
    }

    // 【优化】初始化应用命名空间
    window.app.init(cs, extPath, dataDir);

    // 【优化】初始化批量调用助手（减少 evalScript 通信开销）
    window.batchHelper = new BatchHelper(cs);

    // 【优化】模块延迟加载策略：
    // 1. 核心模块：立即加载（json2, main, pageManager）
    // 2. 功能模块：首次使用面板时才加载
    const coreModules = [
        "jsx/json2.jsx",       // 必须第一个加载，为 ExtendScript(ES3) 补全 JSON.parse/stringify
        "jsx/main.jsx",
        "jsx/pageManager.jsx"  // 页面管理是最常用功能，提前加载
    ];

    // 延迟加载模块映射表（面板 ID → JSX 文件）
    const lazyModules = {
        'panel-typeset': ["jsx/typeset.jsx"],
        'panel-style': ["jsx/style.jsx"],
        'panel-retouch': ["jsx/retouch.jsx", "jsx/compare.jsx"],
        'panel-fx': [],  // FX 面板暂无独立 JSX
        'panel-font': [], // 字体管理纯前端逻辑
        'panel-settings': []
    };

    // 记录已加载的模块，避免重复加载
    const loadedModules = new Set();

    // 串行加载多个 JSX 模块
    function loadJsxModulesSerial(modules, done) {
        let i = 0;
        const next = () => {
            if (i >= modules.length) {
                if (done) done();
                return;
            }
            const modulePath = modules[i++];
            // 跳过已加载的模块
            if (loadedModules.has(modulePath)) {
                next();
                return;
            }
            const absPath = extPath + "/" + modulePath;
            const safeAbsPath = absPath.replace(/\\/g, '\\\\');
            cs.evalScript(`$.evalFile("${safeAbsPath}")`, (result) => {
                loadedModules.add(modulePath);
                next();
            });
        };
        next();
    }

    // 延迟加载指定面板的 JSX 模块
    function loadPanelModules(panelId, callback) {
        const modules = lazyModules[panelId];
        if (!modules || modules.length === 0) {
            if (callback) callback();
            return;
        }
        // 过滤出尚未加载的模块
        const pending = modules.filter(m => !loadedModules.has(m));
        if (pending.length === 0) {
            if (callback) callback();
            return;
        }
        loadJsxModulesSerial(pending, callback);
    }

    // --- 实例化各模块的前端逻辑 ---
    // 【优化】改为按需初始化，避免启动时实例化所有管理器
    const managers = {}; // 存储已实例化的管理器

    // 初始化指定面板的管理器
    function initPanelManager(panelId) {
        if (managers[panelId]) return; // 已初始化，跳过

        switch(panelId) {
            case 'panel-page':
                if (!window.pageManager) {
                    window.pageManager = new PageManager(cs, extPath, dataDir);
                    managers[panelId] = window.pageManager;
                    // 【优化】注册到 app 命名空间
                    window.app.registerManager('page', window.pageManager);
                }
                break;
            case 'panel-typeset':
                if (!window.typesetManager) {
                    window.typesetManager = new TypesetManager(cs, extPath, dataDir);
                    managers[panelId] = window.typesetManager;
                    window.app.registerManager('typeset', window.typesetManager);
                }
                break;
            case 'panel-style':
                if (!window.styleManager) {
                    window.styleManager = new StyleManager(cs, extPath, dataDir);
                    managers[panelId] = window.styleManager;
                    window.app.registerManager('style', window.styleManager);
                }
                break;
            case 'panel-fx':
                if (!window.fxManager) {
                    window.fxManager = new FxManager(cs, extPath, dataDir);
                    managers[panelId] = window.fxManager;
                    window.app.registerManager('fx', window.fxManager);
                }
                break;
            case 'panel-retouch':
                if (!window.retouchManager) {
                    window.retouchManager = new RetouchManager(cs, extPath, dataDir);
                    managers[panelId] = window.retouchManager;
                    window.app.registerManager('retouch', window.retouchManager);
                }
                break;
            case 'panel-font':
                if (!window.fontManager) {
                    window.fontManager = new FontManager(cs, extPath, dataDir);
                    managers[panelId] = window.fontManager;
                    window.app.registerManager('font', window.fontManager);
                }
                break;
            case 'panel-settings':
                if (!window.presetsManager) {
                    window.presetsManager = new PresetsManager(cs, extPath, dataDir);
                    managers[panelId] = window.presetsManager;
                    window.app.registerManager('presets', window.presetsManager);
                }
                break;
        }
    }

    // 【优化】仅加载核心模块，其他模块按需加载
    loadJsxModulesSerial(coreModules, () => {
        // 核心模块加载完成，立即初始化页面管理器（默认激活面板）
        setTimeout(() => {
            initPanelManager('panel-page');
            // 隐藏加载指示器（如果有）
            const loader = document.getElementById('startup-loader');
            if (loader) loader.style.display = 'none';
        }, 100);
    });

    // 原图对比快捷操作（此部分逻辑已移至 pageManager.js，为安全起见注释掉旧代码）
    /* const btnCompare = document.getElementById('btn-toggle-compare');
    if (btnCompare) {
        btnCompare.addEventListener('click', () => {
            // ...
        });
    }
    */
};
