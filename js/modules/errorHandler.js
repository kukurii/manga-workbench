// errorHandler.js - 统一错误处理机制
// 前后端统一的错误格式和处理流程

/**
 * 标准响应格式
 * @typedef {Object} StandardResponse
 * @property {boolean} success - 操作是否成功
 * @property {*} data - 成功时的数据
 * @property {string} error - 失败时的错误信息
 * @property {string} code - 错误代码（可选）
 */

/**
 * ErrorHandler - 统一错误处理工具
 */
class ErrorHandler {
    constructor() {
        this.errorLog = []; // 错误日志记录
        this.maxLogSize = 100; // 最多保留 100 条错误
    }

    /**
     * 创建成功响应
     * @param {*} data - 返回数据
     * @returns {StandardResponse}
     */
    success(data) {
        return {
            success: true,
            data: data || null,
            error: null
        };
    }

    /**
     * 创建失败响应
     * @param {string} error - 错误信息
     * @param {string} code - 错误代码（可选）
     * @returns {StandardResponse}
     */
    fail(error, code) {
        const response = {
            success: false,
            data: null,
            error: error || '未知错误'
        };

        if (code) response.code = code;

        // 记录错误日志
        this._logError(error, code);

        return response;
    }

    /**
     * 包装函数调用，自动捕获异常并返回标准格式
     * @param {Function} fn - 要执行的函数
     * @param {*} context - 函数的 this 上下文
     * @returns {StandardResponse}
     */
    wrap(fn, context) {
        try {
            const result = fn.call(context);
            // 如果返回值已经是标准格式，直接返回
            if (result && typeof result === 'object' && 'success' in result) {
                return result;
            }
            return this.success(result);
        } catch (e) {
            return this.fail(e.message, e.code || 'EXCEPTION');
        }
    }

    /**
     * 包装异步函数调用
     * @param {Function} fn - 要执行的异步函数
     * @param {*} context - 函数的 this 上下文
     * @returns {Promise<StandardResponse>}
     */
    async wrapAsync(fn, context) {
        try {
            const result = await fn.call(context);
            if (result && typeof result === 'object' && 'success' in result) {
                return result;
            }
            return this.success(result);
        } catch (e) {
            return this.fail(e.message, e.code || 'EXCEPTION');
        }
    }

    /**
     * 解析 evalScript 返回值为标准格式
     * @param {string} result - evalScript 返回的字符串
     * @returns {StandardResponse}
     */
    parseEvalScriptResult(result) {
        if (!result || result === 'undefined') {
            return this.success(null);
        }

        // 如果是 ERROR: 开头的字符串，视为错误
        if (typeof result === 'string' && result.indexOf('ERROR:') === 0) {
            const error = result.replace('ERROR:', '').trim();
            return this.fail(error, 'EVAL_SCRIPT_ERROR');
        }

        // 尝试解析为 JSON
        if (typeof result === 'string') {
            try {
                const parsed = JSON.parse(result);
                // 如果已经是标准格式
                if (parsed && typeof parsed === 'object' && 'success' in parsed) {
                    return parsed;
                }
                return this.success(parsed);
            } catch (e) {
                // 不是 JSON，当作普通字符串
                return this.success(result);
            }
        }

        return this.success(result);
    }

    /**
     * 统一处理响应并显示提示
     * @param {StandardResponse} response - 标准响应对象
     * @param {Object} options - 选项
     * @param {string} options.successMessage - 成功提示（不传则不显示）
     * @param {boolean} options.showError - 是否显示错误提示（默认 true）
     * @param {Function} options.onSuccess - 成功回调
     * @param {Function} options.onError - 失败回调
     */
    handle(response, options) {
        options = options || {};

        if (response.success) {
            if (options.successMessage) {
                window.showToast(options.successMessage, 'success');
            }
            if (options.onSuccess) {
                options.onSuccess(response.data);
            }
        } else {
            if (options.showError !== false) {
                window.showToast(response.error, 'error');
            }
            if (options.onError) {
                options.onError(response.error, response.code);
            }
        }

        return response;
    }

    /**
     * 获取错误日志
     * @param {number} limit - 返回最近的 N 条（默认全部）
     * @returns {Array}
     */
    getErrorLog(limit) {
        if (limit) {
            return this.errorLog.slice(-limit);
        }
        return [...this.errorLog];
    }

    /**
     * 清空错误日志
     */
    clearErrorLog() {
        this.errorLog = [];
    }

    /**
     * 记录错误
     * @private
     */
    _logError(error, code) {
        this.errorLog.push({
            timestamp: new Date().toISOString(),
            error: error,
            code: code || 'UNKNOWN',
            stack: new Error().stack
        });

        // 限制日志大小
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }
    }

    /**
     * 导出错误日志为文本
     * @returns {string}
     */
    exportErrorLog() {
        return this.errorLog.map(entry => {
            return `[${entry.timestamp}] ${entry.code}: ${entry.error}`;
        }).join('\n');
    }
}

/**
 * JSX 端辅助函数（复制到 JSX 文件中使用）
 *
 * 在 JSX 中使用标准响应格式：
 *
 * function myFunction() {
 *     try {
 *         var result = doSomething();
 *         return jsonResponse(true, result);
 *     } catch (e) {
 *         return jsonResponse(false, null, e.message);
 *     }
 * }
 */
const jsxHelperCode = `
// 在 JSX 文件顶部添加此辅助函数
function jsonResponse(success, data, error) {
    return JSON.stringify({
        success: success,
        data: data || null,
        error: error || null
    });
}

// 使用示例
function exampleJsxFunction() {
    try {
        // 你的逻辑
        var result = { count: 10, message: "完成" };
        return jsonResponse(true, result);
    } catch (e) {
        return jsonResponse(false, null, "操作失败: " + e.message);
    }
}
`;

// 暴露全局单例
window.ErrorHandler = ErrorHandler;
window.errorHandler = new ErrorHandler();

// 导出 JSX 辅助代码（可以复制到剪贴板）
window.getJsxHelperCode = function() {
    return jsxHelperCode;
};

/**
 * 扩展 callHostScript，自动使用错误处理
 */
window.callHostScriptSafe = function(csInterface, fnName, args, callback, options) {
    const originalCallback = callback;
    const wrappedCallback = function(result) {
        const response = window.errorHandler.parseEvalScriptResult(result);
        if (originalCallback) {
            originalCallback(response);
        }
    };

    return window.callHostScript(csInterface, fnName, args, wrappedCallback, options);
};
