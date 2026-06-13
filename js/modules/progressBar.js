// progressBar.js - 批量操作进度条组件
// 显示实时进度、预估剩余时间、支持取消

/**
 * ProgressBar - 进度条管理器
 *
 * 功能：
 * 1. 显示当前进度百分比
 * 2. 显示当前步骤信息
 * 3. 预估剩余时间
 * 4. 支持取消操作
 * 5. 支持多任务同时显示
 */
class ProgressBar {
    constructor() {
        this.container = null;
        this.activeBars = new Map(); // taskId -> barElement
        this.taskData = new Map();   // taskId -> { total, current, startTime, cancelled }
        this._ensureContainer();
    }

    /**
     * 确保进度条容器存在
     * @private
     */
    _ensureContainer() {
        this.container = document.getElementById('progress-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'progress-container';
            this.container.className = 'progress-container';
            document.body.appendChild(this.container);
        }
    }

    /**
     * 创建新的进度条
     * @param {string} taskId - 任务 ID（唯一标识）
     * @param {number} total - 总步骤数
     * @param {string} title - 任务标题
     * @param {Object} options - 选项
     * @param {boolean} options.cancelable - 是否可取消（默认 true）
     * @param {Function} options.onCancel - 取消回调
     * @returns {string} taskId
     */
    create(taskId, total, title, options) {
        options = options || {};
        taskId = taskId || 'task-' + Date.now();

        // 如果已存在同 ID 任务，先移除
        if (this.activeBars.has(taskId)) {
            this.remove(taskId);
        }

        // 创建进度条元素
        const bar = document.createElement('div');
        bar.className = 'progress-bar';
        bar.dataset.taskId = taskId;

        const cancelable = options.cancelable !== false;
        bar.innerHTML = `
            <div class="progress-bar__header">
                <div class="progress-bar__title">${title || '处理中...'}</div>
                ${cancelable ? '<button class="progress-bar__cancel">✕</button>' : ''}
            </div>
            <div class="progress-bar__info">
                <span class="progress-bar__status">准备中...</span>
                <span class="progress-bar__eta"></span>
            </div>
            <div class="progress-bar__track">
                <div class="progress-bar__fill" style="width: 0%"></div>
            </div>
            <div class="progress-bar__details">
                <span class="progress-bar__percent">0%</span>
                <span class="progress-bar__count">0 / ${total}</span>
            </div>
        `;

        // 绑定取消按钮
        if (cancelable) {
            const cancelBtn = bar.querySelector('.progress-bar__cancel');
            cancelBtn.addEventListener('click', () => {
                this._handleCancel(taskId, options.onCancel);
            });
        }

        this.container.appendChild(bar);
        this.activeBars.set(taskId, bar);

        // 记录任务数据
        this.taskData.set(taskId, {
            total: total,
            current: 0,
            startTime: Date.now(),
            cancelled: false,
            title: title
        });

        return taskId;
    }

    /**
     * 更新进度
     * @param {string} taskId - 任务 ID
     * @param {number} current - 当前步骤
     * @param {string} status - 当前状态描述（可选）
     */
    update(taskId, current, status) {
        if (!this.activeBars.has(taskId)) return;

        const bar = this.activeBars.get(taskId);
        const data = this.taskData.get(taskId);

        data.current = current;

        // 计算进度百分比
        const percent = Math.round((current / data.total) * 100);

        // 更新 UI
        bar.querySelector('.progress-bar__fill').style.width = percent + '%';
        bar.querySelector('.progress-bar__percent').textContent = percent + '%';
        bar.querySelector('.progress-bar__count').textContent = `${current} / ${data.total}`;

        if (status) {
            bar.querySelector('.progress-bar__status').textContent = status;
        }

        // 计算预估剩余时间
        if (current > 0 && current < data.total) {
            const elapsed = Date.now() - data.startTime;
            const avgTime = elapsed / current;
            const remaining = avgTime * (data.total - current);
            const eta = this._formatTime(remaining);
            bar.querySelector('.progress-bar__eta').textContent = `剩余 ${eta}`;
        }

        // 完成时自动移除
        if (current >= data.total) {
            bar.querySelector('.progress-bar__status').textContent = status || '完成';
            bar.querySelector('.progress-bar__eta').textContent = '';
            bar.classList.add('progress-bar--complete');
            setTimeout(() => this.remove(taskId), 2000);
        }
    }

    /**
     * 标记任务为失败
     * @param {string} taskId - 任务 ID
     * @param {string} error - 错误信息
     */
    fail(taskId, error) {
        if (!this.activeBars.has(taskId)) return;

        const bar = this.activeBars.get(taskId);
        bar.classList.add('progress-bar--error');
        bar.querySelector('.progress-bar__status').textContent = error || '操作失败';
        bar.querySelector('.progress-bar__eta').textContent = '';

        setTimeout(() => this.remove(taskId), 5000);
    }

    /**
     * 移除进度条
     * @param {string} taskId - 任务 ID
     */
    remove(taskId) {
        if (!this.activeBars.has(taskId)) return;

        const bar = this.activeBars.get(taskId);
        bar.style.animation = 'progressOut 0.3s ease forwards';
        setTimeout(() => {
            if (bar.parentNode) bar.parentNode.removeChild(bar);
        }, 300);

        this.activeBars.delete(taskId);
        this.taskData.delete(taskId);
    }

    /**
     * 检查任务是否已取消
     * @param {string} taskId - 任务 ID
     * @returns {boolean}
     */
    isCancelled(taskId) {
        const data = this.taskData.get(taskId);
        return data ? data.cancelled : false;
    }

    /**
     * 处理取消操作
     * @private
     */
    _handleCancel(taskId, callback) {
        const data = this.taskData.get(taskId);
        if (!data) return;

        window.showConfirmModal('确定要取消当前操作吗？', () => {
            data.cancelled = true;
            const bar = this.activeBars.get(taskId);
            if (bar) {
                bar.classList.add('progress-bar--cancelled');
                bar.querySelector('.progress-bar__status').textContent = '已取消';
                bar.querySelector('.progress-bar__eta').textContent = '';
            }
            if (callback) callback();
            setTimeout(() => this.remove(taskId), 2000);
        });
    }

    /**
     * 格式化时间
     * @private
     */
    _formatTime(ms) {
        const seconds = Math.round(ms / 1000);
        if (seconds < 60) return `${seconds} 秒`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        if (minutes < 60) return `${minutes} 分 ${remainingSeconds} 秒`;
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours} 小时 ${remainingMinutes} 分`;
    }

    /**
     * 清除所有进度条
     */
    clearAll() {
        this.activeBars.forEach((bar, taskId) => {
            this.remove(taskId);
        });
    }
}

// 暴露全局单例
window.ProgressBar = ProgressBar;
window.progressBar = new ProgressBar();
