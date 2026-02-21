// main.jsx
// 这是供前端调用的核心函数集

function testConnection(msg) {
    try {
        // 弹出 Photoshop 原生对话框来验证是否工作
        alert("【来自后端的问候】\n已成功接收到前端消息：\n" + msg + "\n\n恭喜！CEP 通信管道已完全打通。");
        return "ExtendScript 成功执行，并捕获了您的消息！当前环境：PS " + app.version;
    } catch (e) {
        return "ExtendScript 内部异常: " + (e.toString ? e.toString() : e);
    }
}
