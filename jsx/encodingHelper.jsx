// encodingHelper.jsx
// JSX 端编码处理辅助函数
// 解决中文字符串在 evalScript 传输时的乱码问题

/**
 * Base64 编码（UTF-8）
 * ExtendScript 没有 btoa，需要手动实现
 *
 * @param {string} str - 要编码的字符串
 * @returns {string} - Base64 编码后的字符串
 */
function base64Encode(str) {
    var base64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var result = "";
    var i = 0;

    // 将字符串转为 UTF-8 字节数组
    var utf8Bytes = [];
    for (var j = 0; j < str.length; j++) {
        var code = str.charCodeAt(j);
        if (code < 0x80) {
            utf8Bytes.push(code);
        } else if (code < 0x800) {
            utf8Bytes.push(0xC0 | (code >> 6));
            utf8Bytes.push(0x80 | (code & 0x3F));
        } else if (code < 0x10000) {
            utf8Bytes.push(0xE0 | (code >> 12));
            utf8Bytes.push(0x80 | ((code >> 6) & 0x3F));
            utf8Bytes.push(0x80 | (code & 0x3F));
        } else {
            // 处理 4 字节 UTF-8 字符（如 emoji）
            utf8Bytes.push(0xF0 | (code >> 18));
            utf8Bytes.push(0x80 | ((code >> 12) & 0x3F));
            utf8Bytes.push(0x80 | ((code >> 6) & 0x3F));
            utf8Bytes.push(0x80 | (code & 0x3F));
        }
    }

    // Base64 编码
    while (i < utf8Bytes.length) {
        var b1 = utf8Bytes[i++];
        var b2 = i < utf8Bytes.length ? utf8Bytes[i++] : 0;
        var b3 = i < utf8Bytes.length ? utf8Bytes[i++] : 0;

        result += base64chars.charAt(b1 >> 2);
        result += base64chars.charAt(((b1 & 3) << 4) | (b2 >> 4));
        result += base64chars.charAt(((b2 & 15) << 2) | (b3 >> 6));
        result += base64chars.charAt(b3 & 63);
    }

    // 补齐 padding
    var padding = utf8Bytes.length % 3;
    if (padding === 1) {
        result = result.slice(0, -2) + "==";
    } else if (padding === 2) {
        result = result.slice(0, -1) + "=";
    }

    return result;
}

/**
 * 安全返回中文字符串（自动编码）
 *
 * 使用方式：
 *   return safeString("操作成功");
 *
 * @param {string} text - 包含中文的文本
 * @returns {string} - Base64 编码后的文本（带 BASE64: 前缀）
 */
function safeString(text) {
    if (!text) return "";
    return "BASE64:" + base64Encode(text);
}

/**
 * 安全返回 JSON（包含中文）
 *
 * 使用方式：
 *   return safeJSON({ success: true, message: "操作成功" });
 *
 * @param {Object} obj - 要序列化的对象
 * @returns {string} - Base64 编码后的 JSON 字符串
 */
function safeJSON(obj) {
    var json = JSON.stringify(obj);
    return "BASE64:" + base64Encode(json);
}

/**
 * 标准响应格式（配合 errorHandler.js 使用）
 *
 * 使用方式：
 *   return jsonResponse(true, { count: 10 }, null);
 *   return jsonResponse(false, null, "操作失败");
 *
 * @param {boolean} success - 是否成功
 * @param {*} data - 成功时的数据
 * @param {string} error - 失败时的错误信息
 * @returns {string} - Base64 编码后的 JSON 响应
 */
function jsonResponse(success, data, error) {
    var response = {
        success: success,
        data: data || null,
        error: error || null
    };
    return safeJSON(response);
}

/**
 * 快速返回成功响应
 *
 * 使用方式：
 *   return successResponse({ count: 10, message: "完成" });
 *
 * @param {*} data - 返回数据
 * @returns {string} - Base64 编码后的成功响应
 */
function successResponse(data) {
    return jsonResponse(true, data, null);
}

/**
 * 快速返回失败响应
 *
 * 使用方式：
 *   return errorResponse("文件不存在");
 *
 * @param {string} error - 错误信息
 * @returns {string} - Base64 编码后的失败响应
 */
function errorResponse(error) {
    return jsonResponse(false, null, error);
}

// ============================================
// 使用示例
// ============================================

/**
 * 示例 1：返回简单字符串
 */
function exampleSimpleString() {
    try {
        // 你的逻辑
        var result = "操作成功，已处理 10 个文件";
        return safeString(result);
    } catch (e) {
        return safeString("错误：" + e.message);
    }
}

/**
 * 示例 2：返回标准 JSON 响应
 */
function exampleJsonResponse() {
    try {
        // 检查前置条件
        if (!app.documents.length) {
            return errorResponse("请先打开一个文档");
        }

        // 执行操作
        var doc = app.activeDocument;
        var layerCount = doc.layers.length;

        // 返回成功响应
        return successResponse({
            name: doc.name,
            layerCount: layerCount,
            message: "文档信息获取成功"
        });

    } catch (e) {
        return errorResponse("操作失败：" + e.message);
    }
}

/**
 * 示例 3：返回复杂对象
 */
function exampleComplexObject() {
    try {
        var result = {
            total: 100,
            processed: 80,
            failed: 5,
            skipped: 15,
            details: [
                { file: "页面01.psd", status: "成功" },
                { file: "页面02.psd", status: "失败：文件损坏" }
            ]
        };

        return successResponse(result);
    } catch (e) {
        return errorResponse(e.message);
    }
}

// ============================================
// 注意事项
// ============================================

/*
1. 所有返回中文的函数都应该使用这些辅助函数
2. 前端会自动解码 BASE64: 前缀的字符串
3. JSON 响应会自动解析，前端收到的是对象而不是字符串
4. 如果不使用这些函数，中文可能会显示为乱码

推荐做法：
- 返回字符串 → 使用 safeString()
- 返回 JSON → 使用 successResponse() 或 errorResponse()
- 返回复杂对象 → 使用 successResponse()

不推荐：
- 直接 return "中文字符串"  // 可能乱码
- 直接 return JSON.stringify({...})  // 中文可能乱码
*/
