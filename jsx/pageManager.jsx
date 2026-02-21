// pageManager.jsx - 供宿主执行的页面管理相关功能

/**
 * 前端传入导入的文件列表（JSON格式）
 */
function receiveImportedPages(pagesJson) {
    try {
        // 由于没有用 json2，这里利用 extendscript 原生的 eval 简易解析数组
        // 或者使用上面注入前端拼装好字面量
        var pages = eval("(" + pagesJson + ")");
        // 后续可以在后台持久化记录这些文档
        return "Pages registered backend.";
    } catch (e) {
        return e.toString();
    }
}

/**
 * 激活或打开指定的一页
 */
function openOrSwitchDocument(filePath) {
    try {
        var fileToOpen = new File(filePath);
        if (!fileToOpen.exists) {
            alert("文件不存在: " + filePath);
            return;
        }

        var docAlreadyOpen = false;
        // 遍历当前已打开的文档，查找是否该文件已被打开
        for (var i = 0; i < app.documents.length; i++) {
            var doc = app.documents[i];
            try {
                if (doc.fullName.fsName == fileToOpen.fsName) {
                    // 已打开，直接切换使其成为活动文档
                    app.activeDocument = doc;
                    docAlreadyOpen = true;
                    break;
                }
            } catch (err) {
                // 新建但还未保存的文档调用 doc.fullName 会抛异常，跳过
            }
        }

        // 如果未打开，则让 PS 载入该文件
        if (!docAlreadyOpen) {
            app.open(fileToOpen);
        }

        return "Opened document.";
    } catch (e) {
        alert("打开文档失败: " + e.toString());
        return e.toString();
    }
}

/**
 * 快速保存当前文档为 PSD 并在必要时带上对比组。
 */
function saveCurrentDocumentAsPsd(withCompareGroup) {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var doc = app.activeDocument;

        // 如果需要带上比对组，先强制检查并生成一遍原图参考组
        if (withCompareGroup) {
            // 我们借用 retouch.jsx 里已经封装好的原图备份逻辑来生成底层源数据副本
            try {
                if (typeof backupOriginalLayer === "function") {
                    backupOriginalLayer();
                    // 备份完它可能关掉了眼睛，我们把它重新点亮，因为用户是要保存带比对的状态
                    var bgGroup = doc.layerSets.getByName("【原图参考】");
                    if (bgGroup) {
                        bgGroup.visible = true;
                    }
                }
            } catch (backupErr) {
                // 如果没有该函数或者报错就跳过
            }
        }

        // 获取当前文档的储存路径。若是未保存的新文档则 fullName 会报错，抛入 catch。
        var saveFile;
        try {
            saveFile = doc.fullName;
        } catch (e) {
            // 如果是一张未被保存过的图片 (比如新建画板)
            return "错误：当前文档尚未在本地路径中建立连接，请先用 PS 自带的另存为保存一次。";
        }

        // 强行把扩展名替换为 .psd
        var newPathStr = saveFile.fsName.replace(/\.[^\.]+$/, '.psd');
        var targetFile = new File(newPathStr);

        var psdSaveOptions = new PhotoshopSaveOptions();
        psdSaveOptions.alphaChannels = true;
        psdSaveOptions.annotations = true;
        psdSaveOptions.embedColorProfile = true;
        psdSaveOptions.layers = true;
        psdSaveOptions.spotColors = true;

        doc.saveAs(targetFile, psdSaveOptions, true, Extension.LOWERCASE);
        return "SUCCESS";
    } catch (e) {
        return "保存失败: " + e.toString();
    }
}

/**
 * 遍历所有【已处于活动打开状态】的文档，统统进行一键无脑保存
 * 适用于一次性爆改几十张图后，懒得逐张 Ctrl+S
 */
