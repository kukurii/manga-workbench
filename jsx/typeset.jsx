// typeset.jsx - 嵌字排版相关的 Photoshop ExtendScript

/**
 * 获取当前 PS 环境所有的字体列表
 * 已废弃：直接转 JSON 传给前端容易因数据量过大造成 PS 进程卡死
 */
function getInstalledFonts() {
    return "[]";
}

/**
 * 极速版字体拉取：提取后直接写为本地缓存文件，避开 CEP String 传输上限
 */
function generateFontCacheFile(exportPath) {
    try {
        var count = app.fonts.length;
        var strChunks = [];
        strChunks.push("[");

        for (var i = 0; i < count; i++) {
            var f = app.fonts[i];
            // 过滤双引号等非法字符
            var fName = f.name.replace(/"/g, '\\"');
            var fPsName = f.postScriptName.replace(/"/g, '\\"');
            strChunks.push('{"name":"' + fName + '", "postScriptName":"' + fPsName + '"}');
            if (i < count - 1) strChunks.push(",");
        }
        strChunks.push("]");
        var jsonStr = strChunks.join("");

        var file = new File(exportPath);
        file.encoding = "UTF8";
        file.open("w");
        file.write(jsonStr);
        file.close();

        return "SUCCESS";
    } catch (e) {
        return "ERROR: " + e.toString();
    }
}

/**
 * 将整页翻译文稿生成文本图层，避免全部重叠
 */
function generateTextLayersBulk(dialogsJson, styleJson) {
    try {
        if (app.documents.length === 0) return "错误：当前 Photoshop 没有打开任何文档进行放置。";

        var doc = app.activeDocument;
        var dialogs = eval("(" + dialogsJson + ")");
        var styleParams = eval("(" + styleJson + ")");

        // 创建或获取【翻译文字】图层组
        var groupName = "【翻译文字】";
        var txtGroup;
        try {
            txtGroup = doc.layerSets.getByName(groupName);
        } catch (e) {
            txtGroup = doc.layerSets.add();
            txtGroup.name = groupName;
        }

        // 将翻译文字置于顶层
        txtGroup.move(doc.layers[0], ElementPlacement.PLACEBEFORE);

        // 简单计算画板总高度，以便于将文本纵向瀑布流排开避免完全堆叠
        var docHeight = doc.height.as("px");

        for (var i = 0; i < dialogs.length; i++) { // 创建新的文本图层
            var diag = dialogs[i];
            var textLayer = txtGroup.artLayers.add();
            textLayer.kind = LayerKind.TEXT;
            textLayer.name = diag.id; // 使用对话ID作为图层名

            var textItem = textLayer.textItem;
            // 预处理换行和简单的标点替换：自动将半角问号叹号转成全角
            var content = diag.text.replace(/\\n/g, '\r').replace(/\?/g, '？').replace(/\!/g, '！');
            textItem.contents = content;

            // 基础样式
            try {
                // 读取并在竖排和横排间切换以匹配不同需求（日漫/韩漫）
                if (styleParams.direction === 'HORIZONTAL') {
                    textItem.direction = Direction.HORIZONTAL;
                } else {
                    textItem.direction = Direction.VERTICAL;
                }

                // 应用传入的字号
                var fontSize = styleParams.fontSize ? parseFloat(styleParams.fontSize) : 16;
                textItem.size = new UnitValue(fontSize, "pt");

                // 应用传入的字体 (必须使用 postScriptName)
                if (styleParams.fontPostScriptName && styleParams.fontPostScriptName !== "") {
                    textItem.font = styleParams.fontPostScriptName;
                }

                textItem.useAutoLeading = true;
                textItem.justification = Justification.LEFT;
            } catch (e) { }

            // 计算排版位置并挪移图层：防止所有图层诞生在相同的坐标导致难点选
            // X轴横向瀑布流
            var startX = 200 + ((i % 5) * 60);
            // Y轴阶梯递增
            var startY = 100 + (Math.floor(i / 5) * 200);

            // 若超出了画板边界就统一堆在最后
            if (startY > docHeight - 50) {
                startY = docHeight - 80;
                startX = 60 + ((i % 5) * 40); // 往侧边偏移点
            }

            textItem.position = [new UnitValue(startX, "px"), new UnitValue(startY, "px")];
        }

        // 选中刚创建的组
        doc.activeLayer = txtGroup;

        return "批量生成文本结束，共 " + dialogs.length + " 个图层。";
    } catch (e) {
        return "生成图层时发生错误: " + e.toString();
    }
}

/**
 * 标点规范化 (弯引号转直角引号，修补英文全半角状态等)
 */
function fixPunctuationStyle() {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;
        var layer = doc.activeLayer;

        if (layer.kind !== LayerKind.TEXT) {
            return "错误：请选中一个【文本图层】进行标点修正！";
        }

        // 由于文字属性被设置了其他排版样式，保险起见重新赋值
        var content = layer.textItem.contents;
        // 1. 替换弯引号为标准的直角引号 (日本漫画极其常见)
        content = content.replace(/“/g, '「').replace(/”/g, '」');
        content = content.replace(/‘/g, '『').replace(/’/g, '』');

        // 2. 将普通的连续2~3个半角句号转化为标准中文省略号字符 (……)
        content = content.replace(/\.{2,3}/g, '……');
        content = content.replace(/。。。/g, '……');

        // 3. 将半角的英文冒号转成全角避免在竖排下倒转
        content = content.replace(/:/g, '：');

        layer.textItem.contents = content;
        return "标点修正成功";
    } catch (e) {
        return "标点修正失败: " + e.toString();
    }
}

/**
 * 修正破折号连线 
 * 将由于日文字体库不匹配造成的裂开缝隙，统一修正为标准的 U+2014 等安全连续符号。
 */
function fixDashKerning() {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;
        var layer = doc.activeLayer;

        if (layer.kind !== LayerKind.TEXT) {
            return "错误：请选中一个【文本图层】处理破折号！";
        }

        // 获取原文本并执行安全降级与拼接
        var txt = layer.textItem.contents;
        layer.textItem.contents = txt.replace(/--/g, '——').replace(/ーー/g, '——').replace(/~~/g, '——');

        return "连续破折号转换完毕";
    } catch (e) {
        return "破折号缝合失败: " + e.toString();
    }
}

