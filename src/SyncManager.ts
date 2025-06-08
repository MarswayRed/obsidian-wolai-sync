import { Vault, TFile, Notice, TFolder } from 'obsidian';
import { WolaiAPI, WolaiDatabaseRowData, APICallStats } from './WolaiAPI';
import { MarkdownParser } from './MarkdownParser';
import { WolaiSyncSettings, SyncRecord, SyncStatus, WolaiRowSyncInfo } from './types';
import matter from 'gray-matter';

export class SyncManager {
    private vault: Vault;
    private wolaiAPI: WolaiAPI;
    public markdownParser: MarkdownParser;
    private settings: WolaiSyncSettings;
    private syncRecords: Map<string, SyncRecord> = new Map();
    private dataFilePath: string = '.obsidian/plugins/obsidian-wolai-sync/sync-records.json';
    private syncingFiles: Set<string> = new Set(); // 正在同步的文件集合

    constructor(
        vault: Vault,
        settings: WolaiSyncSettings
    ) {
        this.vault = vault;
        this.settings = settings;
        this.wolaiAPI = new WolaiAPI(settings.wolaiAppId, settings.wolaiAppSecret);
        this.markdownParser = new MarkdownParser();
        
        // 加载同步记录
        this.loadSyncRecords();
    }

    updateSettings(settings: WolaiSyncSettings): void {
        this.settings = settings;
        this.wolaiAPI = new WolaiAPI(settings.wolaiAppId, settings.wolaiAppSecret);
    }

    getAPICallStats(): APICallStats {
        return this.wolaiAPI.getAPICallStats();
    }

    resetAPICallStats(): void {
        this.wolaiAPI.resetAPICallStats();
    }

    private async loadSyncRecords(): Promise<void> {
        try {
            // 检查数据文件是否存在
            const dataFile = this.vault.getAbstractFileByPath(this.dataFilePath);
            if (!dataFile || !(dataFile instanceof TFile)) {
                console.log('Sync records file not found, starting with empty records');
                return;
            }

            // 读取并解析同步记录
            const content = await this.vault.read(dataFile);
            const recordsData = JSON.parse(content);
            
            // 将数据转换为Map
            this.syncRecords = new Map();
            for (const [filePath, record] of Object.entries(recordsData)) {
                this.syncRecords.set(filePath, record as SyncRecord);
            }
            
            console.log(`Loaded ${this.syncRecords.size} sync records`);
        } catch (error) {
            console.error('Error loading sync records:', error);
            this.syncRecords = new Map();
        }
    }

    private async saveSyncRecords(): Promise<void> {
        try {
            // 将Map转换为普通对象
            const recordsData: { [key: string]: SyncRecord } = {};
            for (const [filePath, record] of this.syncRecords) {
                recordsData[filePath] = record;
            }

            // 序列化为JSON
            const content = JSON.stringify(recordsData, null, 2);
            
            // 检查数据文件是否存在
            const dataFile = this.vault.getAbstractFileByPath(this.dataFilePath);
            if (dataFile && dataFile instanceof TFile) {
                // 更新现有文件
                await this.vault.modify(dataFile, content);
            } else {
                // 创建新文件
                await this.vault.create(this.dataFilePath, content);
            }
            
            console.log(`Saved ${this.syncRecords.size} sync records`);
        } catch (error) {
            console.error('Error saving sync records:', error);
        }
    }

