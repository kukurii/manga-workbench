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

            // 智能排版落点计算 (防遮挡的斜向大落差大跨度瀑布流)
            // 这一改进解决了之前密密麻麻全堆在左上角导致光标穿不透、没法改字的严重痛点
            var colWidth = doc.width.as("px") / 4; // 分为 4 列
            var rowHeight = 250;

            var startX = 100 + ((i % 4) * colWidth);
            var startY = 100 + (Math.floor(i / 4) * rowHeight);

            // 如果超出画板底端，强制拉回到另外一条垂直阶梯排列，并增加横向缩进
            if (startY > docHeight - 100) {
                startY = 150 + (i * 40 % (docHeight / 2));
                startX = 100 + ((i % 3) * 150);
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
 * [双向绑定] 读取选中图层的详细文本多维属性 (文本、字号、字体、颜色、行距)
 */
function readActiveLayerProperties() {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;
        var layer = doc.activeLayer;

        if (layer.kind !== LayerKind.TEXT) {
            return "错误：请选中一个【文本图层】进行读取";
        }

        var ti = layer.textItem;

        // 解析颜色为 HEX
        var hexColor = "#000000";
        try {
            if (ti.color && ti.color.rgb) {
                var r = Math.round(ti.color.rgb.red).toString(16);
                var g = Math.round(ti.color.rgb.green).toString(16);
                var b = Math.round(ti.color.rgb.blue).toString(16);
                if (r.length === 1) r = "0" + r;
                if (g.length === 1) g = "0" + g;
                if (b.length === 1) b = "0" + b;
                hexColor = "#" + r + g + b;
            }
        } catch (ec) { }

        // ES3 ExtendScript 引擎缺失原生 JSON 支持，使用兼容的转义与拼接
        function esc(str) {
            if (typeof str !== "string") return str;
            return str.replace(/\\/g, "\\\\")
                .replace(/"/g, "\\\"")
                .replace(/\r/g, "\\r")
                .replace(/\n/g, "\\n")
                .replace(/\t/g, "\\t");
        }

        var txt = esc(ti.contents || "");
        var font = esc(ti.font || "");
        var size = ti.size ? parseFloat(ti.size) : "";

        var leading = "";
        try {
            if (ti.useAutoLeading) {
                try { leading = ti.autoLeadingAmount ? Math.round(ti.autoLeadingAmount) + "%" : ""; } catch (ea) { leading = "120%"; }
            } else {
                leading = ti.leading ? parseFloat(ti.leading) : "";
            }
        } catch (el) { }

        var color = esc(hexColor);

        var jsonResult = '{"text":"' + txt + '","font":"' + font + '","size":"' + size + '","leading":"' + leading + '","color":"' + color + '"}';

        return "SUCCESS|||" + jsonResult;
    } catch (e) {
        return "错误: " + e.toString();
    }
}

/**
 * [双向绑定] 覆写图层文本并一并应用多维排版属性
 */
function applyActiveLayerProperties(jsonStr) {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;
        var layer = doc.activeLayer;

        if (layer.kind !== LayerKind.TEXT) {
            return "错误：请先选中一个【文本图层】才能写入。";
        }

        // ES3 ExtendScript 下使用 eval 安全代偿解析前端传来的字串
        var params = eval("(" + jsonStr + ")");
        var ti = layer.textItem;

        // 写入文本
        if (params.text !== undefined) {
            ti.contents = params.text;
        }

        // 写入字体
        if (params.font && params.font !== "") {
            try { ti.font = params.font; } catch (ef) { }
        }

        // 写入字号
        if (params.size && !isNaN(parseFloat(params.size))) {
            ti.size = new UnitValue(parseFloat(params.size), "pt");
        }

        // 写入行距
        if (params.leading) {
            var ldStr = String(params.leading);
            if (ldStr.indexOf('%') > -1) {
                ti.useAutoLeading = true;
                try { ti.autoLeadingAmount = parseFloat(ldStr.replace('%', '')); } catch (ea) { }
            } else if (!isNaN(parseFloat(ldStr))) {
                ti.useAutoLeading = false;
                try { ti.leading = new UnitValue(parseFloat(ldStr), "pt"); } catch (ea) { }
            } else {
                ti.useAutoLeading = true;
            }
        } else {
            ti.useAutoLeading = true;
        }

        // 写入颜色
        if (params.color && params.color.indexOf("#") === 0) {
            var hex = params.color.substring(1);
            var solidColor = new SolidColor();
            solidColor.rgb.red = parseInt(hex.substring(0, 2), 16);
            solidColor.rgb.green = parseInt(hex.substring(2, 4), 16);
            solidColor.rgb.blue = parseInt(hex.substring(4, 6), 16);
            ti.color = solidColor;
        }

        return "SUCCESS";
    } catch (e) {
        return "错误: " + e.toString();
    }
}

/**
 * 跨图层组按图层名精确查找并设置为当前工作焦点 (前端双向定位)
 * ActionManager 能够以极高的效率遍历整个文档树
 */
function locateTextLayer(targetName) {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;

        // 【方案A】DOM 常规遍历 (易受编组阻挡)
        // var target = doc.layers.getByName(targetName); 
        // 遇到层级套嵌时会报错找不到，这里直接改用更强大的 AM

        var idslct = charIDToTypeID("slct");
        var descTarget = new ActionDescriptor();
        var idnull = charIDToTypeID("null");
        var refLayer = new ActionReference();
        var idLyr = charIDToTypeID("Lyr ");

        // 优先根据字符串精确匹配图层名 (无需递归查找)
        refLayer.putName(idLyr, targetName);
        descTarget.putReference(idnull, refLayer);

        // 设置不改变原有选区的扩展方式
        var idMkVs = charIDToTypeID("MkVs");
        descTarget.putBoolean(idMkVs, false);

        executeAction(idslct, descTarget, DialogModes.NO);

        return "SUCCESS";
    } catch (e) {
        return "错误：在画布中未能找到编号为 [" + targetName + "] 的文本图层。可能已被重命名或删除。";
    }
}

/**
 * 遍历提取当前文档内的所有文本图层，拼接成插件标准的导入格式返回前端。
 */
function exportAllTextLayersToTXT() {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;
        var textLayersData = [];

        // 递归抽取函数
        function collectText(layers) {
            // 倒序遍历更符合视觉由上至下的阅读顺位，当然也可以根据坐标排序，目前先采用倒序提取
            for (var i = 0; i < layers.length; i++) {
                var lr = layers[i];
                if (lr.typename === "LayerSet") {
                    collectText(lr.layers);
                } else if (lr.kind === LayerKind.TEXT && lr.visible) {
                    textLayersData.push(lr.textItem.contents);
                }
            }
        }

        collectText(doc.layers);

        // 倒置回来，因为如果图层是从上往下建的，那么下面的层通常是第一句对白
        textLayersData.reverse();

        if (textLayersData.length === 0) {
            return "提示：当前画板没有找到任何可见的文本图层。";
        }

        var outTXT = "=== 第 1 页: " + doc.name + " ===\n";
        for (var k = 0; k < textLayersData.length; k++) {
            var lines = textLayersData[k].replace(/\r/g, '\n').split('\n');
            outTXT += "[" + (k + 1) + "] " + lines.join("\n") + "\n";
        }

        // 以特殊的分隔符返回，方便前端辨识
        return "EXPORT_TXT_SUCCESS|||" + outTXT;

    } catch (e) {
        return "提取画板文本失败: " + e.toString();
    }
}
