var doc = app.activeDocument;
var mode = doc.mode.toString();
var isMask = false;
try {
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID("Chnl"), charIDToTypeID("Chnl"), charIDToTypeID("Msk "));
    var desc = executeActionGet(ref);
    isMask = true;
} catch (e) {
    isMask = false;
}
alert("当前文档色彩模式: " + mode + "\n是否是在蒙版通道上: " + (isMask ? "是" : "否") + "\n当前选中的图层: " + doc.activeLayer.name);
