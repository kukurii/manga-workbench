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
 * 修复魔棒选区（闭合内部文字破洞）
 * 原理：形态学闭运算。通过大幅外扩选区吞并文字造成的破洞，再以等量数值边缘收缩还原本来的外边界。
 */
function healSelectionHoles() {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;

        if (!hasSelection(doc)) return "失败：请先用魔棒或快速选择工具建立带破洞的气泡选区。";

        // 外扩吞并所有文字区域
        doc.selection.expand(new UnitValue(15, "px"));
        // 收缩还原外侧边缘，内部已被完全填充为实心状态
        doc.selection.contract(new UnitValue(15, "px"));

        return ""; // 静默成功
    } catch (e) {
        return "修复选区执行中断: " + e.toString();
    }
}
