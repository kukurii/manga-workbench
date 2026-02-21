// retouch.jsx - 修图相关的 Photoshop ExtendScript

/**
 * 辅助：检查是否有可用选区
 */
function hasSelection(doc) {
    try {
        var b = doc.selection.bounds;
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * 辅助：切换 Photoshop 的左侧工具栏至指定工具
 */
function switchTool(toolStringID) {
    try {
        var idslct = charIDToTypeID("slct");
        var desc = new ActionDescriptor();
        var idnull = charIDToTypeID("null");
        var ref = new ActionReference();
        var idTool = stringIDToTypeID(toolStringID);
        ref.putClass(idTool);
        desc.putReference(idnull, ref);
        executeAction(idslct, desc, DialogModes.NO);
        return "true";
    } catch (e) {
        return "false";
    }
}

/**
 * 核心：一键去字 (扩展选区 -> 在独立修图中采样全图进行内容感知填充 -> 取消选区)
 * 【第七阶段重构: 非破坏性修图】
 */
function autoEraseSelection(expandPx) {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;
        var layer = doc.activeLayer;

        if (!hasSelection(doc)) {
            return "失败：请先使用魔棒、套索等工具框选需要去除的文字或图案！";
        }

        // --- 预处理：扩展选区避免遗漏边缘抗锯齿像素 ---
        expandPx = parseInt(expandPx) || 3;
        try {
            if (expandPx > 0) {
                doc.selection.expand(new UnitValue(expandPx, "px"));
            } else if (expandPx < 0) {
                doc.selection.contract(new UnitValue(Math.abs(expandPx), "px"));
            }
        } catch (e) { }

        // --- 核心隔离：寻找或建立非破坏性专属修补层 ---
        var retouchLayerName = "【修补去字层】";
        var retouchLayer = null;

        // 看看当前用户是不是聪明地已经点在这个层上了（或者名字叫这个层）
        if (layer.name === retouchLayerName && layer.kind === LayerKind.NORMAL) {
            retouchLayer = layer;
        } else {
            // 在所有图层最顶端寻找是否已有这个同名空层
            try {
                retouchLayer = doc.layers.getByName(retouchLayerName);
            } catch (e) {
                // 如果没有，就新建一个放在所有图层最顶端 (排除组)
                retouchLayer = doc.artLayers.add();
                retouchLayer.name = retouchLayerName;
                retouchLayer.move(doc.layers[0], ElementPlacement.PLACEBEFORE);
            }
            doc.activeLayer = retouchLayer;
        }

        // --- 基于 "Sample All Layers" 的 Action Manger 内容感知填充 ---
        // 这一招能够在全透明图层上，吸收底下所有可见画面的像素来进行重绘
        var idFl = charIDToTypeID("Fl  ");
        var desc1 = new ActionDescriptor();
        var idUsng = charIDToTypeID("Usng");
        var idFlCn = charIDToTypeID("FlCn");
        var idContentAware = stringIDToTypeID("contentAware");
        desc1.putEnumerated(idUsng, idFlCn, idContentAware);
        var idOpct = charIDToTypeID("Opct");
        var idPrc = charIDToTypeID("#Prc");
        desc1.putUnitDouble(idOpct, idPrc, 100.000000);
        var idMd = charIDToTypeID("Md  ");
        var idBlnM = charIDToTypeID("BlnM");
        var idNrml = charIDToTypeID("Nrml");
        desc1.putEnumerated(idMd, idBlnM, idNrml);
        // [重头戏在这里!] true 意味着采样所有图层 (Sample All Layers)
        desc1.putBoolean(stringIDToTypeID("sampleAllLayers"), true);

        // 如果用户选区里什么都没有（比如透明层没选区），executeAction 也会立刻抛错
        executeAction(idFl, desc1, DialogModes.NO);

        // 取消选区
        doc.selection.deselect();
        return "去字生成完毕 (位于独立修图层)";
    } catch (e) {
        return "去字构建失败: " + e.toString();
    }
}

/**
 * 气泡白底填充 (扩展选区 -> 填充白色 -> 取消选区)
 */
function fillWhiteSelection(expandPx) {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;

        if (!hasSelection(doc)) {
            return "失败：请先建立选区！";
        }

        expandPx = parseInt(expandPx) || 3;
        try {
            if (expandPx > 0) {
                doc.selection.expand(new UnitValue(expandPx, "px"));
            } else if (expandPx < 0) {
                doc.selection.contract(new UnitValue(Math.abs(expandPx), "px"));
            }
        } catch (e) { }

        var whiteColor = new SolidColor();
        whiteColor.rgb.red = 255;
        whiteColor.rgb.green = 255;
        whiteColor.rgb.blue = 255;

        doc.selection.fill(whiteColor, ColorBlendMode.NORMAL, 100, false);
        doc.selection.deselect();
        return "白底填充成功";
    } catch (e) {
        return "白底填充失败: " + e.toString();
    }
}

