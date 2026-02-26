// typeset.jsx - 嵌字排版相关的 Photoshop ExtendScript

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
        var dialogs = JSON.parse(dialogsJson);
        var styleParams = JSON.parse(styleJson);

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
 * 批量应用字体：对“当前选择的多个图层”中的文本图层应用字体
 * - 若当前仅单选，则等同于 applyFontToLayer
 * 返回：SUCCESS|||{"total":x,"applied":y,"skipped":z}
 */
function applyFontToSelectedTextLayers(postScriptName) {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;

        function getSelectedLayerIndices() {
            var indices = [];
            try {
                var ref = new ActionReference();
                ref.putProperty(charIDToTypeID("Prpr"), stringIDToTypeID("targetLayers"));
                ref.putEnumerated(charIDToTypeID("Dcmn"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
                var desc = executeActionGet(ref);
                if (!desc.hasKey(stringIDToTypeID("targetLayers"))) return indices;

                var list = desc.getList(stringIDToTypeID("targetLayers"));
                for (var i = 0; i < list.count; i++) {
                    var ref2 = list.getReference(i);
                    var idx = ref2.getIndex();
                    indices.push(idx);
                }
            } catch (e) { }
            return indices;
        }

        function selectLayerByIndex(idx) {
            var idslct = charIDToTypeID("slct");
            var desc = new ActionDescriptor();
            var idnull = charIDToTypeID("null");
            var ref = new ActionReference();
            ref.putIndex(charIDToTypeID("Lyr "), idx);
            desc.putReference(idnull, ref);
            desc.putBoolean(charIDToTypeID("MkVs"), false);
            executeAction(idslct, desc, DialogModes.NO);
        }

        var selected = getSelectedLayerIndices();
        // 若没有拿到多选信息，降级为单层处理（兼容某些版本 PS）
        if (!selected || selected.length === 0) {
            return applyFontToLayer(postScriptName);
        }

        var applied = 0;
        var skipped = 0;
        var total = selected.length;

        for (var k = 0; k < selected.length; k++) {
            try {
                selectLayerByIndex(selected[k]);
                var lr = doc.activeLayer;
                if (lr && lr.kind === LayerKind.TEXT) {
                    lr.textItem.font = postScriptName;
                    applied++;
                } else {
                    skipped++;
                }
            } catch (e1) {
                skipped++;
            }
        }

        return 'SUCCESS|||{"total":' + total + ',"applied":' + applied + ',"skipped":' + skipped + "}";
    } catch (e) {
        return "更改字体失败: " + e.toString();
    }
}

/**
 * 批量应用字体：对“当前文档全部文本图层”（含编组内）应用字体
 * 返回：SUCCESS|||{"total":x,"applied":y,"skipped":z}
 */
function applyFontToAllTextLayers(postScriptName) {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;

        var applied = 0;
        var skipped = 0;
        var total = 0;

        function walk(layers) {
            for (var i = 0; i < layers.length; i++) {
                var lr = layers[i];
                if (lr.typename === "LayerSet") {
                    walk(lr.layers);
                } else {
                    total++;
                    if (lr.kind === LayerKind.TEXT) {
                        try {
                            lr.textItem.font = postScriptName;
                            applied++;
                        } catch (e1) {
                            skipped++;
                        }
                    } else {
                        skipped++;
                    }
                }
            }
        }

        walk(doc.layers);

        return 'SUCCESS|||{"total":' + total + ',"applied":' + applied + ',"skipped":' + skipped + "}";
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

        var params = JSON.parse(jsonStr);
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
 * 框选气泡后创建文本框：读取当前选区 bounds，在其中心创建段落文本图层
 */
function createTextLayerInSelection(text, fontPostScriptName, fontSize, direction) {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;

        // 读取选区边界
        var bounds;
        try {
            bounds = doc.selection.bounds;
        } catch (e) {
            return "失败：请先框选气泡区域，再点击此按钮。";
        }

        // Photoshop selection.bounds 顺序为: [left, top, right, bottom]
        var left   = bounds[0].as("px");
        var top    = bounds[1].as("px");
        var right  = bounds[2].as("px");
        var bottom = bounds[3].as("px");
        var w = right - left;
        var h = bottom - top;

        if (w < 4 || h < 4) return "失败：选区过小，请重新框选气泡。";

        // 取消选区以防干扰图层操作
        doc.selection.deselect();

        // 获取或创建【翻译文字】组
        var groupName = "【翻译文字】";
        var txtGroup;
        try {
            txtGroup = doc.layerSets.getByName(groupName);
        } catch (e) {
            txtGroup = doc.layerSets.add();
            txtGroup.name = groupName;
            txtGroup.move(doc.layers[0], ElementPlacement.PLACEBEFORE);
        }

        // 创建段落文本图层
        var textLayer = txtGroup.artLayers.add();
        textLayer.kind = LayerKind.TEXT;

        var ti = textLayer.textItem;
        ti.kind = TextType.PARAGRAPHTEXT;

        // 设置方向
        var isVertical = (direction === "VERTICAL");
        ti.direction = isVertical ? Direction.VERTICAL : Direction.HORIZONTAL;

        // 设置字体
        if (fontPostScriptName && fontPostScriptName !== "" && fontPostScriptName !== "undefined") {
            try { ti.font = fontPostScriptName; } catch (ef) { }
        }

        // 设置字号
        var fSize = parseFloat(fontSize) || 16;
        ti.size = new UnitValue(fSize, "pt");
        ti.useAutoLeading = true;

        // 居中对齐
        ti.justification = isVertical ? Justification.CENTER : Justification.CENTER;

        // 文本内容（支持 \n 转实际换行）
        var content = text ? text.replace(/\\n/g, "\r") : "文字";
        ti.contents = content;

        // 设置段落文本框的位置与大小
        // paragraphText: position = 左上角, width/height = 框尺寸
        ti.position = [new UnitValue(left, "px"), new UnitValue(top, "px")];
        ti.width    = new UnitValue(w, "px");
        ti.height   = new UnitValue(h, "px");

        // 选中新图层
        doc.activeLayer = textLayer;

        return "SUCCESS";
    } catch (e) {
        return "框选创建文本框失败: " + e.toString();
    }
}

/**
 * 获取当前文档中所有文本图层的列表（索引、名称、内容），用于批量对比更新
 */
function getAllTextLayers() {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;

        var result = [];

        function esc(str) {
            if (typeof str !== "string") return "";
            return str.replace(/\\/g, "\\\\")
                      .replace(/"/g, '\\"')
                      .replace(/\r/g, "\\r")
                      .replace(/\n/g, "\\n");
        }

        function collect(layers) {
            for (var i = 0; i < layers.length; i++) {
                var lr = layers[i];
                if (lr.typename === "LayerSet") {
                    collect(lr.layers);
                } else if (lr.kind === LayerKind.TEXT) {
                    result.push('{"name":"' + esc(lr.name) + '","text":"' + esc(lr.textItem.contents) + '"}');
                }
            }
        }

        collect(doc.layers);

        return "SUCCESS|||[" + result.join(",") + "]";
    } catch (e) {
        return "获取文本图层失败: " + e.toString();
    }
}

/**
 * 按图层名称更新文本内容（前端传来名称和新文本）
 */
function updateTextLayerByName(layerName, newText) {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;

        var newContent = newText.replace(/\\n/g, "\r");

        function findAndUpdate(layers) {
            for (var i = 0; i < layers.length; i++) {
                var lr = layers[i];
                if (lr.typename === "LayerSet") {
                    if (findAndUpdate(lr.layers)) return true;
                } else if (lr.kind === LayerKind.TEXT && lr.name === layerName) {
                    lr.textItem.contents = newContent;
                    return true;
                }
            }
            return false;
        }

        var found = findAndUpdate(doc.layers);
        return found ? "SUCCESS" : "错误：未找到名为 [" + layerName + "] 的文本图层";
    } catch (e) {
        return "更新文本图层失败: " + e.toString();
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
