window.onload = function () {
    // 监听导航标签切换
    const navBtns = document.querySelectorAll('.nav-btn');
    const panels = document.querySelectorAll('.panel');

    navBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            // 重置状态
            navBtns.forEach(b => b.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));

            // 激活当前点击的标签及对应面板
            this.classList.add('active');
            const targetId = this.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
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

    // 我们在此告诉系统要加载哪些模块文件
    const jsxModules = [
        "jsx/json2.jsx",       // 必须第一个加载，为 ExtendScript(ES3) 补全 JSON.parse/stringify
        "jsx/main.jsx",
        "jsx/pageManager.jsx",
        "jsx/compare.jsx",
        "jsx/typeset.jsx",
        "jsx/style.jsx",
        "jsx/retouch.jsx"
    ];

    // IMPORTANT:
    // cs.evalScript 是异步的；如果用 forEach 并发加载，会导致模块加载顺序不确定
    // （json2.jsx 可能还没加载完就执行了依赖 JSON 的脚本）。
    // 这里改为严格串行加载，且每个文件只加载一次。
    function loadJsxModulesSerial(modules, done) {
        let i = 0;
        const next = () => {
            if (i >= modules.length) {
                if (done) done();
                return;
            }
            const modulePath = modules[i++];
            const absPath = extPath + "/" + modulePath;
            const safeAbsPath = absPath.replace(/\\/g, '\\\\');
            cs.evalScript(`$.evalFile("${safeAbsPath}")`, next);
        };
        next();
    }

    // 确保数据目录存在 (放置 font 缓存、收藏、最近使用等 json 文件)
    // 统一使用插件自身的 data/ 目录，便于直接读取预置的 font-cn-cache.json
    const dataDir = extPath + "/data";
    const dirResult = window.cep.fs.stat(dataDir);
    if (dirResult.err !== window.cep.fs.NO_ERROR) {
        window.cep.fs.makedir(dataDir);
    }

    // --- 实例化各模块的前端逻辑 ---
    // 延迟初始化，确保所有 DOM 和 JSX 模块已准备就绪
    function initPanels() {
        window.pageManager = new PageManager(cs, extPath, dataDir);
        window.typesetManager = new TypesetManager(cs, extPath, dataDir);
        window.styleManager = new StyleManager(cs, extPath, dataDir);
        window.fxManager = new FxManager(cs, extPath, dataDir);
        window.retouchManager = new RetouchManager(cs, extPath, dataDir);
        window.fontManager = new FontManager(cs, extPath, dataDir);
        window.presetsManager = new PresetsManager(cs, extPath, dataDir);

        // 原图对比的旧逻辑在 pageManager.js 中已重构，这里仅保留以防万一
        const btnCompare = document.getElementById('btn-toggle-compare');
        if (btnCompare && !window.pageManager) { // 仅当 pageManager 未初始化时才执行旧逻辑
            btnCompare.addEventListener('click', () => {
                cs.evalScript(`backupOriginalLayer()`, () => cs.evalScript(`toggleOriginalCompare()`));
                btnCompare.classList.toggle('active-contrast');
                btnCompare.innerText = btnCompare.classList.contains('active-contrast')
                    ? "👁️ 隐藏原图查看嵌字 (长按对比)"
                    : "👀 点击开启原图对比";
            });
        }
    }

    // 串行加载全部 JSX 后再初始化各面板
    loadJsxModulesSerial(jsxModules, () => {
        setTimeout(initPanels, 100); // 双重保险：确保 DOM/JSX 均已准备就绪
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