/**
 * 进阶：基于色彩范围智能选择特定颜色文字
 * 支持模式：
 * 'black'      - 选取阴影/黑色 (适用于普通白底黑字)
 * 'white'      - 选取高光/白色 (适用于黑底白字或反白)
 * 'foreground' - 根据当前工具条的前景色选取 (用户可以用吸管提色后选取)
 */
function selectByColorRange(mode) {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";

        var idsetd = charIDToTypeID("setd");
        var desc1 = new ActionDescriptor();
        var idnull = charIDToTypeID("null");
        var ref1 = new ActionReference();
        var idChnl = charIDToTypeID("Chnl");
        var idfsel = charIDToTypeID("fsel");
        ref1.putProperty(idChnl, idfsel);
        desc1.putReference(idnull, ref1);
        var idT = charIDToTypeID("T   ");
        var desc2 = new ActionDescriptor();

        // 默认容差 40
        var idFzns = charIDToTypeID("Fzns");
        desc2.putInteger(idFzns, 40);

        if (mode === "black") {
            // 选取阴影 (黑色)
            var idBlck = charIDToTypeID("Blck");
            desc1.putEnumerated(idT, idBlck, idBlck);
        } else if (mode === "white") {
            // 选取高光 (白色)
            var idWht = charIDToTypeID("Wht ");
            desc1.putEnumerated(idT, idWht, idWht);
        } else if (mode === "foreground") {
            // 按照前景色 (Foreground) 选取
            var idssli = charIDToTypeID("ssli");
            var idrgba = stringIDToTypeID("rgba");
            desc2.putEnumerated(idssli, idrgba, idrgba);
            // 模糊处理
            var idRng = stringIDToTypeID("Rng ");
            desc2.putDouble(idRng, 40.000000);

            // 构造 RGB
            var fgColor = app.foregroundColor.rgb;
            var descColor = new ActionDescriptor();
            var idRd = charIDToTypeID("Rd  ");
            descColor.putDouble(idRd, fgColor.red);
            var idGrn = charIDToTypeID("Grn ");
            descColor.putDouble(idGrn, fgColor.green);
            var idBl = charIDToTypeID("Bl  ");
            descColor.putDouble(idBl, fgColor.blue);
            var idRGBC = charIDToTypeID("RGBC");
            desc2.putObject(charIDToTypeID("Clr "), idRGBC, descColor);

            var idRClr = charIDToTypeID("RClr");
            desc1.putObject(idT, idRClr, desc2);
        } else {
            return "错误：不支持的色彩选取模式。";
        }

        executeAction(idsetd, desc1, DialogModes.NO);
        return "选取【" + mode + "】成功";
    } catch (e) {
        return "色彩选区建立失败，请检查图层。" + e.toString();
    }
}

/**
 * 终极智能进阶：一键圈抓全图的“白底黑字”气泡
 *  [原理]
 *  1. 选取全图高光（白色/气泡底）
 *  2. 适度收缩选区 (Contract 20px)，防止被网点纸高光和人物白边干扰
 *  3. 进入相交模式 (Intersect)，强行要求只能选中以上选区内的阴影 (黑色)
 */