    async syncObsidianToWolai(filePath: string): Promise<boolean> {
        try {
            // 检查文件是否正在同步中
            if (this.syncingFiles.has(filePath)) {
                console.log(`File ${filePath} is already being synced, skipping...`);
                return true;
            }

            // 添加到正在同步的文件集合
            this.syncingFiles.add(filePath);

            console.log(`Starting Obsidian→Wolai sync for file: ${filePath}`);

            // 获取文件
            const file = this.vault.getAbstractFileByPath(filePath) as TFile;
            if (!file || !(file instanceof TFile)) {
                console.error(`File not found: ${filePath}`);
                return false;
            }

            // 读取文件内容
            const content = await this.vault.read(file);
            const parsedMarkdown = this.markdownParser.parseMarkdown(content);

            // 检查同步状态
            if (!this.markdownParser.needsSync(parsedMarkdown.frontMatter)) {
                console.log(`File ${filePath} doesn't need sync (status: ${parsedMarkdown.frontMatter.sync_status})`);
                return true;
            }

            console.log(`Parsing markdown content, found ${parsedMarkdown.blocks.length} blocks`);
            console.log('Blocks to be created:', JSON.stringify(parsedMarkdown.blocks, null, 2));

            // 解析并准备数据
            const fileName = file.basename;
            const title = this.markdownParser.extractTitle(parsedMarkdown.frontMatter, fileName);
            
            const rowData = {
                ...parsedMarkdown.frontMatter,
                '标题': title,
                '文件名': fileName,
                '文件路径': filePath,
                '同步时间': new Date().toISOString(),
                '同步状态': 'Synced'
            };

            console.log('Row data to be inserted:', JSON.stringify(rowData, null, 2));

            // 插入数据库行并获取页面ID
            const pageId = await this.wolaiAPI.insertDatabaseRowAndGetPageId(
                this.settings.wolaiDatabaseId, 
                rowData
            );

            if (!pageId) {
                console.error(`Failed to insert database row for file: ${filePath}`);
                return false;
            }

            console.log(`Database row inserted successfully, got page ID: ${pageId}`);

            // 创建块内容
            if (parsedMarkdown.blocks.length > 0) {
                console.log(`Creating ${parsedMarkdown.blocks.length} blocks for page ${pageId}`);
                const blocksResult = await this.wolaiAPI.createBlocks(pageId, parsedMarkdown.blocks);
                if (!blocksResult) {
                    console.error(`Failed to create blocks for file: ${filePath}`);
                    new Notice(`文件 ${filePath} 同步失败：无法创建块内容`);
                    return false;
                } else {
                    console.log('Blocks created successfully');
                }
            } else {
                console.log('No blocks to create (empty content)');
            }

            // 更新文件的同步状态
            const updatedContent = this.markdownParser.updateSyncStatus(content, 'Synced', pageId);
            await this.vault.modify(file, updatedContent);

            // 更新同步记录
            const syncRecord: SyncRecord = {
                filePath: filePath,
                lastModified: file.stat.mtime,
                wolaiRowId: pageId,
                synced: true,
                hash: this.markdownParser.createHash(updatedContent)
            };

            this.syncRecords.set(filePath, syncRecord);
            await this.saveSyncRecords();
            
            console.log(`Successfully synced Obsidian→Wolai: ${filePath}`);
            return true;

        } catch (error) {
            console.error(`Error syncing Obsidian→Wolai ${filePath}:`, error);
            new Notice(`同步文件失败: ${filePath}`);
            return false;
        } finally {
            // 无论成功还是失败，都要从正在同步的文件集合中移除
            this.syncingFiles.delete(filePath);
        }
    }

    async syncWolaiToObsidian(): Promise<number> {
        try {
            console.log('Starting Wolai→Obsidian sync...');

            // 获取Wolai数据库中标记为"Wait For Syncing"的行
            const databaseRows = await this.wolaiAPI.getAllDatabaseContent(this.settings.wolaiDatabaseId);
            
            const waitingRows = databaseRows.filter(row => {
                const syncStatus = row.data['同步状态']?.value;
                return syncStatus === 'Pending';
            });

            console.log(`Found ${waitingRows.length} rows waiting for sync from Wolai`);

            let successCount = 0;
            for (const row of waitingRows) {
                const success = await this.createOrUpdateObsidianFile(row);
                if (success) {
                    successCount++;
                }
            }

            return successCount;

        } catch (error) {
            console.error('Error syncing Wolai→Obsidian:', error);
            new Notice('从 Wolai 同步失败');
            return 0;
        }
    }