/**
 * 修正竖排连发感叹问号 (!? 与 !!) 
 * 方案：将其替换为最标准的纯英文字符，并强行打上 直排内横排(Tate-Chu-Yoko) 标签，使它们并排站立。
 */
function fixBangQuestion() {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;
        var layer = doc.activeLayer;

        if (layer.kind !== LayerKind.TEXT) {
            return "错误：请选中一个【文本图层】处理感叹问号！";
        }

        // 1. 获取原文本
        var txt = layer.textItem.contents;

        // 2. 将全角 ！？ 转成半角英文 !? 
        var replacedTxt = txt.replace(/[！!][？?]/g, '!?')
            .replace(/[？?][！!]/g, '?!')
            .replace(/[！!]{2}/g, '!!')
            .replace(/[？?]{2}/g, '??');

        layer.textItem.contents = replacedTxt;

        // 3. 针对整个图层挂载直排内横排属性(Tate-Chu-Yoko)
        // 这个指令在 PS 底层能够告诉文本引擎：把那些短的连续西文字符扶正。
        var idsetd = charIDToTypeID("setd");
        var desc270 = new ActionDescriptor();
        var idnull = charIDToTypeID("null");
        var ref87 = new ActionReference();
        var idPrpr = charIDToTypeID("Prpr");
        var idTxtS = charIDToTypeID("TxtS");
        ref87.putProperty(idPrpr, idTxtS);
        var idTxLr = charIDToTypeID("TxLr");
        var idOrdn = charIDToTypeID("Ordn");
        var idTrgt = charIDToTypeID("Trgt");
        ref87.putEnumerated(idTxLr, idOrdn, idTrgt);
        desc270.putReference(idnull, ref87);
        var idT = charIDToTypeID("T   ");
        var desc271 = new ActionDescriptor();
        var idtextOverrideFeatureName = stringIDToTypeID("textOverrideFeatureName");
        var idtatechuyoko = stringIDToTypeID("tatechuyoko");
        desc271.putEnumerated(idtextOverrideFeatureName, idtextOverrideFeatureName, idtatechuyoko);
        var idType = charIDToTypeID("Type");
        desc270.putObject(idT, idType, desc271);

        try { executeAction(idsetd, desc270, DialogModes.NO); } catch (e) { }

        return "图层内所有连发标点已转换为半角，并成功启用「直排内横排」特权显示。";
    } catch (e) {
        return "转换失败: " + e.toString();
    }
}

/**
 * 为当前被选中的文本图层修改特定字体
 */
function applyFontToLayer(postScriptName) {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;
        var layer = doc.activeLayer;

        if (layer.kind !== LayerKind.TEXT) {
            return "错误：请选中一个【文本图层】以更改字体！";
        }

        layer.textItem.font = postScriptName;
        return "为图层应用新字体成功";
    } catch (e) {
        return "更改字体失败: " + e.toString();
    }
}

/**
 * [双向绑定] 读取选中图层的文本内容
 */
function readActiveLayerText() {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;
        var layer = doc.activeLayer;

        if (layer.kind !== LayerKind.TEXT) {
            return "错误：请选中一个【文本图层】进行读取";
        }

        return layer.textItem.contents;
    } catch (e) {
        return "错误: " + e.toString();
    }
}

/**
 * [双向绑定] 将文本强制写入选中图层
 */
function writeActiveLayerText(newText) {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;
        var layer = doc.activeLayer;

        if (layer.kind !== LayerKind.TEXT) {
            return "错误：请先选中一个【文本图层】才能写入。";
        }

        layer.textItem.contents = newText;
        return "SUCCESS";
    } catch (e) {
        return "错误: " + e.toString();
    }
}