function autoSelectBubbles() {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;
        var layer = doc.activeLayer;

        doc.selection.deselect();

        // --- STEP 1: 选取白色 ---
        var idsetdWhite = charIDToTypeID("setd");
        var descW1 = new ActionDescriptor();
        var idnullW = charIDToTypeID("null");
        var refW = new ActionReference();
        refW.putProperty(charIDToTypeID("Chnl"), charIDToTypeID("fsel"));
        descW1.putReference(idnullW, refW);
        var descW2 = new ActionDescriptor();
        descW2.putInteger(charIDToTypeID("Fzns"), 100); // 容差大些
        var idWht = charIDToTypeID("Wht ");
        var idT = charIDToTypeID("T   ");
        descW1.putEnumerated(idT, idWht, idWht);
        descW1.putObject(idT, charIDToTypeID("RClr"), descW2);
        executeAction(idsetdWhite, descW1, DialogModes.NO);

        // 如果连白色都没有直接退出
        if (!hasSelection(doc)) return "失败：此页面可能没有白色气泡底。";

        // --- STEP 2: 收缩选区 ---
        // 这一步极为关键，可以剔除线条夹角的纯白高光，保证只留下成片的大气泡
        doc.selection.contract(new UnitValue(12, "px"));

        // 我们甚至需要再羽化一点，不让边界太生硬
        // 避免因为压缩过猛漏过贴着气泡边缘的字
        doc.selection.expand(new UnitValue(5, "px"));

        // --- STEP 3: 和黑色执行相交 (Intersect) ---
        // 等效于按住 Alt+Shift 用魔棒选黑色
        var idsetdBlack = charIDToTypeID("setd");
        var descB1 = new ActionDescriptor();
        var refB = new ActionReference();
        refB.putProperty(charIDToTypeID("Chnl"), charIDToTypeID("fsel"));
        descB1.putReference(charIDToTypeID("null"), refB);
        var descB2 = new ActionDescriptor();
        descB2.putInteger(charIDToTypeID("Fzns"), 60);
        var idBlck = charIDToTypeID("Blck");
        descB1.putEnumerated(idT, idBlck, idBlck);
        descB1.putObject(idT, charIDToTypeID("RClr"), descB2);

        // 关键相交指令，ActionManager 的 Intersect 需要传入当前 Selection 作为来源并进行通道操作
        // 不过有个更直接的黑客做法：直接呼叫选区覆盖，但带上相交参数。
        // Photoshop原生里不支持一次性选色同时相交。所以通过 JS 拷贝存为通道或依靠 ExtendScript 选区交叉能力。

        // [迂回方案]：先将气泡白底存为 Alpha 通道
        var bubbleChannel = doc.channels.add();
        bubbleChannel.name = "TempBubbleZone";
        bubbleChannel.kind = ChannelType.SELECTEDAREA;
        doc.selection.store(bubbleChannel, SelectionType.REPLACE);
        doc.selection.deselect();

        // [迂回步骤2]：选全图黑字
        executeAction(idsetdBlack, descB1, DialogModes.NO);

        // [迂回步骤3]：以相交模式加载 Alpha 通道
        var idsetdIntersect = charIDToTypeID("setd");
        var descInt1 = new ActionDescriptor();
        var refIntTarget = new ActionReference();
        refIntTarget.putProperty(charIDToTypeID("Chnl"), charIDToTypeID("fsel"));
        descInt1.putReference(charIDToTypeID("null"), refIntTarget);
        var refIntSrc = new ActionReference();
        refIntSrc.putName(charIDToTypeID("Chnl"), "TempBubbleZone");
        descInt1.putReference(charIDToTypeID("T   "), refIntSrc);

        var executeIntersect = true;
        try {
            // Action Manager Intersect (以当前选区底盘，叠加 Alpha 相交)
            var idIntr = charIDToTypeID("Intr");
            var tempDesc = new ActionDescriptor();
            tempDesc.putReference(charIDToTypeID("null"), refIntTarget);
            tempDesc.putReference(charIDToTypeID("From"), refIntSrc);
            executeAction(idIntr, tempDesc, DialogModes.NO);
        } catch (e) {
            executeIntersect = false;
        }

        // 扫尾删除通道
        try { bubbleChannel.remove(); } catch (e) { }

        if (executeIntersect && hasSelection(doc)) {
            return "侦测完毕，已框选全画板位于浅色气泡内的深色文字！\n接下来请检查并点击【一键去字】即可。";
        } else {
            // 没找到或者出错了
            doc.selection.deselect();
            return "失败：算法未能提取到气泡内的文字相交信息。请调整图片灰度后再试。";
        }

    } catch (e) {
        return "气泡侦测算法执行中断: " + e.toString();
    }
}
