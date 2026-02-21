// hostscript.jsx - 供前端页面调用的 ExtendScript 函数集

/**
 * 测试由 HTML 前端发起的 ExtendScript 调用
 * @param {string} msg 接收前端传来的消息
 * @return {string} 返回给前端的字符串结果
 */
function testConnection(msg) {
    try {
        // 在 Photoshop 内弹出提示框
        alert("【来自后端的问候】\n已成功接收到前端消息：\n" + msg + "\n\n恭喜！CEP 通信管道已打通。");

        // 返回成功信息给前端的回调函数
        return "ExtendScript 已成功执行，并捕获了您的消息！当前 PS 版本: " + app.version;
    } catch (e) {
        return "执行出错: " + e.toString();
    }
}
