// compare.jsx - 原图对比与备份功能
// 主要用于在修图、嵌字前备份原图作为参照

/**
 * 备份当前文档的底图用于对比
 */
function backupOriginalLayer() {
    try {
        if (app.documents.length === 0) return "没有打开的文档";

        var doc = app.activeDocument;
        var backupLayerName = "【原图参考】";

        // 检查是否已经存在同名备份图层
        for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === backupLayerName) {
                return "原图参考已存在。";
            }
        }

        // 如果文档只有背景层，将其转换为普通图层以便调整层级
        if (doc.activeLayer.isBackgroundLayer) {
            doc.activeLayer.isBackgroundLayer = false;
        }

        // 假设最底层的图层为需要备份的原图
        var bottomLayer = doc.layers[doc.layers.length - 1];

        // 复制到底层上方
        var backupLayer = bottomLayer.duplicate(bottomLayer, ElementPlacement.PLACEBEFORE);
        backupLayer.name = backupLayerName;

        // 将备份层锁定并隐藏，防止误操作
        backupLayer.allLocked = true;
        backupLayer.visible = false;

        // 将其移动到最顶层，以便随时显示查看
        backupLayer.move(doc.layers[0], ElementPlacement.PLACEBEFORE);

        return "原图备份成功！可随时开启显示进行对比。";
    } catch (e) {
        return "备份原图失败: " + e.toString();
    }
}

/**
 * 设置原图参考图层的不透明度（0-100）
 * 用于滑块对比：实时调整原图参考组的透明度
 */
function setCompareGroupOpacity(opacity) {
    try {
        if (app.documents.length === 0) return "No doc";

        var doc = app.activeDocument;
        var backupLayerName = "【原图参考】";
        var opacityVal = parseInt(opacity);
        if (isNaN(opacityVal)) opacityVal = 100;
        if (opacityVal < 0) opacityVal = 0;
        if (opacityVal > 100) opacityVal = 100;

        for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === backupLayerName) {
                doc.layers[i].opacity = opacityVal;
                // 确保可见（透明度非零时自动显示）
                doc.layers[i].visible = (opacityVal > 0);
                return "OK";
            }
        }
        return "No backup found";
    } catch (e) {
        return e.toString();
    }
}

/**
 * 切换原图参考的可见性 (开/关)
 */
function toggleOriginalCompare() {
    try {
        if (app.documents.length === 0) return "No doc";

        var doc = app.activeDocument;
        var backupLayerName = "【原图参考】";
        var backupExists = false;

        for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === backupLayerName) {
                backupExists = true;
                // 切换可见性
                doc.layers[i].visible = !doc.layers[i].visible;
                break;
            }
        }

        if (!backupExists) {
            return "No backup found";
        }

        return "Toggled";
    } catch (e) {
        return e.toString();
    }
}