    private async createOrUpdateObsidianFile(row: WolaiDatabaseRowData): Promise<boolean> {
        try {
            // 提取文件信息
            const data = row.data;
            const pageName = data['名称']?.value || data['标题']?.value || data['文件名']?.value || `Page_${row.page_id}`;
            const fileName = `${pageName.replace(/[<>:"/\\|?*]/g, '_')}.md`;
            const filePath = fileName; // 强制使用根据页面名称生成的文件名，不使用数据库中的"文件路径"字段
            
            // 确保文件路径在指定的同步文件夹内
            const syncFolder = this.settings.obsidianFolder;
            const fullFilePath = syncFolder ? `${syncFolder}/${filePath}` : filePath;

            // 创建基础的FrontMatter
            const frontMatter: { [key: string]: any } = {
                sync_status: 'Synced',
                wolai_id: row.page_id,
                last_sync: new Date().toISOString()
            };

            // 添加其他属性
            for (const [key, value] of Object.entries(data)) {
                if (!['标题', '文件名', '文件路径', '同步时间', '同步状态'].includes(key)) {
                    frontMatter[key] = value.value;
                }
            }

            // 获取页面内容
            console.log(`Getting content for page: ${row.page_id}`);
            const pageBlocks = await this.wolaiAPI.getAllPageBlocks(row.page_id);
            
            let markdownContent = '';
            if (pageBlocks.length > 0) {
                // 转换Wolai页面内容为Markdown
                markdownContent = this.markdownParser.convertWolaiPageToMarkdown(pageBlocks, pageName);
                console.log(`Converted ${pageBlocks.length} blocks to markdown for ${pageName}`);
            } else {
                // 如果没有内容，创建基础内容
                markdownContent = `# ${pageName}\n\n*此页面从 Wolai 同步，页面ID: ${row.page_id}*\n\n`;
                console.log(`No blocks found for page ${row.page_id}, using placeholder content`);
            }
            
            // 组装完整内容
            const fullContent = matter.stringify(markdownContent, frontMatter);

            // 检查文件是否存在
            const existingFile = this.vault.getAbstractFileByPath(fullFilePath);
            if (existingFile && existingFile instanceof TFile) {
                // 更新现有文件
                await this.vault.modify(existingFile, fullContent);
                console.log(`Updated existing file: ${fullFilePath}`);
            } else {
                // 创建新文件（确保目录存在）
                const dirPath = fullFilePath.substring(0, fullFilePath.lastIndexOf('/'));
                if (dirPath && dirPath !== '' && !this.vault.getAbstractFileByPath(dirPath)) {
                    try {
                        await this.vault.createFolder(dirPath);
                        console.log(`Created directory: ${dirPath}`);
                    } catch (error) {
                        console.error(`Failed to create directory ${dirPath}:`, error);
                        // 如果目录创建失败，尝试在根目录创建文件
                    }
                }
                
                try {
                    await this.vault.create(fullFilePath, fullContent);
                    console.log(`Created new file: ${fullFilePath}`);
                } catch (error) {
                    console.error(`Failed to create file ${fullFilePath}:`, error);
                    throw error;
                }
            }

            return true;

        } catch (error) {
            console.error('Error creating/updating Obsidian file:', error);
            return false;
        }
    }

