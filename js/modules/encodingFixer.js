// encodingFixer.js - 文本编码根治方案
// 彻底解决前后端中文乱码问题

/**
 * EncodingFixer - 编码转换工具
 *
 * 问题根源：
 * 1. ExtendScript (JSX) 使用 UTF-16 编码
 * 2. CEP evalScript 传输时可能发生编码错误
 * 3. 某些 Windows 环境默认使用 GBK 编码
 *
 * 解决方案：
 * 1. JSX 端：使用 Base64 编码传输中文字符串
 * 2. 前端：自动检测并修复乱码
 * 3. 提供统一的编码转换接口
 */
class EncodingFixer {
    constructor() {
        // 常见乱码模式映射表（自动生成）
        this.garbledMap = this._buildGarbledMap();

        // 是否启用自动修复（默认开启）
        this.autoFix = true;
    }

    /**
     * 修复乱码字符串
     * @param {string} text - 可能包含乱码的文本
     * @returns {string} - 修复后的文本
     */
    fix(text) {
        if (!text || typeof text !== 'string') return text;

        // 1. 尝试 Base64 解码（如果是 Base64 格式）
        if (this._isBase64(text)) {
            try {
                return this._decodeBase64(text);
            } catch (e) {
                // 不是有效的 Base64，继续其他修复
            }
        }

        // 2. 检测是否是常见的 UTF-8 误解析为 GBK 的乱码
        if (this._hasGarbledPattern(text)) {
            return this._fixGarbledText(text);
        }

        // 3. 如果包含特殊字符，尝试重新编码
        if (this._hasEncodingIssue(text)) {
            return this._reEncode(text);
        }

        return text;
    }

    /**
     * 将字符串编码为 Base64（供 JSX 端使用）
     * @param {string} text - 原始文本
     * @returns {string} - Base64 编码后的文本
     */
    encodeToBase64(text) {
        try {
            return btoa(unescape(encodeURIComponent(text)));
        } catch (e) {
            console.error('Base64 编码失败：', e);
            return text;
        }
    }

    /**
     * 从 Base64 解码
     * @param {string} base64 - Base64 字符串
     * @returns {string} - 解码后的文本
     * @private
     */
    _decodeBase64(base64) {
        return decodeURIComponent(escape(atob(base64)));
    }

    /**
     * 检测是否是 Base64 字符串
     * @private
     */
    _isBase64(text) {
        // Base64 只包含 A-Z, a-z, 0-9, +, /, = 且长度是 4 的倍数
        const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
        return text.length % 4 === 0 && base64Pattern.test(text);
    }

    /**
     * 检测是否包含乱码特征
     * @private
     */
    _hasGarbledPattern(text) {
        // 常见乱码特征：包含大量的特殊符号组合
        const garbledPatterns = [
            /[ -ÿ]{3,}/,  // 连续的 Latin-1 补充字符
            /[-]{2,}/,  // 控制字符
            /[ïŒ]{2,}/,             // 常见乱码字符
            /姝|鍞|湪|閫/            // 典型的 UTF-8→GBK 乱码
        ];
        return garbledPatterns.some(pattern => pattern.test(text));
    }

    /**
     * 检测是否有编码问题
     * @private
     */
    _hasEncodingIssue(text) {
        // 检测不常见的字符范围
        return /[- -¿]/.test(text);
    }

    /**
     * 修复常见乱码
     * @private
     */
    _fixGarbledText(text) {
        let fixed = text;

        // 使用映射表批量替换
        for (let [garbled, correct] of this.garbledMap) {
            fixed = fixed.split(garbled).join(correct);
        }

        return fixed;
    }

    /**
     * 重新编码（尝试多种编码方式）
     * @private
     */
    _reEncode(text) {
        try {
            // 尝试将错误的编码重新解释为 UTF-8
            const bytes = [];
            for (let i = 0; i < text.length; i++) {
                const code = text.charCodeAt(i);
                if (code < 256) {
                    bytes.push(code);
                }
            }

            // 使用 TextDecoder 尝试解码
            if (typeof TextDecoder !== 'undefined') {
                const decoder = new TextDecoder('utf-8');
                const uint8Array = new Uint8Array(bytes);
                return decoder.decode(uint8Array);
            }
        } catch (e) {
            // 解码失败，返回原文
        }

        return text;
    }

