import { App, PluginSettingTab, Setting, Notice, ButtonComponent } from 'obsidian';
import WolaiSyncPlugin from '../main';
import { WolaiSyncSettings } from './types';

export class WolaiSyncSettingTab extends PluginSettingTab {
    plugin: WolaiSyncPlugin;

    constructor(app: App, plugin: WolaiSyncPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();
        containerEl.createEl('h2', { text: 'Wolai 同步设置' });

        // API调用统计区域
        this.createAPIStatsSection();

        // 分隔线
        containerEl.createEl('hr');

        // Obsidian 设置区域
        this.createObsidianSection();

        // 分隔线
        containerEl.createEl('hr');

        // Wolai API 设置区域
        this.createWolaiSection();

        // 分隔线
        containerEl.createEl('hr');

        // 同步设置区域
        this.createSyncSection();

        // 分隔线
        containerEl.createEl('hr');

        // 操作按钮区域
        this.createActionSection();
    }

    private createAPIStatsSection(): void {
        const { containerEl } = this;

        containerEl.createEl('h3', { text: 'API 调用统计' });

        // 获取API统计数据
        const stats = this.plugin.syncManager?.getAPICallStats() || { total: 0, today: 0, lastReset: 0 };

        const statsContainer = containerEl.createDiv({ cls: 'wolai-sync-stats' });
        
        // 今日调用次数
        const todayEl = statsContainer.createDiv({ cls: 'stat-item' });
        todayEl.createEl('span', { text: '今日API调用: ', cls: 'stat-label' });
        todayEl.createEl('span', { text: stats.today.toString(), cls: 'stat-value' });

        // 总调用次数
        const totalEl = statsContainer.createDiv({ cls: 'stat-item' });
        totalEl.createEl('span', { text: '总API调用: ', cls: 'stat-label' });
        totalEl.createEl('span', { text: stats.total.toString(), cls: 'stat-value' });

        // 重置按钮
        new Setting(containerEl)
            .setName('重置API统计')
            .setDesc('清零所有API调用计数')
            .addButton(button => {
                button
                    .setButtonText('重置统计')
                    .setCta()
                    .onClick(async () => {
                        if (this.plugin.syncManager) {
                            this.plugin.syncManager.resetAPICallStats();
                            new Notice('API调用统计已重置');
                            this.display(); // 刷新显示
                        }
                    });
            });

        // 添加样式
        if (!document.querySelector('.wolai-sync-stats-style')) {
            const style = document.createElement('style');
            style.className = 'wolai-sync-stats-style';
            style.textContent = `
                .wolai-sync-stats {
                    background: var(--background-secondary);
                    padding: 16px;
                    border-radius: 8px;
                    margin: 12px 0;
                }
                .stat-item {
                    display: flex;
                    justify-content: space-between;
                    margin: 8px 0;
                }
                .stat-label {
                    font-weight: 500;
                }
                .stat-value {
                    font-weight: bold;
                    color: var(--text-accent);
                }
            `;
            document.head.appendChild(style);
        }
    }

    private createObsidianSection(): void {
        const { containerEl } = this;

        containerEl.createEl('h3', { text: 'Obsidian 设置' });

        new Setting(containerEl)
            .setName('同步文件夹')
            .setDesc('选择要同步到 Wolai 的文件夹路径')
            .addText(text => text
                .setPlaceholder('例如: Notes/Wolai')
                .setValue(this.plugin.settings.obsidianFolder)
                .onChange(async (value) => {
                    this.plugin.settings.obsidianFolder = value;
                    await this.plugin.saveSettings();
                }));
    }

    private createWolaiSection(): void {
        const { containerEl } = this;

        containerEl.createEl('h3', { text: 'Wolai API 设置' });

        new Setting(containerEl)
            .setName('数据库 ID')
            .setDesc('Wolai 数据库的唯一标识符')
            .addText(text => text
                .setPlaceholder('请输入数据库 ID')
                .setValue(this.plugin.settings.wolaiDatabaseId)
                .onChange(async (value) => {
                    this.plugin.settings.wolaiDatabaseId = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('App ID')
            .setDesc('Wolai 应用程序 ID')
            .addText(text => text
                .setPlaceholder('请输入 App ID')
                .setValue(this.plugin.settings.wolaiAppId)
                .onChange(async (value) => {
                    this.plugin.settings.wolaiAppId = value;
                    await this.plugin.saveSettings();
                    // 更新API实例
                    this.plugin.updateSyncManager();
                }));

        new Setting(containerEl)
            .setName('App Secret')
            .setDesc('Wolai 应用程序密钥（敏感信息，请妥善保管）')
            .addText(text => {
                text.inputEl.type = 'password';
                text
                    .setPlaceholder('请输入 App Secret')
                    .setValue(this.plugin.settings.wolaiAppSecret)
                    .onChange(async (value) => {
                        this.plugin.settings.wolaiAppSecret = value;
                        await this.plugin.saveSettings();
                        // 更新API实例
                        this.plugin.updateSyncManager();
                    });
            });

        // 连接测试按钮
        new Setting(containerEl)
            .setName('测试连接')
            .setDesc('验证 Wolai API 配置是否正确')
            .addButton(button => {
                button
                    .setButtonText('测试连接')
                    .setCta()
                    .onClick(async () => {
                        button.setButtonText('测试中...');
                        button.setDisabled(true);
                        
                        try {
                            if (!this.plugin.settings.wolaiAppId || !this.plugin.settings.wolaiAppSecret) {
                                new Notice('请先填写 App ID 和 App Secret');
                                return;
                            }

                            const isValid = await this.plugin.syncManager?.validateSync();
                            if (isValid) {
                                new Notice('Wolai API 连接成功！');
                            } else {
                                new Notice('Wolai API 连接失败，请检查配置');
                            }
                        } catch (error) {
                            console.error('Connection test failed:', error);
                            new Notice('连接测试失败');
                        } finally {
                            button.setButtonText('测试连接');
                            button.setDisabled(false);
                        }
                    });
            });
    }

    private createSyncSection(): void {
        const { containerEl } = this;

        containerEl.createEl('h3', { text: '同步设置' });

        new Setting(containerEl)
            .setName('启用自动同步')
            .setDesc('是否启用定时自动同步功能')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoSync)
                .onChange(async (value) => {
                    this.plugin.settings.autoSync = value;
                    await this.plugin.saveSettings();
                    
                    // 更新定时器
                    if (value) {
                        this.plugin.startScheduledSync();
                        new Notice('自动同步已启用');
                    } else {
                        this.plugin.stopScheduledSync();
                        new Notice('自动同步已禁用');
                    }
                }));

        new Setting(containerEl)
            .setName('启用文件监听')
            .setDesc('监听文件夹变化并自动同步（可能会频繁调用API）')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableFileWatcher)
                .onChange(async (value) => {
                    this.plugin.settings.enableFileWatcher = value;
                    await this.plugin.saveSettings();
                    
                    if (value) {
                        new Notice('文件监听已启用');
                    } else {
                        new Notice('文件监听已禁用');
                    }
                }));

