/**
 * style.jsx - 处理段落属性与图层样式 (外描边)
 */

// --- 段落文本调节 ---

function applyParagraphStyle(fontPostName, sizePts, leadingType, leadingValue) {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        if (app.activeDocument.activeLayer.kind !== LayerKind.TEXT) return "错误：请选中一个【文本图层】";

        var txtItem = app.activeDocument.activeLayer.textItem;

        // 1. 设置字体
        if (fontPostName && fontPostName !== "undefined" && fontPostName !== "") {
            txtItem.font = fontPostName;
        }

        // 2. 设置字号大小
        if (sizePts && sizePts > 0) {
            txtItem.size = new UnitValue(sizePts, "pt");
        }

        // 3. 设置行间距机制
        if (leadingType === "auto") {
            txtItem.useAutoLeading = true;
            if (leadingValue > 0) {
                // 原生 API 自动行间距比例属性赋值 (比如 125 就是 125%)
                try {
                    txtItem.autoLeadingAmount = leadingValue;
                } catch (errA) {
                    // 某些旧版本无法通过原生属性写 autoLeadingAmount
                    // 如果失败了就退避为不改比例，只启用了 autoLeading
                }
            }
        } else {
            // 定死行距
            txtItem.useAutoLeading = false;
            if (leadingValue > 0) {
                txtItem.leading = new UnitValue(leadingValue, "pt");
            }
        }

        return "SUCCESS";
    } catch (e) {
        return "段落设定无法应用 (请尝试先点下画布别的图层重新选定该文本): " + e.toString();
    }
}

// --- 图层特效：描边 ---

function applyLayerStroke(r, g, b, strokeSizePx) {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";

        var idsetd = charIDToTypeID("setd");
        var desc1 = new ActionDescriptor();
        var idnull = charIDToTypeID("null");
        var ref1 = new ActionReference();
        var idPrpr = charIDToTypeID("Prpr");
        var idLefx = charIDToTypeID("Lefx");
        ref1.putProperty(idPrpr, idLefx);
        var idLyr = charIDToTypeID("Lyr ");
        var idOrdn = charIDToTypeID("Ordn");
        var idTrgt = charIDToTypeID("Trgt");
        ref1.putEnumerated(idLyr, idOrdn, idTrgt);
        desc1.putReference(idnull, ref1);

        var idT = charIDToTypeID("T   ");
        var desc2 = new ActionDescriptor();
        var idScl = charIDToTypeID("Scl ");
        var idPrc = charIDToTypeID("#Prc");
        desc2.putUnitDouble(idScl, idPrc, 100.000000);

        var idFrFX = charIDToTypeID("FrFX");
        var desc3 = new ActionDescriptor();
        var idenab = charIDToTypeID("enab");
        desc3.putBoolean(idenab, true);
        var idpresent = stringIDToTypeID("present");
        desc3.putBoolean(idpresent, true);
        var idshowInDialog = stringIDToTypeID("showInDialog");
        desc3.putBoolean(idshowInDialog, true);
        var idStyle = charIDToTypeID("Styl");
        var idFStl = charIDToTypeID("FStl");
        var idOutF = charIDToTypeID("OutF");
        desc3.putEnumerated(idStyle, idFStl, idOutF);
        var idPntP = charIDToTypeID("PntP");
        var idBlnM = charIDToTypeID("BlnM");
        var idNrml = charIDToTypeID("Nrml");
        desc3.putEnumerated(idPntP, idBlnM, idNrml);
        var idOpct = charIDToTypeID("Opct");
        desc3.putUnitDouble(idOpct, idPrc, 100.000000);
        var idSz = charIDToTypeID("Sz  ");
        var idPxl = charIDToTypeID("#Pxl");
        desc3.putUnitDouble(idSz, idPxl, strokeSizePx);

        var idClr = charIDToTypeID("Clr ");
        var desc4 = new ActionDescriptor();
        var idRd = charIDToTypeID("Rd  ");
        desc4.putDouble(idRd, r);
        var idGrn = charIDToTypeID("Grn ");
        desc4.putDouble(idGrn, g);
        var idBl = charIDToTypeID("Bl  ");
        desc4.putDouble(idBl, b);
        var idRGBC = charIDToTypeID("RGBC");
        desc3.putObject(idClr, idRGBC, desc4);

        desc2.putObject(idFrFX, idFrFX, desc3);
        desc1.putObject(idT, idLefx, desc2);

        executeAction(idsetd, desc1, DialogModes.NO);
        return "SUCCESS";
    } catch (e) {
        return "错误: 加载描边失败 " + e.toString();
    }
}

function clearLayerStyle() {
    try {
        if (app.documents.length === 0) return "错误：没有打开的文档";
        var idclearLayerStyle = stringIDToTypeID("clearLayerStyle");
        var desc = new ActionDescriptor();
        var idnull = charIDToTypeID("null");
        var ref = new ActionReference();
        var idLyr = charIDToTypeID("Lyr ");
        var idOrdn = charIDToTypeID("Ordn");
        var idTrgt = charIDToTypeID("Trgt");
        ref.putEnumerated(idLyr, idOrdn, idTrgt);
        desc.putReference(idnull, ref);
        executeAction(idclearLayerStyle, desc, DialogModes.NO);
        return "SUCCESS";
    } catch (e) {
        return "错误: 抹除图层特效失败 " + e.toString();
    }
}
