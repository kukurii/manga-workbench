// presets.js - 全局预设、本地存储与缓存管理

class PresetsManager {
    constructor(csInterface, extPath, dataDir) {
        this.cs = csInterface;
        this.extPath = extPath;
        this.dataDir = dataDir;

        // 默认供应商数据结构
        this.defaultProvider = {
            id: this.generateUUID(),
            name: '新建供应商',
            baseUrl: '',
            format: 'openai',
            apiKey: '',
            models: ['gpt-4o-mini']
        };

        this.providers = [];
        this.activeProviderId = null;

        this.initDOM();
        this.bindEvents();
        this.loadSettings();
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    initDOM() {
        this.btnClearFontCache = document.getElementById('btn-clear-font-cache');
        this.btnReload = document.getElementById('btn-reload-extension');
        
        // 多供应商 DOM
        this.listContainer = document.getElementById('provider-list-container');
        this.btnAddProvider = document.getElementById('btn-add-provider');
        this.detailPanel = document.getElementById('provider-detail-panel');
        
        // 详情部分
        this.inputName = document.getElementById('provider-name');
        this.inputUrl = document.getElementById('provider-url');
        this.inputKey = document.getElementById('provider-key');
        this.btnToggleKeyVis = document.getElementById('btn-toggle-key-vis');
        this.formatBtns = document.querySelectorAll('.provider-format-btn');
        this.modelListContainer = document.getElementById('model-list-container');
        this.btnAddModel = document.getElementById('btn-add-model');
        this.btnTestProvider = document.getElementById('btn-test-provider');
    }

    bindEvents() {
        // 清理字体缓存文件
        if (this.btnClearFontCache) {
            this.btnClearFontCache.addEventListener('click', () => {
                showConfirmModal("确定要清理字体列表缓存吗？\n下次打开字体面板将重新扫描系统字体。", () => {
                    const cachePath = this.dataDir + "/font_cache.json";
                    const result = window.cep.fs.deleteFile(cachePath);
                    if (result.err === window.cep.fs.NO_ERROR || result.err === window.cep.fs.ERR_NOT_FOUND) {
                        showToast("字体缓存清理成功。");
                        if (window.fontManager) {
                            window.fontManager.allFonts = [];
                            const container = document.getElementById('font-list-container');
                            if (container) container.innerHTML = '<div class="placeholder">缓存已清空，点击刷新按钮重新生成</div>';
                        }
                    } else {
                        showToast("缓存不存在或清理失败，错误码：" + result.err);
                    }
                });
            });
        }

        // 强杀重载整个 CEP 插件前端环境
        if (this.btnReload) {
            this.btnReload.addEventListener('click', () => {
                showConfirmModal("确定要强制重载插件吗？", () => {
                    window.location.reload(true);
                });
            });
        }

        // ==========================================
        // 多供应商交互
        // ==========================================
        if (this.btnAddProvider) {
            this.btnAddProvider.addEventListener('click', () => this.addProvider());
        }

        if (this.btnToggleKeyVis) {
            this.btnToggleKeyVis.addEventListener('click', () => {
                const type = this.inputKey.type === 'password' ? 'text' : 'password';
                this.inputKey.type = type;
            });
        }

        // 绑定详情输入框 change/input 事件进行自动保存
        const autoSaveHandler = () => {
            if (this.activeProviderId) {
                this.saveCurrentDetail();
                this.renderProviderList(); // 刷新列表以更新名称等
                this.saveSettingsToLocal();
            }
        };

        if (this.inputName) this.inputName.addEventListener('input', autoSaveHandler);
        if (this.inputUrl) this.inputUrl.addEventListener('input', autoSaveHandler);
        if (this.inputKey) this.inputKey.addEventListener('input', autoSaveHandler);

        // API 格式切换
        if (this.formatBtns) {
            this.formatBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.formatBtns.forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    
                    const format = e.target.getAttribute('data-format');
                    const urlLabel = document.getElementById('provider-url-label');
                    
                    if (format === 'gemini') {
                        // 如果切到 gemini 且当前 Base URL 为空，贴心补充官方默认地址
                        if (this.inputUrl && !this.inputUrl.value.trim()) {
                            this.inputUrl.value = 'https://generativelanguage.googleapis.com';
                        }
                        // 隐藏 URL 输入框和标签
                        if (this.inputUrl) this.inputUrl.style.display = 'none';
                        if (urlLabel) urlLabel.style.display = 'none';
                    } else {
                        // 显示 URL 输入框和标签
                        if (this.inputUrl) {
                            this.inputUrl.style.display = 'block';
                            // 如果是从 Gemini 默认链接切回来，则清空
                            if (this.inputUrl.value === 'https://generativelanguage.googleapis.com') {
                                this.inputUrl.value = '';
                            }
                        }
                        if (urlLabel) urlLabel.style.display = 'block';
                    }
                    
                    autoSaveHandler();
                });
            });
        }

        // 模型相关
        if (this.btnAddModel) {
            this.btnAddModel.addEventListener('click', () => {
                if (!this.activeProviderId) return;
                const provider = this.providers.find(p => p.id === this.activeProviderId);
                if (provider && provider.models.length < 3) {
                    provider.models.push('new-model');
                    this.renderModelList(provider);
                    this.saveSettingsToLocal();
                } else {
                    showToast("最多只能添加 3 个模型", "info");
                }
            });
        }

        // 测试
        if (this.btnTestProvider) {
            this.btnTestProvider.addEventListener('click', async () => await this.handleTestConnection());
        }
    }

    // ==========================================
    // 界面渲染与数据同步
    // ==========================================
    loadSettings() {
        try {
            const savedStr = localStorage.getItem('manga_wb_providers');
            if (savedStr) {
                this.providers = JSON.parse(savedStr);
            } else {
                // 如果没有新结构数据，尝试兼容旧版迁移
                const oldKey = localStorage.getItem('manga_wb_api_key');
                const oldType = localStorage.getItem('manga_wb_model_type') || 'gemini';
                const oldUrl = localStorage.getItem('manga_wb_base_url') || '';
                const oldName = localStorage.getItem('manga_wb_model_name') || '';
                
                if (oldKey) {
                    this.providers.push({
                        id: this.generateUUID(),
                        name: '默认供应商 (旧版迁移)',
                        baseUrl: oldUrl,
                        format: oldType,
                        apiKey: oldKey,
                        models: [oldName || 'gemini-2.0-flash']
                    });
                }
            }
        } catch(e) {
            console.error("解析 API 供应商配置失败，使用默认", e);
        }

        this.renderProviderList();
        
        if (this.providers.length > 0) {
            this.setActiveProvider(this.providers[0].id);
        } else {
            this.detailPanel.style.display = 'none';
        }
    }

    saveSettingsToLocal() {
        localStorage.setItem('manga_wb_providers', JSON.stringify(this.providers));
        
        // 保留向后兼容，写入第一个供应商的数据，供现有其他地方直读
        if (this.providers.length > 0) {
            const mainP = this.providers[0];
            localStorage.setItem('manga_wb_api_key', mainP.apiKey || '');
            localStorage.setItem('manga_wb_model_type', mainP.format || 'gemini');
            localStorage.setItem('manga_wb_base_url', mainP.baseUrl || '');
            localStorage.setItem('manga_wb_model_name', mainP.models && mainP.models[0] ? mainP.models[0] : '');
            localStorage.setItem('manga_workbench_api_key', mainP.apiKey || ''); // 旧密钥
        } else {
            localStorage.removeItem('manga_wb_api_key');
            localStorage.removeItem('manga_workbench_api_key');
        }
    }

    addProvider() {
        const newProvider = JSON.parse(JSON.stringify(this.defaultProvider));
        newProvider.id = this.generateUUID();
        this.providers.push(newProvider);
        this.saveSettingsToLocal();
        this.renderProviderList();
        this.setActiveProvider(newProvider.id);
    }

    deleteProvider(id) {
        showConfirmModal("确定要删除此供应商吗？", () => {
            this.providers = this.providers.filter(p => p.id !== id);
            this.saveSettingsToLocal();
            this.renderProviderList();
            if (this.providers.length > 0) {
                this.setActiveProvider(this.providers[0].id);
            } else {
                this.activeProviderId = null;
                this.detailPanel.style.display = 'none';
            }
        });
    }

    setActiveProvider(id) {
        this.activeProviderId = id;
        this.renderProviderList(); // 刷新激活样式
        
        const provider = this.providers.find(p => p.id === id);
        if (!provider) return;

        this.detailPanel.style.display = 'block';
        if (this.inputName) this.inputName.value = provider.name || '';
        if (this.inputUrl) this.inputUrl.value = provider.baseUrl || '';
        if (this.inputKey) this.inputKey.value = provider.apiKey || '';
        
        const currentFormat = provider.format || 'openai';
        const urlLabel = document.getElementById('provider-url-label');
        
        // 渲染格式按钮
        if (this.formatBtns) {
            this.formatBtns.forEach(btn => {
                if (btn.getAttribute('data-format') === currentFormat) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
        
        // 切换不同供应商时，如果 format 是 gemini 则隐藏 URL 输入框
        if (currentFormat === 'gemini') {
            if (this.inputUrl) this.inputUrl.style.display = 'none';
            if (urlLabel) urlLabel.style.display = 'none';
        } else {
            if (this.inputUrl) this.inputUrl.style.display = 'block';
            if (urlLabel) urlLabel.style.display = 'block';
        }
        
        this.renderModelList(provider);
    }

    saveCurrentDetail() {
        if (!this.activeProviderId) return;
        const providerIndex = this.providers.findIndex(p => p.id === this.activeProviderId);
        if (providerIndex === -1) return;
        
        const provider = this.providers[providerIndex];
        provider.name = this.inputName ? this.inputName.value.trim() : '';
        provider.baseUrl = this.inputUrl ? this.inputUrl.value.trim() : '';
        provider.apiKey = this.inputKey ? this.inputKey.value.trim() : '';
        
        let activeFormat = 'openai';
        if (this.formatBtns) {
            const activeBtn = Array.from(this.formatBtns).find(b => b.classList.contains('active'));
            if (activeBtn) activeFormat = activeBtn.getAttribute('data-format');
        }
        provider.format = activeFormat;
        
        // 模型列表由 inputs 的 blur/change 独立实时保存，这里仅处理其它表单元素
    }

    // ==========================================
    // 拖拽与渲染列表
    // ==========================================
    renderProviderList() {
        if (!this.listContainer) return;
        this.listContainer.innerHTML = '';
        
        if (this.providers.length === 0) {
            this.listContainer.innerHTML = '<div class="text-dim text-center" style="font-size:11px; padding:10px;">暂无供应商，请添加</div>';
            return;
        }

        this.providers.forEach((provider, index) => {
            const isMain = index === 0;
            const badgeLabel = isMain ? '主' : `备${index}`;
            const badgeClass = isMain ? 'badge-main' : 'badge-backup';
            const isActive = provider.id === this.activeProviderId ? 'active' : '';

            const el = document.createElement('div');
            el.className = `provider-item ${isActive}`;
            el.draggable = true;
            el.dataset.id = provider.id;
            
            el.innerHTML = `
                <div class="provider-drag-handle" title="拖拽排序">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1.5"></circle><circle cx="15" cy="5" r="1.5"></circle><circle cx="9" cy="12" r="1.5"></circle><circle cx="15" cy="12" r="1.5"></circle><circle cx="9" cy="19" r="1.5"></circle><circle cx="15" cy="19" r="1.5"></circle></svg>
                </div>
                <div class="provider-icon">
                    ${provider.name ? provider.name.charAt(0).toUpperCase() : 'A'}
                </div>
                <div class="provider-info">
                    <div class="provider-name-text" title="${provider.name}">${provider.name || '未命名'}</div>
                    <div class="text-faint" style="font-size:10px;">${provider.format || 'openai'}</div>
                </div>
                <div class="provider-badge ${badgeClass}">${badgeLabel}</div>
                <button class="provider-delete" title="删除">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            `;

            // 事件点击
            el.addEventListener('click', (e) => {
                if(e.target.closest('.provider-delete') || e.target.closest('.provider-drag-handle')) return;
                this.setActiveProvider(provider.id);
            });

            // 删除
            const delBtn = el.querySelector('.provider-delete');
            delBtn.addEventListener('click', () => {
                this.deleteProvider(provider.id);
            });

            this.listContainer.appendChild(el);
        });

        this.initProviderDragSort();
    }

    renderModelList(provider) {
        if (!this.modelListContainer) return;
        this.modelListContainer.innerHTML = '';
        
        provider.models = provider.models || [];
        
        if (provider.models.length === 0) {
            this.modelListContainer.innerHTML = '<div class="text-dim" style="font-size:11px; padding:10px 0;">该供应商暂未设置模型</div>';
            return;
        }

        provider.models.forEach((modelName, index) => {
            const el = document.createElement('div');
            el.className = 'model-item';
            el.draggable = true;
            el.dataset.index = index;
            
            const badgeClass = index === 0 ? '' : 'backup';
            const badgeNum = index + 1;

            el.innerHTML = `
                <div class="model-badge ${badgeClass}">${badgeNum}</div>
                <input type="text" class="model-input" value="${modelName}" placeholder="模型标识 (例如: claude-3-opus-20240229)">
                <div class="model-drag-handle" title="拖拽排序优先级">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1.5"></circle><circle cx="15" cy="5" r="1.5"></circle><circle cx="9" cy="12" r="1.5"></circle><circle cx="15" cy="12" r="1.5"></circle><circle cx="9" cy="19" r="1.5"></circle><circle cx="15" cy="19" r="1.5"></circle></svg>
                </div>
                <button class="model-delete" title="删除该模型" tabindex="-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            `;

            // 保存修改
            const input = el.querySelector('.model-input');
            input.addEventListener('input', () => {
                provider.models[index] = input.value.trim();
                this.saveSettingsToLocal();
            });

            // 删除
            const delBtn = el.querySelector('.model-delete');
            delBtn.addEventListener('click', () => {
                provider.models.splice(index, 1);
                this.renderModelList(provider);
                this.saveSettingsToLocal();
            });

            this.modelListContainer.appendChild(el);
        });

        this.initModelDragSort(provider);
        
        if (this.btnAddModel) {
            this.btnAddModel.disabled = provider.models.length >= 3;
            if (provider.models.length >= 3) {
                this.btnAddModel.style.opacity = '0.5';
                this.btnAddModel.style.cursor = 'not-allowed';
            } else {
                this.btnAddModel.style.opacity = '1';
                this.btnAddModel.style.cursor = 'pointer';
            }
        }
    }

    initProviderDragSort() {
        if (!this.listContainer) return;
        const items = this.listContainer.querySelectorAll('.provider-item');
        let draggedItem = null;

        items.forEach(item => {
            const handle = item.querySelector('.provider-drag-handle');
            
            handle.addEventListener('mousedown', () => { item.setAttribute('draggable', 'true'); });
            handle.addEventListener('mouseup', () => { item.setAttribute('draggable', 'false'); });
            
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => item.style.opacity = '0.5', 0);
            });

            item.addEventListener('dragend', () => {
                draggedItem = null;
                item.style.opacity = '1';
                item.setAttribute('draggable', 'false');
                items.forEach(i => i.classList.remove('drag-over'));
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                const target = e.target.closest('.provider-item');
                if (target && target !== draggedItem) {
                    target.classList.add('drag-over');
                }
            });

            item.addEventListener('dragleave', (e) => {
                const target = e.target.closest('.provider-item');
                if (target) {
                    target.classList.remove('drag-over');
                }
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const target = e.target.closest('.provider-item');
                if (target && target !== draggedItem) {
                    target.classList.remove('drag-over');
                    const dragId = draggedItem.dataset.id;
                    const dropId = target.dataset.id;

                    const dragIndex = this.providers.findIndex(p => p.id === dragId);
                    const dropIndex = this.providers.findIndex(p => p.id === dropId);

                    if (dragIndex !== -1 && dropIndex !== -1) {
                        const [moved] = this.providers.splice(dragIndex, 1);
                        this.providers.splice(dropIndex, 0, moved);
                        this.saveSettingsToLocal();
                        this.renderProviderList();
                    }
                }
            });
        });
    }

    initModelDragSort(provider) {
        if (!this.modelListContainer) return;
        const items = this.modelListContainer.querySelectorAll('.model-item');
        let draggedItem = null;

        items.forEach(item => {
            const handle = item.querySelector('.model-drag-handle');
            
            handle.addEventListener('mousedown', () => { item.setAttribute('draggable', 'true'); });
            handle.addEventListener('mouseup', () => { item.setAttribute('draggable', 'false'); });

            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => item.style.opacity = '0.5', 0);
            });

            item.addEventListener('dragend', () => {
                draggedItem = null;
                item.style.opacity = '1';
                item.setAttribute('draggable', 'false');
                items.forEach(i => i.classList.remove('drag-over'));
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                const target = e.target.closest('.model-item');
                if (target && target !== draggedItem) {
                    target.classList.add('drag-over');
                }
            });

            item.addEventListener('dragleave', (e) => {
                const target = e.target.closest('.model-item');
                if (target) {
                    target.classList.remove('drag-over');
                }
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const target = e.target.closest('.model-item');
                if (target && target !== draggedItem) {
                    target.classList.remove('drag-over');
                    const dragIndex = parseInt(draggedItem.dataset.index);
                    const dropIndex = parseInt(target.dataset.index);

                    const [moved] = provider.models.splice(dragIndex, 1);
                    provider.models.splice(dropIndex, 0, moved);
                    this.saveSettingsToLocal();
                    this.renderModelList(provider);
                }
            });
        });
    }

    // ==========================================
    // API 连接测试
    // ==========================================
    async handleTestConnection() {
        if (!this.activeProviderId) return;
        const provider = this.providers.find(p => p.id === this.activeProviderId);
        if (!provider) return;

        if (!provider.apiKey) {
            showToast("⚠️ 请先输入 API Key 再进行测试！");
            return;
        }

        const modelToTest = provider.models[0];
        if (!modelToTest && provider.format !== 'gemini') {
            showToast("⚠️ 至少设置一个测试模型！");
            return;
        }

        this.btnTestProvider.disabled = true;
        const originText = this.btnTestProvider.innerHTML;
        this.btnTestProvider.innerHTML = "⏳ 测 试 中 ...";

        try {
            const res = await this.testApiConnection({
                apiKey: provider.apiKey,
                modelType: provider.format,
                baseUrl: provider.baseUrl,
                modelName: modelToTest
            });
            
            if (res.ok) {
                showToast("✅ 测试成功！API 连通正常。");
            } else {
                showToast("❌ 测试失败：" + res.error, "error");
            }
        } catch (e) {
            showToast("❌ 请求异常：" + e.message, "error");
        } finally {
            this.btnTestProvider.disabled = false;
            this.btnTestProvider.innerHTML = originText;
        }
    }

    async testApiConnection({ apiKey, modelType, baseUrl, modelName }) {
        let responseText = '';
        try {
            if (modelType === 'openai') {
                const url = (baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '') + '/chat/completions';
                const model = modelName || 'gpt-4o-mini';
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify({
                        model: model,
                        messages: [{ role: 'user', content: 'Say "hello" only' }],
                        max_tokens: 10
                    })
                });
                if (!res.ok) {
                    const text = await res.text();
                    return { ok: false, error: `HTTP ${res.status} - ${text.substring(0, 100)}` };
                }
                const data = await res.json();
                responseText = data.choices[0].message.content;
            } else if (modelType === 'anthropic') {
                const url = (baseUrl || 'https://api.anthropic.com/v1').replace(/\/$/, '') + '/messages';
                const model = modelName || 'claude-3-haiku-20240307';
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [{ role: 'user', content: 'Say "hello" only' }],
                        max_tokens: 10
                    })
                });
                if (!res.ok) {
                    const text = await res.text();
                    return { ok: false, error: `HTTP ${res.status} - ${text.substring(0, 100)}` };
                }
                const data = await res.json();
                responseText = data.content[0].text;
            } else { // gemini
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: 'Say "hello" only' }] }],
                        generationConfig: { maxOutputTokens: 10 }
                    })
                });
                if (!res.ok) {
                    const text = await res.text();
                    return { ok: false, error: `HTTP ${res.status} - ${text.substring(0, 100)}` };
                }
                const data = await res.json();
                responseText = data.candidates[0].content.parts[0].text;
            }
            return { ok: true, data: responseText };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    }

    // ── 静态工具：供其他模块读API 配置 ──
    static getApiConfig() {
        // 读取新版首个供应商配置
        try {
            const savedStr = localStorage.getItem('manga_wb_providers');
            if (savedStr) {
                const providers = JSON.parse(savedStr);
                if (providers && providers.length > 0) {
                    const mainP = providers[0];
                    return {
                        apiKey: mainP.apiKey || '',
                        modelType: mainP.format || 'gemini',
                        baseUrl: mainP.baseUrl || '',
                        modelName: mainP.models && mainP.models[0] ? mainP.models[0] : '',
                        // 将所有的备用模型也返回，方便实现 fallback
                        allModels: mainP.models || []
                    };
                }
            }
        } catch(e) {}
        
        // 兼容降级
        return {
            apiKey: localStorage.getItem('manga_wb_api_key') || localStorage.getItem('manga_workbench_api_key') || '',
            modelType: localStorage.getItem('manga_wb_model_type') || 'gemini',
            baseUrl: localStorage.getItem('manga_wb_base_url') || '',
            modelName: localStorage.getItem('manga_wb_model_name') || '',
            allModels: [localStorage.getItem('manga_wb_model_name') || '']
        };
    }
}
