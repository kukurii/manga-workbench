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
        "jsx/main.jsx",
        "jsx/pageManager.jsx",
        "jsx/compare.jsx",
        "jsx/typeset.jsx",
        "jsx/style.jsx",
        "jsx/retouch.jsx"
    ];

    jsxModules.forEach(modulePath => {
        // 利用绝对路径强制 PS 也就是 ExtendScript 读取载入。
        // $.evalFile 在 ExtendScript 中用于加载外部脚本
        const absPath = extPath + "/" + modulePath;
        cs.evalScript(`$.evalFile("${absPath.replace(/\\/g, '\\\\')}");`);
    });

    // 确保数据隔离目录存在 (放置 json 等缓存文件)
    // 【第十一阶段重构】：从有更新覆写风险的 extPath/data 迁移至安全的 USER_DATA
    const userDataPath = cs.getSystemPath(SystemPath.USER_DATA);
    const dataDir = userDataPath + "/MangaWorkbenchData";
    const dirResult = window.cep.fs.stat(dataDir);
    if (dirResult.err !== window.cep.fs.NO_ERROR) {
        window.cep.fs.makedir(dataDir);
    }

    // --- 实例化各模块的前端逻辑 ---
    window.pageManager = new PageManager(cs, extPath, dataDir);
    window.typesetManager = new TypesetManager(cs, extPath, dataDir);
    window.styleManager = new StyleManager(cs, extPath, dataDir);
    window.fxManager = new FxManager(cs, extPath, dataDir);
    window.retouchManager = new RetouchManager(cs, extPath, dataDir);
    window.fontManager = new FontManager(cs, extPath, dataDir);
    window.presetsManager = new PresetsManager(cs, extPath, dataDir);

    // 原图对比快捷操作
    const btnCompare = document.getElementById('btn-toggle-compare');
    if (btnCompare) {
        btnCompare.addEventListener('click', () => {
            // 先尝试运行一次备份，再执行切换以确保已经备份过了
            cs.evalScript(`backupOriginalLayer()`, function (res) {
                cs.evalScript(`toggleOriginalCompare()`);
            });
            // 切换按钮高亮状态
            btnCompare.classList.toggle('active-contrast');
            if (btnCompare.classList.contains('active-contrast')) {
                btnCompare.innerText = "👁️ 隐藏原图查看嵌字 (长按对比)";
            } else {
                btnCompare.innerText = "👀 点击开启原图对比";
            }
        });

        // 允许长按对比
        let tHover;
        btnCompare.addEventListener('mousedown', () => {
            if (!btnCompare.classList.contains('active-contrast')) {
                cs.evalScript(`backupOriginalLayer()`, () => {
                    cs.evalScript(`toggleOriginalCompare()`);
                });
            }
        });
        btnCompare.addEventListener('mouseup', () => {
            if (!btnCompare.classList.contains('active-contrast')) {
                cs.evalScript(`toggleOriginalCompare()`);
            }
        });
        btnCompare.addEventListener('mouseleave', () => {
            if (!btnCompare.classList.contains('active-contrast')) {
                // 如果本来就没常开，鼠标移出时确保关闭
                cs.evalScript(`
                 var d=app.activeDocument;
                 for(var i=0;i<d.layers.length;i++){
                    if(d.layers[i].name==="【原图参考】") d.layers[i].visible=false;
                 }
               `);
            }
        });
    }
};