        new Setting(containerEl)
            .setName('同步间隔')
            .setDesc('自动同步的时间间隔（分钟）')
            .addSlider(slider => slider
                .setLimits(5, 120, 5)
                .setValue(this.plugin.settings.syncInterval)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.syncInterval = value;
                    await this.plugin.saveSettings();
                    
                    // 如果自动同步已启用，重新启动定时器
                    if (this.plugin.settings.autoSync) {
                        this.plugin.stopScheduledSync();
                        this.plugin.startScheduledSync();
                    }
                }));

        // 显示上次同步时间
        if (this.plugin.settings.lastSyncTime > 0) {
            const lastSyncDate = new Date(this.plugin.settings.lastSyncTime);
            const lastSyncText = `上次同步: ${lastSyncDate.toLocaleString('zh-CN')}`;
            
            containerEl.createDiv({
                text: lastSyncText,
                cls: 'setting-item-description'
            });
        }
    }

    private createActionSection(): void {
        const { containerEl } = this;

        containerEl.createEl('h3', { text: '同步操作' });

        // 手动双向同步按钮
        new Setting(containerEl)
            .setName('立即双向同步')
            .setDesc('执行完整的双向同步：Obsidian → Wolai 和 Wolai → Obsidian')
            .addButton(button => {
                button
                    .setButtonText('开始双向同步')
                    .setCta()
                    .onClick(async () => {
                        button.setButtonText('同步中...');
                        button.setDisabled(true);
                        
                        try {
                            if (!this.plugin.syncManager) {
                                new Notice('同步管理器未初始化');
                                return;
                            }

                            const result = await this.plugin.syncManager.fullSync();
                            const totalSynced = result.obsidianToWolai + result.wolaiToObsidian;
                            
                            if (totalSynced > 0) {
                                new Notice(`同步完成！Obsidian→Wolai: ${result.obsidianToWolai}个文件，Wolai→Obsidian: ${result.wolaiToObsidian}个文件`);
                            } else {
                                new Notice('没有文件需要同步');
                            }
                            
                            // 刷新API统计显示
                            this.display();
                        } catch (error) {
                            console.error('Manual sync failed:', error);
                            new Notice('同步失败，请查看控制台日志');
                        } finally {
                            button.setButtonText('开始双向同步');
                            button.setDisabled(false);
                        }
                    });
            });

        // 仅Obsidian到Wolai同步按钮
        new Setting(containerEl)
            .setName('仅同步到 Wolai')
            .setDesc('只将Obsidian中的新文件同步到Wolai（不从Wolai获取内容）')
            .addButton(button => {
                button
                    .setButtonText('同步到 Wolai')
                    .onClick(async () => {
                        button.setButtonText('同步中...');
                        button.setDisabled(true);
                        
                        try {
                            if (!this.plugin.syncManager) {
                                new Notice('同步管理器未初始化');
                                return;
                            }

                            const result = await this.plugin.syncManager.fullSync();
                            
                            if (result.obsidianToWolai > 0) {
                                new Notice(`已同步 ${result.obsidianToWolai} 个文件到 Wolai`);
                            } else {
                                new Notice('没有文件需要同步到 Wolai');
                            }
                            
                            // 刷新API统计显示
                            this.display();
                        } catch (error) {
                            console.error('Obsidian to Wolai sync failed:', error);
                            new Notice('同步失败，请查看控制台日志');
                        } finally {
                            button.setButtonText('同步到 Wolai');
                            button.setDisabled(false);
                        }
                    });
            });

        // 同步状态信息
        if (this.plugin.syncManager) {
            const stats = this.plugin.syncManager.getSyncStats();
            containerEl.createDiv({
                text: `同步记录统计: 总计 ${stats.total} 个文件，已同步 ${stats.synced} 个，待同步 ${stats.pending} 个`,
                cls: 'setting-item-description'
            });
        }
    }
} 