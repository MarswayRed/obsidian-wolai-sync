// Wolai API 相关类型定义
export interface WolaiSyncSettings {
    obsidianFolder: string;           // Obsidian 同步文件夹路径
    wolaiDatabaseId: string;          // Wolai 数据库ID
    wolaiAppId: string;               // Wolai AppID
    wolaiAppSecret: string;           // Wolai AppSecret
    syncInterval: number;             // 同步间隔（分钟）
    autoSync: boolean;                // 是否启用自动同步
    enableFileWatcher: boolean;       // 是否启用文件监听器
    lastSyncTime: number;             // 上次同步时间戳
}

export interface SyncRecord {
    filePath: string;                 // 文件路径
    lastModified: number;             // 最后修改时间
    wolaiRowId: string;               // Wolai 行ID
    synced: boolean;                  // 是否已同步
    hash: string;                     // 文件内容哈希
}

// 同步状态枚举
export type SyncStatus = 'Synced' | 'Pending' | 'Modified' | 'Wait For Syncing';

// Obsidian文件的FrontMatter同步信息
export interface FileSyncInfo {
    sync_status: SyncStatus;
    wolai_id?: string;
    last_sync?: string;
}

// Wolai数据库行同步信息
export interface WolaiRowSyncInfo {
    page_id: string;
    sync_status: SyncStatus;
    obsidian_path?: string;
    last_sync?: string;
}

export interface WolaiToken {
    app_token: string;
    app_id: string;
    create_time: number;
    expire_time: number;
    update_time: number;
}

export interface WolaiTokenResponse {
    data: WolaiToken | null;
}

// Wolai CreateRichText 类型定义
export interface WolaiRichText {
    type?: 'text' | 'equation';
    title: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    highlight?: boolean;
    strikethrough?: boolean;
    inline_code?: boolean;
    front_color?: string;
    back_color?: string;
    link?: string; // 链接URL
}

export type CreateRichText = string | WolaiRichText | (string | WolaiRichText)[];

export interface WolaiBlock {
    type: string;
    content?: CreateRichText;
    block_front_color?: string;
    block_back_color?: string;
    text_alignment?: string;
    block_alignment?: string;
    level?: number;
    language?: string; // 代码块语言属性
    parent_id?: string; // 父块ID，用于嵌套块
}

export interface WolaiCreateBlocksRequest {
    parent_id: string;
    blocks: WolaiBlock[];
}

export interface WolaiCreateBlocksResponse {
    data?: string;
    message?: string;
    error_code?: number;
    status_code?: number;
}

export interface WolaiDatabaseRow {
    [key: string]: any;
}

export interface WolaiInsertRowsRequest {
    rows: WolaiDatabaseRow[];
}

export interface WolaiInsertRowsResponse {
    data?: string[];
    message?: string;
    error_code?: number;
    status_code?: number;
}

export interface ParsedMarkdown {
    frontMatter: { [key: string]: any };
    content: string;
    blocks: WolaiBlock[];
}

// Remark AST 节点类型
export interface MarkdownNode {
    type: string;
    children?: MarkdownNode[];
    value?: string;
    depth?: number;
    ordered?: boolean;
    checked?: boolean | null;
    lang?: string;
    meta?: string;
    url?: string;
    title?: string;
    alt?: string;
}

export interface WolaiBlockChildren {
    ids: string[];
    api_url: string;
}
export interface WolaiPageBlock {
    id: string;
    type: string;
    content?: CreateRichText;
    children?: WolaiBlockChildren;
    level?: number;
    language?: string;
    text_alignment?: string;
    block_alignment?: string;
    block_front_color?: string;
    block_back_color?: string;
}

export interface WolaiPageResponse {
    data?: WolaiPageBlock[];
    message?: string;
    error_code?: number;
    status_code?: number;
} 