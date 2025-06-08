import { TFile, Vault, EventRef } from 'obsidian';

export class FileWatcher {
    private vault: Vault;
    private watchedFolder: string;
    private eventRefs: EventRef[] = [];
    private pendingFiles: Set<string> = new Set();
    private debounceTimer: NodeJS.Timeout | null = null;
    private debounceDelay: number = 1000; // 1秒防抖
    
    private onFileChangeCallback: (filePath: string) => void;
    private onFileCreateCallback: (filePath: string) => void;
    private onFileDeleteCallback: (filePath: string) => void;

    constructor(
        vault: Vault,
        watchedFolder: string,
        callbacks: {
            onFileChange: (filePath: string) => void;
            onFileCreate: (filePath: string) => void;
            onFileDelete: (filePath: string) => void;
        }
    ) {
        this.vault = vault;
        this.watchedFolder = watchedFolder;
        this.onFileChangeCallback = callbacks.onFileChange;
        this.onFileCreateCallback = callbacks.onFileCreate;
        this.onFileDeleteCallback = callbacks.onFileDelete;
    }

    startWatching(): void {
        // 监听文件创建事件
        const createRef = this.vault.on('create', (file: TFile) => {
            if (this.shouldWatchFile(file)) {
                console.log(`File created: ${file.path}`);
                this.onFileCreateCallback(file.path);
            }
        });

        // 监听文件修改事件
        const modifyRef = this.vault.on('modify', (file: TFile) => {
            if (this.shouldWatchFile(file)) {
                console.log(`File modified: ${file.path}`);
                this.addToPendingFiles(file.path);
            }
        });

        // 监听文件删除事件
        const deleteRef = this.vault.on('delete', (file: TFile) => {
            if (this.shouldWatchFile(file)) {
                console.log(`File deleted: ${file.path}`);
                this.onFileDeleteCallback(file.path);
            }
        });

        // 监听文件重命名事件
        const renameRef = this.vault.on('rename', (file: TFile, oldPath: string) => {
            if (this.shouldWatchFile(file) || this.isInWatchedFolder(oldPath)) {
                console.log(`File renamed: ${oldPath} -> ${file.path}`);
                // 处理重命名：删除旧文件，创建新文件
                if (this.isInWatchedFolder(oldPath)) {
                    this.onFileDeleteCallback(oldPath);
                }
                if (this.shouldWatchFile(file)) {
                    this.onFileCreateCallback(file.path);
                }
            }
        });

        this.eventRefs = [createRef, modifyRef, deleteRef, renameRef];
        console.log(`Started watching folder: ${this.watchedFolder}`);
    }

    stopWatching(): void {
        // 清理所有事件监听器
        this.eventRefs.forEach(ref => {
            this.vault.offref(ref);
        });
        this.eventRefs = [];

        // 清理防抖定时器
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        // 清理待处理文件列表
        this.pendingFiles.clear();
        
        console.log(`Stopped watching folder: ${this.watchedFolder}`);
    }

    updateWatchedFolder(newFolder: string): void {
        this.watchedFolder = newFolder;
        console.log(`Updated watched folder to: ${newFolder}`);
    }

    private shouldWatchFile(file: TFile): boolean {
        return this.isInWatchedFolder(file.path) && file.extension === 'md';
    }

    private isInWatchedFolder(filePath: string): boolean {
        if (!this.watchedFolder) {
            return false;
        }
        
        // 标准化路径，确保正确比较
        const normalizedWatchedFolder = this.watchedFolder.replace(/\/$/, '');
        const normalizedFilePath = filePath.replace(/^\//, '');
        
        return normalizedFilePath.startsWith(normalizedWatchedFolder + '/') || 
               normalizedFilePath === normalizedWatchedFolder;
    }

    private addToPendingFiles(filePath: string): void {
        this.pendingFiles.add(filePath);
        
        // 重置防抖定时器
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        this.debounceTimer = setTimeout(() => {
            this.processPendingFiles();
        }, this.debounceDelay);
    }

    private processPendingFiles(): void {
        const filesToProcess = Array.from(this.pendingFiles);
        this.pendingFiles.clear();
        
        console.log(`Processing ${filesToProcess.length} pending files`);
        
        // 批量处理文件变化
        filesToProcess.forEach(filePath => {
            this.onFileChangeCallback(filePath);
        });
    }

    setDebounceDelay(delay: number): void {
        this.debounceDelay = delay;
    }

    getPendingFiles(): string[] {
        return Array.from(this.pendingFiles);
    }
} 