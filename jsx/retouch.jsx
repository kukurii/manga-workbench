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
 * 辅助：安全 parseInt（允许 0；NaN 时回退默认值）
 */
function _parseIntDefault(val, defaultVal) {
    var n = parseInt(val, 10);
    return isNaN(n) ? defaultVal : n;
}

/**
 * 辅助：确保存在一个可填充的普通像素图层，并切到该图层
 * - 若同名图层存在但不是普通 ArtLayer（例如组/调整层/智能对象），则新建一个同名普通图层
 * - 自动解除锁定、确保可见
 */
function _ensureNormalArtLayer(doc, layerName) {
    var layer = null;
    try {
        layer = doc.layers.getByName(layerName);
    } catch (e) {
        layer = null;
    }

    var needNew = false;
    if (!layer) needNew = true;
    else {
        // 有同名对象，但不是我们要的“普通像素图层”
        if (layer.typename !== "ArtLayer") needNew = true;
        else if (layer.kind !== LayerKind.NORMAL) needNew = true;
    }

    if (needNew) {
        layer = doc.artLayers.add();
        layer.name = layerName;
        // 尽量放到顶部（不强依赖，失败也不影响功能）
        try {
            layer.move(doc.layers[0], ElementPlacement.PLACEBEFORE);
        } catch (e) { }
    }

    // 解锁 + 可见
    try { layer.allLocked = false; } catch (e) { }
    try { layer.visible = true; } catch (e) { }

    return layer;
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
 * 【带 suspendHistory 包裹，使整个操作只占一条历史记录】
 */
/**
 * 核心：一键去字 (由于部分 PS 版本在透明层使用 sampleAllLayers 容易报像素不足，
 * 改用：盖印可见图层 -> 内容感知填充 -> 反选删除只留补丁 -> 非破坏性修补贴片)
 */
function autoEraseSelection(expandPx) {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;

        if (!hasSelection(doc)) {
            return "失败：请先使用魔棒、套索等工具框选需要去除的文字或图案！";
        }

        // --- 预处理：扩展选区避免遗漏边缘 ---
        expandPx = parseInt(expandPx) || 3;
        try {
            if (expandPx > 0) {
                doc.selection.expand(new UnitValue(expandPx, "px"));
            } else if (expandPx < 0) {
                doc.selection.contract(new UnitValue(Math.abs(expandPx), "px"));
            }
        } catch (e) { }

        // --- 提取源像素：强行把当前所有可见图层“盖印”提取到一张新图层，用来提供 100% 安全的内容感知基底 ---
        var baseLayer = doc.activeLayer;
        try {
            var idMrgV = charIDToTypeID("MrgV");
            var descMrg = new ActionDescriptor();
            descMrg.putBoolean(charIDToTypeID("Dplc"), true);
            executeAction(idMrgV, descMrg, DialogModes.NO);
        } catch (mrgErr) {
            // 若盖印失败（例如文档只有一个孤立背景层时），直接 duplicate 此层
            try {
                doc.activeLayer = baseLayer.duplicate();
            } catch (dupErr) {
                return "去字失败: 无法提取原位像素图像。";
            }
        }

        var patchLayer = doc.activeLayer;

        // --- 执行内容感知填充 ---
        try {
            var idFl = charIDToTypeID("Fl  ");
            var descFl = new ActionDescriptor();
            descFl.putEnumerated(charIDToTypeID("Usng"), charIDToTypeID("FlCn"), stringIDToTypeID("contentAware"));
            var idOpct = charIDToTypeID("Opct");
            var idPrc = charIDToTypeID("#Prc");
            descFl.putUnitDouble(idOpct, idPrc, 100.0);

            // 此处坚决不使用 sampleAllLayers，因为 patchLayer 自己就已经是所有可见图案的结晶！
            executeAction(idFl, descFl, DialogModes.NO);
        } catch (fillErr) {
            patchLayer.remove(); // 失败则清理图层痕迹
            return "去字(内容感知填充)失败: " + fillErr.toString() + " \n选定区域可能过大或过小不支持感知。";
        }

        // --- 反向选择，清除全图其余冗余画面，只留下选框内部的完美贴合贴片 ---
        try {
            doc.selection.invert();
            doc.selection.clear(); // 强力裁剪
        } catch (e) { }

        // 扫尾：取消选区
        try {
            doc.selection.deselect();
        } catch (e) { }

        // --- 整理图层：放置到专属修图组中 ---
        var retouchGroupName = "【修图管理组】";
        var retouchGroup = null;
        try {
            retouchGroup = doc.layerSets.getByName(retouchGroupName);
        } catch (e) {
            retouchGroup = doc.layerSets.add();
            retouchGroup.name = retouchGroupName;
            retouchGroup.move(doc.layers[0], ElementPlacement.PLACEBEFORE); // 始终置于最顶层
        }

        patchLayer.name = "【修补局部贴片】";

        try {
            // 将此修补层移动到修图管理组内最顶端
            patchLayer.move(retouchGroup, ElementPlacement.PLACEATBEGINNING);
        } catch (e) { }

        return "去字生成完毕 (已收入修图管理组)";
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
            // 没有选区时直接创建全画幅白色图层
            return createWhiteLayer();
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

        // 关键：必须在“可填充的普通像素图层”上填充，否则当前选中图层若为文字/组/智能对象等会表现为“没反应”
        var fillLayer = doc.artLayers.add();
        fillLayer.name = "【白底填补贴片】";
        doc.activeLayer = fillLayer;

        doc.selection.fill(whiteColor, ColorBlendMode.NORMAL, 100, false);
        doc.selection.deselect();

        // 整理：移入修图管理组
        var retouchGroupName = "【修图管理组】";
        var retouchGroup = null;
        try {
            retouchGroup = doc.layerSets.getByName(retouchGroupName);
        } catch (e) {
            retouchGroup = doc.layerSets.add();
            retouchGroup.name = retouchGroupName;
            retouchGroup.move(doc.layers[0], ElementPlacement.PLACEBEFORE);
        }

        try {
            fillLayer.move(retouchGroup, ElementPlacement.PLACEATBEGINNING);
        } catch (e) { }

        return "白底填充成功";
    } catch (e) {
        return "白底填充失败: " + e.toString();
    }
}

