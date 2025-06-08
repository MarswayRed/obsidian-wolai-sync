import { Notice } from 'obsidian';
import { 
    WolaiToken, 
    WolaiTokenResponse, 
    WolaiCreateBlocksRequest,
    WolaiCreateBlocksResponse,
    WolaiInsertRowsRequest,
    WolaiInsertRowsResponse,
    WolaiDatabaseRow,
    WolaiBlock,
    WolaiPageResponse,
    WolaiPageBlock
} from './types';

export interface WolaiDatabaseContent {
    column_order: string[];
    rows: WolaiDatabaseRowData[];
}

export interface WolaiDatabaseRowData {
    page_id: string;
    data: { [key: string]: any };
}

export interface WolaiDatabaseResponse {
    data?: WolaiDatabaseContent;
    message?: string;
    error_code?: number;
    status_code?: number;
}

export interface APICallStats {
    total: number;
    today: number;
    lastReset: number;
}

export class WolaiAPI {
    private baseUrl = 'https://openapi.wolai.com/v1';
    private token: string | null = null;
    private tokenExpireTime: number = 0;
    private apiCallStats: APICallStats = {
        total: 0,
        today: 0,
        lastReset: new Date().setHours(0, 0, 0, 0) // 今天0点
    };

    constructor(
        private appId: string,
        private appSecret: string
    ) {}

    private incrementAPICall(): void {
        const today = new Date().setHours(0, 0, 0, 0);
        
        // 如果是新的一天，重置今日计数
        if (today > this.apiCallStats.lastReset) {
            this.apiCallStats.today = 0;
            this.apiCallStats.lastReset = today;
        }
        
        this.apiCallStats.total++;
        this.apiCallStats.today++;
        
        console.log(`API Call Count - Total: ${this.apiCallStats.total}, Today: ${this.apiCallStats.today}`);
    }

    getAPICallStats(): APICallStats {
        const today = new Date().setHours(0, 0, 0, 0);
        
        // 如果是新的一天，重置今日计数
        if (today > this.apiCallStats.lastReset) {
            this.apiCallStats.today = 0;
            this.apiCallStats.lastReset = today;
        }
        
        return { ...this.apiCallStats };
    }

    resetAPICallStats(): void {
        this.apiCallStats = {
            total: 0,
            today: 0,
            lastReset: new Date().setHours(0, 0, 0, 0)
        };
        console.log('API call stats reset');
    }

    async createToken(): Promise<string | null> {
        try {
            const response = await fetch(`${this.baseUrl}/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    appId: this.appId,
                    appSecret: this.appSecret
                })
            });

            const data: WolaiTokenResponse = await response.json();
            
            if (data.data) {
                this.token = data.data.app_token;
                this.tokenExpireTime = data.data.expire_time;
                console.log('Wolai token created successfully');
                
                // 只有成功时才计入统计
                this.incrementAPICall();
                
                return this.token;
            } else {
                new Notice('获取 Wolai Token 失败，请检查 AppID 和 AppSecret');
                return null;
            }
        } catch (error) {
            console.error('Error creating Wolai token:', error);
            new Notice('网络错误：无法连接到 Wolai API');
            return null;
        }
    }

    async getValidToken(): Promise<string | null> {
        // 检查token是否存在且未过期（-1表示永不过期）
        if (this.token && (this.tokenExpireTime === -1 || Date.now() < this.tokenExpireTime)) {
            return this.token;
        }
        
        // 重新获取token
        return await this.createToken();
    }

    async validateConnection(): Promise<boolean> {
        const token = await this.getValidToken();
        return token !== null;
    }

    async insertDatabaseRow(databaseId: string, rowData: WolaiDatabaseRow): Promise<string | null> {
        const token = await this.getValidToken();
        if (!token) {
            return null;
        }

        try {
            const response = await fetch(`${this.baseUrl}/databases/${databaseId}/rows`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token
                },
                body: JSON.stringify({
                    rows: [rowData]
                })
            });

            const data: WolaiInsertRowsResponse = await response.json();
            
            if (data.data && data.data.length > 0) {
                console.log('Database row inserted successfully:', data.data[0]);
                
                // 只有成功时才计入统计
                this.incrementAPICall();
                
                return data.data[0]; // 返回新创建行的链接
            } else {
                console.error('Failed to insert database row:', data.message);
                new Notice(`插入数据库行失败: ${data.message}`);
                return null;
            }
        } catch (error) {
            console.error('Error inserting database row:', error);
            new Notice('网络错误：无法插入数据库行');
            return null;
        }
    }

    private extractPageIdFromUrl(url: string): string | null {
        // 从Wolai页面URL中提取页面ID
        // URL格式: https://www.wolai.com/{pageId}
        const match = url.match(/wolai\.com\/([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
    }

    async insertDatabaseRowAndGetPageId(databaseId: string, rowData: WolaiDatabaseRow): Promise<string | null> {
        const rowUrl = await this.insertDatabaseRow(databaseId, rowData);
        if (!rowUrl) {
            return null;
        }
        
        return this.extractPageIdFromUrl(rowUrl);
    }

    async getDatabaseContent(databaseId: string, pageSize: number = 200, startCursor?: string): Promise<WolaiDatabaseContent | null> {
        const token = await this.getValidToken();
        if (!token) {
            return null;
        }

        try {
            let url = `${this.baseUrl}/databases/${databaseId}?page_size=${pageSize}`;
            if (startCursor) {
                url += `&start_cursor=${startCursor}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': token
                }
            });

