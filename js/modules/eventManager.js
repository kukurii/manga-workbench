// eventManager.js - 事件监听器自动管理工具
// 防止内存泄漏：追踪所有监听器，支持批量清理

/**
 * EventManager - 事件监听器生命周期管理
 *
 * 功能：
 * 1. 追踪所有通过它添加的事件监听器
 * 2. 自动清理不再使用的监听器
 * 3. 支持按作用域批量清理
 * 4. 防止重复绑定
 *
 * 使用场景：
 * - 动态创建/销毁的 DOM 元素
 * - 需要频繁重新绑定的事件
 * - 模态框、弹窗等临时 UI
 */
class EventManager {
    constructor() {
        this.listeners = new Map(); // element -> [{type, handler, scope}]
        this.scopeMap = new Map();  // scope -> [elements]
    }

    /**
     * 添加事件监听器（会自动追踪）
     * @param {Element} element - DOM 元素
     * @param {string} type - 事件类型
     * @param {Function} handler - 事件处理函数
     * @param {object} options - 选项 { scope, capture, once, passive }
     */
    on(element, type, handler, options) {
        if (!element || !type || !handler) {
            console.warn('[EventManager] 无效的参数', { element, type, handler });
            return;
        }

        options = options || {};
        const scope = options.scope || 'default';

        // 检查是否已存在相同的监听器（防止重复绑定）
        if (this._hasListener(element, type, handler)) {
            console.warn('[EventManager] 重复绑定事件', { element, type, scope });
            return;
        }

        // 添加监听器
        const listenerOptions = {
            capture: options.capture,
            once: options.once,
            passive: options.passive
        };
        element.addEventListener(type, handler, listenerOptions);

        // 追踪监听器
        if (!this.listeners.has(element)) {
            this.listeners.set(element, []);
        }
        this.listeners.get(element).push({ type, handler, scope, options: listenerOptions });

        // 追踪作用域
        if (!this.scopeMap.has(scope)) {
            this.scopeMap.set(scope, new Set());
        }
        this.scopeMap.get(scope).add(element);
    }

    /**
     * 移除事件监听器
     * @param {Element} element - DOM 元素
     * @param {string} type - 事件类型
     * @param {Function} handler - 事件处理函数
     */
    off(element, type, handler) {
        if (!element || !this.listeners.has(element)) return;

        const elementListeners = this.listeners.get(element);
        const index = elementListeners.findIndex(
            l => l.type === type && l.handler === handler
        );

        if (index === -1) return;

        // 移除监听器
        const listener = elementListeners[index];
        element.removeEventListener(type, handler, listener.options);

        // 从追踪中删除
        elementListeners.splice(index, 1);
        if (elementListeners.length === 0) {
            this.listeners.delete(element);
        }
    }

    /**
     * 移除元素上的所有事件监听器
     * @param {Element} element - DOM 元素
     */
    offAll(element) {
        if (!element || !this.listeners.has(element)) return;

        const elementListeners = this.listeners.get(element);
        elementListeners.forEach(({ type, handler, options }) => {
            element.removeEventListener(type, handler, options);
        });

        this.listeners.delete(element);

        // 从所有作用域中移除
        this.scopeMap.forEach((elements) => {
            elements.delete(element);
        });
    }

    /**
     * 清理指定作用域的所有事件监听器
     * @param {string} scope - 作用域名称
     */
    clearScope(scope) {
        if (!this.scopeMap.has(scope)) return;

        const elements = this.scopeMap.get(scope);
        elements.forEach(element => {
            if (!this.listeners.has(element)) return;

            const elementListeners = this.listeners.get(element);
            const scopeListeners = elementListeners.filter(l => l.scope === scope);

            scopeListeners.forEach(({ type, handler, options }) => {
                element.removeEventListener(type, handler, options);
            });

            // 从追踪中移除该作用域的监听器
            const remaining = elementListeners.filter(l => l.scope !== scope);
            if (remaining.length === 0) {
                this.listeners.delete(element);
            } else {
                this.listeners.set(element, remaining);
            }
        });

        this.scopeMap.delete(scope);
    }

    /**
     * 清理所有事件监听器
     */
    clearAll() {
        this.listeners.forEach((elementListeners, element) => {
            elementListeners.forEach(({ type, handler, options }) => {
                element.removeEventListener(type, handler, options);
            });
        });

        this.listeners.clear();
        this.scopeMap.clear();
    }

    /**
     * 获取统计信息
     */
    getStats() {
        let totalListeners = 0;
        this.listeners.forEach(elementListeners => {
            totalListeners += elementListeners.length;
        });

        return {
            elements: this.listeners.size,
            listeners: totalListeners,
            scopes: this.scopeMap.size
        };
    }

    /**
     * 检查是否已存在相同的监听器
     * @private
     */
    _hasListener(element, type, handler) {
        if (!this.listeners.has(element)) return false;
        const elementListeners = this.listeners.get(element);
        return elementListeners.some(l => l.type === type && l.handler === handler);
    }

    /**
     * 代理方法：addEventListener 的便捷别名
     */
    addEventListener(element, type, handler, options) {
        return this.on(element, type, handler, options);
    }

    /**
     * 代理方法：removeEventListener 的便捷别名
     */
    removeEventListener(element, type, handler) {
        return this.off(element, type, handler);
    }
}

/**
 * DOM 节点销毁时自动清理事件监听器
 * 使用 MutationObserver 监听 DOM 变化
 */
class AutoCleanupObserver {
    constructor(eventManager) {
        this.eventManager = eventManager;
        this.observer = null;
    }

    /**
     * 启动自动清理监听
     */
    start() {
        if (this.observer) return;

        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;

                    // 清理该节点及其所有子节点的事件监听器
                    this.eventManager.offAll(node);
                    if (node.querySelectorAll) {
                        node.querySelectorAll('*').forEach(child => {
                            this.eventManager.offAll(child);
                        });
                    }
                });
            });
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * 停止自动清理监听
     */
    stop() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

// 暴露全局单例
window.EventManager = EventManager;
window.AutoCleanupObserver = AutoCleanupObserver;

// 创建全局实例（在 main.js 中初始化）
if (typeof window.eventManager === 'undefined') {
    window.eventManager = new EventManager();
    window.autoCleanup = new AutoCleanupObserver(window.eventManager);
    // 自动启动 DOM 清理监听
    window.autoCleanup.start();
}