/**
 * 自定义颜色填充 (r, g, b 为 0-255, expandPx 为扩边像素)
 * 【带 suspendHistory 包裹】
 */
function fillColorSelection(r, g, b, expandPx) {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;

        if (!hasSelection(doc)) {
            return "失败：请先建立选区！";
        }

        var result = "取色填充成功";

        doc.suspendHistory("取色填充", function () {
            var exPx = _parseIntDefault(expandPx, 0);
            try {
                if (exPx > 0) {
                    doc.selection.expand(new UnitValue(exPx, "px"));
                } else if (exPx < 0) {
                    doc.selection.contract(new UnitValue(Math.abs(exPx), "px"));
                }
            } catch (e) { }

            // 同白底填充：确保落在可填充的普通像素图层上
            var fillLayer = _ensureNormalArtLayer(doc, "【取色填充层】");
            doc.activeLayer = fillLayer;

            var fillColor = new SolidColor();
            fillColor.rgb.red = parseInt(r) || 0;
            fillColor.rgb.green = parseInt(g) || 0;
            fillColor.rgb.blue = parseInt(b) || 0;

            doc.selection.fill(fillColor, ColorBlendMode.NORMAL, 100, false);
            doc.selection.deselect();
        });

        return result;
    } catch (e) {
        return "取色填充失败: " + e.toString();
    }
}

/**
 * 修复魔棒选区（闭合内部文字破洞）- 仅修复，不填充
 * 用于两步流程：先预览选区，确认后再填充
 */
function healSelectionHolesOnly() {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;

        if (!hasSelection(doc)) return "失败：请先用魔棒或快速选择工具建立带破洞的气泡选区。";

        doc.selection.expand(new UnitValue(15, "px"));
        doc.selection.contract(new UnitValue(15, "px"));

        return "READY";
    } catch (e) {
        return "修复选区执行中断: " + e.toString();
    }
}

/**
 * 新建白色图层 (铺满画布，不依赖选区)
 * 【带 suspendHistory 包裹】
 */
function createWhiteLayer() {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;

        var result = "已新建白色图层";

        doc.suspendHistory("新建白色图层", function () {
            var layer = doc.artLayers.add();
            layer.name = "【全画底白底图层】";
            doc.activeLayer = layer;

            // 全画布选区 → 填白 → 取消选区
            doc.selection.selectAll();
            var whiteColor = new SolidColor();
            whiteColor.rgb.red = 255;
            whiteColor.rgb.green = 255;
            whiteColor.rgb.blue = 255;
            doc.selection.fill(whiteColor, ColorBlendMode.NORMAL, 100, false);
            doc.selection.deselect();

            // 整理：移入修图管理组并垫底
            var retouchGroupName = "【修图管理组】";
            var retouchGroup = null;
            try {
                retouchGroup = doc.layerSets.getByName(retouchGroupName);
            } catch (e) {
                retouchGroup = doc.layerSets.add();
                retouchGroup.name = retouchGroupName;
                retouchGroup.move(doc.layers[0], ElementPlacement.PLACEBEFORE);
            }

            try {
                // 这个图层通常垫底使用
                layer.move(retouchGroup, ElementPlacement.PLACEATEND);
            } catch (e) { }
        });

        return result;
    } catch (e) {
        return "新建白色图层失败: " + e.toString();
    }
}

/**
 * 修复魔棒选区（闭合内部文字破洞）
 * 原理：形态学闭运算。通过大幅外扩选区吞并文字造成的破洞，再以等量数值边缘收缩还原本来的外边界。
 * 【带 suspendHistory 包裹】
 */
function healSelectionHoles() {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;

        if (!hasSelection(doc)) return "失败：请先用魔棒或快速选择工具建立带破洞的气泡选区。";

        doc.suspendHistory("修复选区破洞", function () {
            doc.selection.expand(new UnitValue(15, "px"));
            doc.selection.contract(new UnitValue(15, "px"));
        });

        return "";
    } catch (e) {
        return "修复选区执行中断: " + e.toString();
    }
}