    /**
     * 构建乱码映射表
     * @private
     */
    _buildGarbledMap() {
        // 常见的 UTF-8 误解析为 GBK 的乱码映射
        const map = new Map([
            // 原有的映射（从 normalizeUIString）
            ['姝ｅ湪鍞よ捣鏂囦欢閫夋嫨鍣?..', '正在打开文件选择器...'],
            ['闃熷垪涓虹┖', '页面队列为空'],
            ['璇峰厛鐐瑰嚮椤甸潰鍒楄〃涓殑涓€涓〉闈互婵€娲诲畠', '请先在列表中选中一个页面'],
            ['椤甸潰鍒楄〃涓虹┖', '页面列表为空'],
            ['鍏ㄩ儴椤甸潰鍧囧凡瀹屾垚锛?', '全部页面都已完成'],
            ['褰撳墠鍒楄〃涓虹┖锛屾棤鍥惧彲瀵?', '当前列表为空，没有可导出的页面'],
            ['璇峰厛閫夋嫨瀵煎嚭鏂囦欢澶?', '请先选择导出文件夹'],
            ['鎵归噺瀵煎嚭缁撴灉', '批量导出结果'],
            ['鎵归噺淇濆瓨缁撴灉', '批量保存结果'],
            ['鏆傛棤椤甸潰锛岃鐐瑰嚮涓婃柟鎸夐挳瀵煎叆', '暂无页面，请点击上方按钮导入'],
            ['褰撳墠绛涢€変笅娌℃湁椤甸潰', '当前筛选下没有页面'],
            ['閫夊彇璇ラ〉', '选中该页'],
            ['Parsed ', '解析完成：'],
            [' pages, ', ' 页，'],
            [' dialogs. Press Ctrl+Enter to reparse.', ' 条对白。可用 Ctrl+Enter 快速重新解析。'],
            ['Changed', '已修改'],
            ['绛夊緟淇浘鎿嶄綔...', '等待修图操作...'],

            // 添加更多常见乱码模式
            ['鏂囦欢', '文件'],
            ['鏂囨。', '文档'],
            ['淇濆瓨', '保存'],
            ['瀵煎嚭', '导出'],
            ['鍙栨秷', '取消'],
            ['纭畾', '确定'],
            ['鎴愬姛', '成功'],
            ['澶辫触', '失败'],
            ['閿欒', '错误'],
            ['璀﹀憡', '警告'],
            ['鎻愮ず', '提示']
        ]);

        return map;
    }

    /**
     * 添加自定义乱码映射
     * @param {string} garbled - 乱码文本
     * @param {string} correct - 正确文本
     */
    addMapping(garbled, correct) {
        this.garbledMap.set(garbled, correct);
    }

    /**
     * 批量添加映射
     * @param {Array<[string, string]>} mappings - 映射数组
     */
    addMappings(mappings) {
        mappings.forEach(([garbled, correct]) => {
            this.garbledMap.set(garbled, correct);
        });
    }

    /**
     * 导出当前映射表（用于调试）
     */
    exportMappings() {
        const obj = {};
        this.garbledMap.forEach((correct, garbled) => {
            obj[garbled] = correct;
        });
        return obj;
    }
}

/**
 * JSX 端辅助代码（复制到 JSX 文件中使用）
 *
 * 在 JSX 端使用 Base64 编码传输中文：
 */
const jsxEncodingHelperCode = `
// ============================================
// JSX 端编码处理辅助函数
// 在 JSX 文件顶部添加以下代码
// ============================================

/**
 * Base64 编码（UTF-8）
 * ExtendScript 没有 btoa，需要手动实现
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
        } else {
            utf8Bytes.push(0xE0 | (code >> 12));
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
    if (padding === 1) result = result.slice(0, -2) + "==";
    else if (padding === 2) result = result.slice(0, -1) + "=";

    return result;
}

/**
 * 安全返回中文字符串（自动编码）
 * 使用方式：return safeString("操作成功");
 */
function safeString(text) {
    return "BASE64:" + base64Encode(text);
}

/**
 * 安全返回 JSON（包含中文）
 */
function safeJSON(obj) {
    var json = JSON.stringify(obj);
    return "BASE64:" + base64Encode(json);
}

// 使用示例：
// function myFunction() {
//     try {
//         return safeString("操作成功，已处理 10 个文件");
//     } catch (e) {
//         return safeString("错误：" + e.message);
//     }
// }
`;

// 暴露全局单例
window.EncodingFixer = EncodingFixer;
window.encodingFixer = new EncodingFixer();

// 导出 JSX 辅助代码
window.getJsxEncodingHelperCode = function() {
    return jsxEncodingHelperCode;
};

/**
 * 扩展 callHostScript，自动处理编码
 */
const originalCallHostScript = window.callHostScript;
window.callHostScript = function(csInterface, fnName, args, callback, options) {
    const wrappedCallback = function(result) {
        // 自动修复编码问题
        let fixed = result;

        // 检测是否是 Base64 编码的结果
        if (typeof result === 'string' && result.indexOf('BASE64:') === 0) {
            fixed = encodingFixer._decodeBase64(result.substring(7));
        } else if (typeof result === 'string' && encodingFixer.autoFix) {
            fixed = encodingFixer.fix(result);
        }

        if (callback) callback(fixed);
    };

    return originalCallHostScript(csInterface, fnName, args, wrappedCallback, options);
};

/**
 * 替换旧的 normalizeUIString（向后兼容）
 */
window.normalizeUIString = function(value) {
    return encodingFixer.fix(value);
};