            const responseData: WolaiDatabaseResponse = await response.json();
            
            if (responseData.data) {
                console.log(`Retrieved ${responseData.data.rows.length} database rows`);
                
                // 只有成功时才计入统计
                this.incrementAPICall();
                
                return responseData.data;
            } else {
                console.error('Failed to get database content:', responseData.message);
                new Notice(`获取数据库内容失败: ${responseData.message}`);
                return null;
            }
        } catch (error) {
            console.error('Error getting database content:', error);
            new Notice('网络错误：无法获取数据库内容');
            return null;
        }
    }

    async getAllDatabaseContent(databaseId: string): Promise<WolaiDatabaseRowData[]> {
        const allRows: WolaiDatabaseRowData[] = [];
        let startCursor: string | undefined = undefined;
        let hasMore = true;

        while (hasMore) {
            const content = await this.getDatabaseContent(databaseId, 200, startCursor);
            if (!content) {
                break;
            }

            allRows.push(...content.rows);

            // 检查是否有更多页面（这需要根据实际API响应结构调整）
            // 如果API返回分页信息，这里需要相应处理
            hasMore = false; // 暂时设为false，等确认API分页响应格式后调整
        }

        console.log(`Retrieved total ${allRows.length} database rows`);
        return allRows;
    }

    async createBlocks(parentId: string, blocks: WolaiBlock[]): Promise<string | null> {
        const token = await this.getValidToken();
        if (!token) {
            return null;
        }

        try {
            // 分层处理块：先创建顶级块，再创建嵌套块
            const topLevelBlocks = blocks.filter(block => !(block as any).needsParent);
            const nestedBlocks = blocks.filter(block => (block as any).needsParent);
            
            // 创建顶级块
            if (topLevelBlocks.length > 0) {
                await this.createBlocksBatch(parentId, topLevelBlocks);
            }
            
            // 对于嵌套块，目前暂时作为顶级块处理
            // TODO: 实现真正的嵌套块创建逻辑
            if (nestedBlocks.length > 0) {
                // 清理临时属性
                const cleanedNestedBlocks = nestedBlocks.map(block => {
                    const cleanBlock = { ...block };
                    delete (cleanBlock as any).depth;
                    delete (cleanBlock as any).needsParent;
                    return cleanBlock;
                });
                await this.createBlocksBatch(parentId, cleanedNestedBlocks);
            }
            
            return parentId; // 返回父页面ID
        } catch (error) {
            console.error('Error creating blocks:', error);
            new Notice('网络错误：无法创建块');
            return null;
        }
    }

    private async createBlocksBatch(parentId: string, blocks: WolaiBlock[]): Promise<boolean> {
        const token = await this.getValidToken();
        if (!token) {
            return false;
        }

            // 分批处理块，每批最多20个
            const batchSize = 20;
            for (let i = 0; i < blocks.length; i += batchSize) {
                const batch = blocks.slice(i, i + batchSize);
                
                const response = await fetch(`${this.baseUrl}/blocks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token
                    },
                    body: JSON.stringify({
                        parent_id: parentId,
                        blocks: batch
                    })
                });

            // 检查HTTP状态码
            if (!response.ok) {
                console.error(`Failed to create batch ${Math.floor(i / batchSize) + 1} blocks: HTTP ${response.status} ${response.statusText}`);
                
                let errorMessage = `HTTP ${response.status} ${response.statusText}`;
                try {
                    // 尝试解析错误响应
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const errorData = await response.json();
                        errorMessage = errorData.message || errorMessage;
                    } else {
                        // 如果不是JSON响应，获取文本内容
                        const errorText = await response.text();
                        errorMessage = errorText.substring(0, 200) || errorMessage;
                    }
                } catch (parseError) {
                    console.error('Failed to parse error response:', parseError);
                }
                
                new Notice(`创建块失败: ${errorMessage}`);
                return false;
            }

            // 解析成功响应
            let data: WolaiCreateBlocksResponse;
            try {
                data = await response.json();
            } catch (parseError) {
                console.error(`Failed to parse response JSON for batch ${Math.floor(i / batchSize) + 1}:`, parseError);
                new Notice('创建块失败: 响应格式错误');
                return false;
            }
                
                if (data.data) {
                    console.log(`Batch ${Math.floor(i / batchSize) + 1} blocks created successfully:`, data.data);
                    
                    // 只有成功时才计入统计
                    this.incrementAPICall();
                } else {
                console.error(`Failed to create batch ${Math.floor(i / batchSize) + 1} blocks:`, data.message || 'Unknown error');
                new Notice(`创建块失败: ${data.message || 'Unknown error'}`);
                return false;
                }
            }
            
        return true;
    }

    async retryWithExponentialBackoff<T>(
        operation: () => Promise<T>,
        maxRetries: number = 3,
        baseDelay: number = 1000
    ): Promise<T | null> {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                if (attempt === maxRetries) {
                    console.error(`Operation failed after ${maxRetries + 1} attempts:`, error);
                    return null;
                }
                
                const delay = baseDelay * Math.pow(2, attempt);
                console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return null;
    }

    async getPageContent(pageId: string): Promise<WolaiPageBlock[] | null> {
        const token = await this.getValidToken();
        if (!token) {
            return null;
        }

        try {
            const response = await fetch(`${this.baseUrl}/blocks/${pageId}/children`, {
                method: 'GET',
                headers: {
                    'Authorization': token
                }
            });

            if (!response.ok) {
                console.error(`Failed to get page content: HTTP ${response.status} ${response.statusText}`);
                new Notice(`获取页面内容失败: HTTP ${response.status}`);
                return null;
            }

            const data: WolaiPageResponse = await response.json();
            
            if (data.data) {
                console.log(`Retrieved page content with ${data.data.length} blocks`);
                
                // 只有成功时才计入统计
                this.incrementAPICall();
                
                return data.data;
            } else {
                console.error('Failed to get page content:', data.message);
                new Notice(`获取页面内容失败: ${data.message}`);
                return null;
            }
        } catch (error) {
            console.error('Error getting page content:', error);
            new Notice('网络错误：无法获取页面内容');
            return null;
        }
    }

    async getAllPageBlocks(pageId: string): Promise<WolaiPageBlock[]> {
        const pageContent = await this.getPageContent(pageId);
        if (!pageContent) {
            return [];
        }
        
        // 递归获取所有子块
        const allBlocks = await this.expandBlocksWithChildren(pageContent);
        return allBlocks;
    }

    private async expandBlocksWithChildren(blocks: WolaiPageBlock[]): Promise<WolaiPageBlock[]> {
        const expandedBlocks: WolaiPageBlock[] = [];
        
        for (const block of blocks) {
            // 添加当前块
            expandedBlocks.push(block);
            
            // 检查是否有子块需要获取
            if (block.children && block.children.ids && block.children.ids.length > 0) {
                console.log(`Block ${block.id} has ${block.children.ids.length} children, fetching...`);
                
                try {
                    // 获取子块内容
                    const childBlocks = await this.getPageContent(block.id);
                    if (childBlocks && childBlocks.length > 0) {
                        console.log(`Retrieved ${childBlocks.length} child blocks for ${block.id}`);
                        
                        // 递归处理子块的子块
                        const expandedChildBlocks = await this.expandBlocksWithChildren(childBlocks);
                        
                        // 为子块添加缩进信息
                        const indentedChildBlocks = expandedChildBlocks.map(childBlock => ({
                            ...childBlock,
                            isChildBlock: true,
                            parentBlockId: block.id,
                            depth: (block as any).depth ? (block as any).depth + 1 : 1
                        }));
                        
                        expandedBlocks.push(...indentedChildBlocks);
                    }
                } catch (error) {
                    console.error(`Error fetching children for block ${block.id}:`, error);
                    // 继续处理其他块，不因为单个子块获取失败而停止
                }
                
                // 添加延迟避免API限制
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        return expandedBlocks;
    }
} 