function batchSaveAllDocs(pagesJson) {
    try {
        var len = app.documents.length;
        if (len === 0) return "没有检测到任何已被开启的文档！";

        var savedCount = 0;
        // 注意：反向遍历是针对有可能在遍历过程中关闭文档的安全做法
        // 不过我们只是单纯循环保存，正常正向也行
        for (var i = 0; i < len; i++) {
            var doc = app.documents[i];
            try {
                // 判断逻辑：如果它是被新建出来压根没在硬盘里待过的图片，强行报错捕获
                var testForPath = doc.fullName;
                doc.save(); // 直接触发覆盖动作
                savedCount++;
            } catch (err) {
                // 跳过未真正落地的临时文档
            }
        }
        return "成功处理了 " + savedCount + " 个活动文档的静态存储！";
    } catch (e) {
        return e.toString();
    }
}

/**
 * 核心跑批引擎：前端传过来排序过后的画板对象队列，
 * 后台逐个开启（如果没开），然后另存为对应格式，再悄摸关掉（如果你没动）
 */
function batchExportAllPages(pagesJson, outputDirStr, format) {
    var originalDisplayDialogs = app.displayDialogs;
    try {
        // 关闭所有的中间弹窗，实现真正的静默
        app.displayDialogs = DialogModes.NO;

        var pages = eval("(" + pagesJson + ")");
        if (!pages || pages.length === 0) return "接收到的批处理队列为空";

        var outFolder = new Folder(outputDirStr);
        if (!outFolder.exists) {
            outFolder.create();
        }

        var exportCount = 0;

        for (var i = 0; i < pages.length; i++) {
            var pData = pages[i];
            var fPath = pData.path;
            // 目标期望的最终命名
            var rawName = pData.name; // 如 "[第06话]测试.jpg"

            var sourceFile = new File(fPath);
            if (!sourceFile.exists) continue;

            // 1. 判断该文件当前是否已经被打开并停留在画布中
            var theDoc = null;
            var wasAlreadyOpen = false;
            for (var j = 0; j < app.documents.length; j++) {
                try {
                    if (app.documents[j].fullName.fsName === sourceFile.fsName) {
                        theDoc = app.documents[j];
                        wasAlreadyOpen = true;
                        break;
                    }
                } catch (pe) { }
            }

            // 2. 没开的话，就在后台打开它作为基准源
            if (!theDoc) {
                theDoc = app.open(sourceFile);
            }

            // 3. 构建输出扩展名
            var pureName = rawName;
            var dotIndex = rawName.lastIndexOf('.');
            if (dotIndex > 0) {
                pureName = rawName.substring(0, dotIndex); // 剥离掉原有的 .psd 或 .png
            }

            var ext = format.indexOf('jpg') > -1 ? '.jpg' : '.png';
            var outFile = new File(outFolder.fsName + "/" + pureName + ext);

            // 4. 执行不同的输出策略类型
            if (format === "png") {
                var pngSaveOptions = new PNGSaveOptions();
                pngSaveOptions.compression = 5; // 中等压缩比适中
                pngSaveOptions.interlaced = false;
                theDoc.saveAs(outFile, pngSaveOptions, true, Extension.LOWERCASE);
            } else {
                var jpgSaveOptions = new JPEGSaveOptions();
                jpgSaveOptions.embedColorProfile = true;
                jpgSaveOptions.formatOptions = FormatOptions.STANDARDBASELINE;
                jpgSaveOptions.matte = MatteType.NONE;
                // 设置画质
                if (format === "jpg-high") {
                    jpgSaveOptions.quality = 12; // 顶配
                } else {
                    jpgSaveOptions.quality = 8; // 常用网传 (高)
                }
                theDoc.saveAs(outFile, jpgSaveOptions, true, Extension.LOWERCASE);
            }

            // 5. 收尾工作
            exportCount++;

            // 如果是我刚才为了跑批偷偷打开的，那我就给它随手关门，并且绝不保存源文件更改
            if (!wasAlreadyOpen) {
                theDoc.close(SaveOptions.DONOTSAVECHANGES);
            }
        }

        app.displayDialogs = originalDisplayDialogs;
        return "恭喜！成功在一秒内碾过了预定流程！一共稳定输出了 " + exportCount + " 张定稿。";

    } catch (e) {
        app.displayDialogs = originalDisplayDialogs;
        return "跑批引擎由于严重阻击而中止: " + e.toString();
    }
}
