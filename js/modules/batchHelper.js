// batchHelper.js - evalScript 批量调用优化工具
// 用于减少前后端通信开销，提升批量操作性能

/**
 * BatchHelper - evalScript 批量调用队列管理器
 *
 * 工作原理：
 * 1. 收集短时间内的多个 evalScript 请求
 * 2. 合并为一次调用，在 JSX 端批量执行
 * 3. 返回结果数组，按原始顺序分发给各个回调
 *
 * 使用场景：
 * - 批量应用字体
 * - 批量保存文档
 * - 批量导出图片
 * - 任何需要多次调用 JSX 的场景
 */
class BatchHelper {
    constructor(csInterface) {
        this.cs = csInterface;
        this.queue = [];           // 待执行的命令队列
        this.timer = null;         // 延迟执行定时器
        this.flushDelay = 50;      // 收集命令的等待时间（ms）
        this.maxBatchSize = 20;    // 单批次最大命令数
    }

    /**
     * 添加一个 JSX 调用到批量队列
     * @param {string} script - JSX 代码字符串
     * @param {Function} callback - 回调函数 callback(result)
     * @param {boolean} immediate - 是否立即执行（不等待批量）
     */
    enqueue(script, callback, immediate = false) {
        if (immediate) {
            // 立即执行模式：不加入队列，直接调用
            this.cs.evalScript(script, callback);
            return;
        }

        // 加入队列
        this.queue.push({ script, callback });

        // 如果队列已满，立即执行
        if (this.queue.length >= this.maxBatchSize) {
            this.flush();
            return;
        }

        // 重置定时器：收集更多命令
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.flush(), this.flushDelay);
    }

    /**
     * 立即执行队列中的所有命令
     */
    flush() {
        clearTimeout(this.timer);
        if (this.queue.length === 0) return;

        const batch = this.queue.splice(0, this.maxBatchSize);

        if (batch.length === 1) {
            // 只有一条命令，直接执行（避免不必要的包装）
            this.cs.evalScript(batch[0].script, batch[0].callback);
            return;
        }

        // 构建批量执行脚本
        const batchScript = this._buildBatchScript(batch.map(item => item.script));

        this.cs.evalScript(batchScript, (resultJson) => {
            let results;
            try {
                results = JSON.parse(resultJson);
            } catch (e) {
                console.error('批量调用结果解析失败:', e, resultJson);
                // 出错时，所有回调返回错误
                batch.forEach(item => {
                    if (item.callback) item.callback('ERROR: Batch parse failed');
                });
                return;
            }

            // 按顺序分发结果到各个回调
            batch.forEach((item, index) => {
                if (item.callback) {
                    item.callback(results[index]);
                }
            });
        });
    }

    /**
     * 构建批量执行的 JSX 脚本
     * @param {string[]} scripts - 脚本数组
     * @returns {string} - 包装后的批量脚本
     */
    _buildBatchScript(scripts) {
        // 转义脚本中的特殊字符
        const escapedScripts = scripts.map(s =>
            s.replace(/\\/g, '\\\\')
             .replace(/"/g, '\\"')
             .replace(/\n/g, '\\n')
             .replace(/\r/g, '\\r')
        );

        // 生成批量执行代码（在 JSX 端循环执行并收集结果）
        return `
(function() {
    var scripts = ${JSON.stringify(escapedScripts)};
    var results = [];
    for (var i = 0; i < scripts.length; i++) {
        try {
            var result = eval(scripts[i]);
            results.push(result || "SUCCESS");
        } catch (e) {
            results.push("ERROR: " + e.message);
        }
    }
    return JSON.stringify(results);
})();
        `.trim();
    }

    /**
     * 等待当前队列清空（用于确保所有操作完成）
     * @returns {Promise<void>}
     */
    waitForIdle() {
        return new Promise((resolve) => {
            const check = () => {
                if (this.queue.length === 0 && !this.timer) {
                    resolve();
                } else {
                    setTimeout(check, 10);
                }
            };
            check();
        });
    }

    /**
     * 取消所有待执行的命令
     */
    clear() {
        clearTimeout(this.timer);
        this.queue = [];
    }
}

// 暴露全局单例
window.BatchHelper = BatchHelper;