    async fullSync(): Promise<{ obsidianToWolai: number; wolaiToObsidian: number }> {
        console.log('Starting bidirectional sync...');
        
        // 验证同步前置条件
        const isValid = await this.validateSync();
        if (!isValid) {
            return { obsidianToWolai: 0, wolaiToObsidian: 0 };
        }

        // 1. 同步 Obsidian → Wolai（状态为Pending或Modified的文件）
        const obsidianFiles = await this.getAllFilesInFolder();
        const filesToSyncToWolai: string[] = [];
        
        for (const filePath of obsidianFiles) {
            const file = this.vault.getAbstractFileByPath(filePath) as TFile;
            if (file && file instanceof TFile) {
                const content = await this.vault.read(file);
                const parsed = this.markdownParser.parseMarkdown(content);
                if (this.markdownParser.needsSync(parsed.frontMatter)) {
                    filesToSyncToWolai.push(filePath);
                }
            }
        }

        console.log(`Found ${filesToSyncToWolai.length} Obsidian files to sync to Wolai`);

        let obsidianToWolaiCount = 0;
        for (const filePath of filesToSyncToWolai) {
            const success = await this.syncObsidianToWolai(filePath);
            if (success) {
                obsidianToWolaiCount++;
            }
            // 添加延迟避免API限制
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // 2. 同步 Wolai → Obsidian（状态为Wait For Syncing的行）
        const wolaiToObsidianCount = await this.syncWolaiToObsidian();

        const result = { obsidianToWolai: obsidianToWolaiCount, wolaiToObsidian: wolaiToObsidianCount };
        
        new Notice(`双向同步完成: Obsidian→Wolai ${result.obsidianToWolai}个文件, Wolai→Obsidian ${result.wolaiToObsidian}个文件`);
        
        return result;
    }

    private async getAllFilesInFolder(): Promise<string[]> {
        const files: string[] = [];
        
        if (!this.settings.obsidianFolder) {
            return files;
        }
        
        const folder = this.vault.getAbstractFileByPath(this.settings.obsidianFolder);
        if (!folder || !(folder instanceof TFolder)) {
            console.error(`Folder not found: ${this.settings.obsidianFolder}`);
            return files;
        }
        
        // 递归收集所有 Markdown 文件
        const collectFiles = (currentFolder: TFolder) => {
            for (const child of currentFolder.children) {
                if (child instanceof TFile && child.extension === 'md') {
                    files.push(child.path);
                } else if (child instanceof TFolder) {
                    collectFiles(child);
                }
            }
        };
        
        collectFiles(folder);
        return files;
    }

    async scheduledSync(): Promise<void> {
        console.log('Starting scheduled bidirectional sync...');
        
        const result = await this.fullSync();
        
        // 更新最后同步时间
        this.settings.lastSyncTime = Date.now();
        
        console.log(`Scheduled sync completed: ${result.obsidianToWolai + result.wolaiToObsidian} files synced`);
    }

    async validateSync(): Promise<boolean> {
        // 验证Wolai连接
        const isConnected = await this.wolaiAPI.validateConnection();
        if (!isConnected) {
            new Notice('Wolai 连接失败，请检查 API 配置');
            return false;
        }

        // 验证设置
        if (!this.settings.obsidianFolder || !this.settings.wolaiDatabaseId) {
            new Notice('请先配置同步文件夹和数据库ID');
            return false;
        }

        return true;
    }

    getSyncRecord(filePath: string): SyncRecord | undefined {
        return this.syncRecords.get(filePath);
    }

    getAllSyncRecords(): Map<string, SyncRecord> {
        return new Map(this.syncRecords);
    }

    async removeSyncRecord(filePath: string): Promise<void> {
        this.syncRecords.delete(filePath);
        await this.saveSyncRecords();
        console.log(`Removed sync record for: ${filePath}`);
    }

    getSyncStats(): { total: number; synced: number; pending: number } {
        const total = this.syncRecords.size;
        const synced = Array.from(this.syncRecords.values()).filter(record => record.synced).length;
        const pending = total - synced;
        
        return { total, synced, pending };
    }

    async clearSyncRecords(): Promise<void> {
        this.syncRecords.clear();
        await this.saveSyncRecords();
        console.log('All sync records cleared');
    }

    // 兼容性方法，保持向后兼容
    async syncFile(filePath: string): Promise<boolean> {
        return await this.syncObsidianToWolai(filePath);
    }

    async batchSync(filePaths: string[]): Promise<number> {
        let successCount = 0;
        for (const filePath of filePaths) {
            const success = await this.syncObsidianToWolai(filePath);
            if (success) {
                successCount++;
            }
            // 添加延迟避免API限制
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        return successCount;
    }

    async forceUpdateFileStatus(filePath: string, status: SyncStatus): Promise<string> {
        try {
            const file = this.vault.getAbstractFileByPath(filePath) as TFile;
            if (!file || !(file instanceof TFile)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const content = await this.vault.read(file);
            const updatedContent = this.markdownParser.updateSyncStatus(content, status);
            
            await this.vault.modify(file, updatedContent);
            console.log(`Updated file ${filePath} sync status to ${status}`);
            
            return updatedContent;
        } catch (error) {
            console.error(`Error updating file status for ${filePath}:`, error);
            throw error;
        }
    }

    async forceSyncObsidianToWolai(filePath: string): Promise<boolean> {
        try {
            // 强制同步，绕过同步锁和状态检查
            console.log(`Starting FORCE sync Obsidian→Wolai for file: ${filePath}`);

            // 获取文件
            const file = this.vault.getAbstractFileByPath(filePath) as TFile;
            if (!file || !(file instanceof TFile)) {
                console.error(`File not found: ${filePath}`);
                return false;
            }

            // 读取文件内容
            const content = await this.vault.read(file);
            const parsedMarkdown = this.markdownParser.parseMarkdown(content);

            console.log(`Parsing markdown content, found ${parsedMarkdown.blocks.length} blocks`);
            console.log('Blocks to be created:', JSON.stringify(parsedMarkdown.blocks, null, 2));

            // 解析并准备数据
            const fileName = file.basename;
            const title = this.markdownParser.extractTitle(parsedMarkdown.frontMatter, fileName);
            
            const rowData = {
                ...parsedMarkdown.frontMatter,
                '标题': title,
                '文件名': fileName,
                '文件路径': filePath,
                '同步时间': new Date().toISOString(),
                '同步状态': 'Synced'
            };

            console.log('Row data to be inserted:', JSON.stringify(rowData, null, 2));

            // 插入数据库行并获取页面ID
            const pageId = await this.wolaiAPI.insertDatabaseRowAndGetPageId(
                this.settings.wolaiDatabaseId, 
                rowData
            );

            if (!pageId) {
                console.error(`Failed to insert database row for file: ${filePath}`);
                return false;
            }

            console.log(`Database row inserted successfully, got page ID: ${pageId}`);

            // 创建块内容
            if (parsedMarkdown.blocks.length > 0) {
                console.log(`Creating ${parsedMarkdown.blocks.length} blocks for page ${pageId}`);
                const blocksResult = await this.wolaiAPI.createBlocks(pageId, parsedMarkdown.blocks);
                if (!blocksResult) {
                    console.error(`Failed to create blocks for file: ${filePath}`);
                    new Notice(`文件 ${filePath} 强制同步失败：无法创建块内容`);
                    return false;
                } else {
                    console.log('Blocks created successfully');
                }
            } else {
                console.log('No blocks to create (empty content)');
            }

            // 更新文件的同步状态
            const updatedContent = this.markdownParser.updateSyncStatus(content, 'Synced', pageId);
            await this.vault.modify(file, updatedContent);

            // 更新同步记录
            const syncRecord: SyncRecord = {
                filePath: filePath,
                lastModified: file.stat.mtime,
                wolaiRowId: pageId,
                synced: true,
                hash: this.markdownParser.createHash(updatedContent)
            };

            this.syncRecords.set(filePath, syncRecord);
            await this.saveSyncRecords();
            
            console.log(`Successfully FORCE synced Obsidian→Wolai: ${filePath}`);
            return true;

        } catch (error) {
            console.error(`Error force syncing Obsidian→Wolai ${filePath}:`, error);
            new Notice(`强制同步文件失败: ${filePath}`);
            return false;
        }
    }
} 