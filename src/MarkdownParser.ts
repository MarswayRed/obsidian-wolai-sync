import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { ParsedMarkdown, WolaiBlock, MarkdownNode, SyncStatus, FileSyncInfo, CreateRichText, WolaiRichText, WolaiPageBlock } from './types';

export class MarkdownParser {
    
    parseFrontMatter(content: string): ParsedMarkdown {
        try {
            const parsed = matter(content);
            
            return {
                frontMatter: parsed.data || {},
                content: parsed.content || '',
                blocks: [] // 将在后续步骤中填充
            };
        } catch (error) {
            console.error('Error parsing front matter:', error);
            return {
                frontMatter: {},
                content: content,
                blocks: []
            };
        }
    }

    getSyncInfo(frontMatter: { [key: string]: any }): FileSyncInfo {
        return {
            sync_status: frontMatter.sync_status || 'Pending',
            wolai_id: frontMatter.wolai_id,
            last_sync: frontMatter.last_sync
        };
    }

    setSyncInfo(frontMatter: { [key: string]: any }, syncInfo: FileSyncInfo): { [key: string]: any } {
        return {
            ...frontMatter,
            sync_status: syncInfo.sync_status,
            wolai_id: syncInfo.wolai_id,
            last_sync: syncInfo.last_sync
        };
    }

    updateSyncStatus(content: string, syncStatus: SyncStatus, wolaiId?: string): string {
        try {
            const parsed = matter(content);
            
            // 更新FrontMatter中的同步状态
            const updatedFrontMatter: { [key: string]: any } = {
                ...parsed.data,
                sync_status: syncStatus,
                last_sync: new Date().toISOString()
            };

            if (wolaiId) {
                updatedFrontMatter.wolai_id = wolaiId;
            }

            // 重新组装文件内容
            return matter.stringify(parsed.content, updatedFrontMatter);
        } catch (error) {
            console.error('Error updating sync status:', error);
            return content;
        }
    }

    needsSync(frontMatter: { [key: string]: any }): boolean {
        const syncInfo = this.getSyncInfo(frontMatter);
        return syncInfo.sync_status === 'Pending' || syncInfo.sync_status === 'Modified';
    }

    isSynced(frontMatter: { [key: string]: any }): boolean {
        const syncInfo = this.getSyncInfo(frontMatter);
        return syncInfo.sync_status === 'Synced';
    }

    parseMarkdownToAST(content: string): MarkdownNode | null {
        try {
            const processor = unified().use(remarkParse as any);
            const ast = processor.parse(content);
            return ast as MarkdownNode;
        } catch (error) {
            console.error('Error parsing markdown to AST:', error);
            return null;
        }
    }

    parseMarkdown(content: string): ParsedMarkdown {
        const frontMatterResult = this.parseFrontMatter(content);
        const ast = this.parseMarkdownToAST(frontMatterResult.content);
        
        if (!ast) {
            return frontMatterResult;
        }

        const blocks = this.convertASTToWolaiBlocks(ast);
        
        return {
            ...frontMatterResult,
            blocks: blocks
        };
    }

    private convertASTToWolaiBlocks(node: MarkdownNode): WolaiBlock[] {
        const blocks: WolaiBlock[] = [];
        
        if (node.children) {
            for (const child of node.children) {
                if (child.type === 'list') {
                    // 列表需要特殊处理，展开为多个独立的列表项blocks
                    const listBlocks = this.convertListToWolaiBlocks(child);
                    blocks.push(...listBlocks);
                } else {
                const block = this.convertNodeToWolaiBlock(child);
                if (block) {
                    blocks.push(block);
                    }
                }
            }
        }
        
        return blocks;
    }

    private convertNodeToWolaiBlock(node: MarkdownNode): WolaiBlock | null {
        switch (node.type) {
            case 'heading':
                return {
                    type: 'heading',
                    level: node.depth || 1,
                    content: this.extractRichTextFromNode(node)
                };
            
            case 'paragraph':
                const richText = this.extractRichTextFromNode(node);
                const plainText = this.extractTextFromNode(node);
                if (plainText.trim()) {
                    return {
                        type: 'text',
                        content: richText
                    };
                }
                return null;
            
            case 'code':
                return {
                    type: 'code',
                    content: node.value || '',
                        language: node.lang || 'text'
                };
            
            case 'blockquote':
                return {
                    type: 'quote',
                    content: this.extractRichTextFromNode(node)
                };
            
            default:
                // 对于不支持的类型，转换为文本块
                const content = this.extractRichTextFromNode(node);
                const contentText = this.extractTextFromNode(node);
                if (contentText.trim()) {
                    return {
                        type: 'text',
                        content: content
                    };
                }
                return null;
        }
    }

    private convertListToWolaiBlocks(listNode: MarkdownNode, depth: number = 0): WolaiBlock[] {
        const blocks: WolaiBlock[] = [];
        const listType = listNode.ordered ? 'enum_list' : 'bull_list';
        
        if (listNode.children) {
            for (const listItem of listNode.children) {
                if (listItem.type === 'listItem') {
                    // 处理列表项的直接文本内容（不包括嵌套列表）
                    const directTextContent = this.extractDirectTextFromListItem(listItem);
                    const directPlainText = this.extractTextFromNode(listItem);
                    
                    if (directPlainText.trim()) {
                        const block: WolaiBlock = {
                            type: listType,
                            content: directTextContent
                        };
                        
                        // 添加层级信息用于后续处理
                        if (depth > 0) {
                            (block as any).depth = depth;
                            (block as any).needsParent = true;
                        }
                        
                        blocks.push(block);
                    }
                    
                    // 处理嵌套列表
                    const nestedLists = this.extractNestedListsFromListItem(listItem);
                    for (const nestedList of nestedLists) {
                        const nestedBlocks = this.convertListToWolaiBlocks(nestedList, depth + 1);
                        blocks.push(...nestedBlocks);
                    }
                }
            }
        }
        
        return blocks;
    }

    private extractDirectTextFromListItem(listItem: MarkdownNode): CreateRichText {
        if (!listItem.children) return '';
        
        const richTextParts: (string | WolaiRichText)[] = [];
        for (const child of listItem.children) {
            // 只提取非列表的内容
            if (child.type !== 'list') {
                const childRichText = this.extractRichTextFromNode(child);
                if (childRichText) {
                    if (Array.isArray(childRichText)) {
                        richTextParts.push(...childRichText);
                    } else {
                        richTextParts.push(childRichText);
                    }
                }
            }
        }
        
        // 如果只有一个元素且是字符串，直接返回字符串
        if (richTextParts.length === 1 && typeof richTextParts[0] === 'string') {
            return richTextParts[0];
        }
        
        // 如果有多个元素或包含格式化文本，返回数组
        return richTextParts.length > 0 ? richTextParts : '';
    }

    private extractNestedListsFromListItem(listItem: MarkdownNode): MarkdownNode[] {
        const nestedLists: MarkdownNode[] = [];
        
        if (listItem.children) {
            for (const child of listItem.children) {
                if (child.type === 'list') {
                    nestedLists.push(child);
            }
            }
        }
        
        return nestedLists;
    }

    private extractTextFromNode(node: MarkdownNode): string {
        const richText = this.extractRichTextFromNode(node);
        if (typeof richText === 'string') {
            return richText;
        } else if (Array.isArray(richText)) {
            return richText.map(item => 
                typeof item === 'string' ? item : item.title
            ).join('');
        } else {
            return richText.title;
        }
    }

    private extractRichTextFromNode(node: MarkdownNode): CreateRichText {
        if (node.value) {
            return node.value;
        }
        
        if (node.children) {
            const richTextParts: (string | WolaiRichText)[] = [];
            
            for (const child of node.children) {
                const childRichText = this.convertNodeToRichText(child);
                if (childRichText) {
                    if (Array.isArray(childRichText)) {
                        richTextParts.push(...childRichText);
                    } else {
                        richTextParts.push(childRichText);
                    }
                }
            }
            
            // 如果只有一个元素且是字符串，直接返回字符串
            if (richTextParts.length === 1 && typeof richTextParts[0] === 'string') {
                return richTextParts[0];
            }
            
            // 如果有多个元素或包含格式化文本，返回数组
            return richTextParts.length > 0 ? richTextParts : '';
        }
        
        return '';
    }

    private convertNodeToRichText(node: MarkdownNode): CreateRichText | null {
        switch (node.type) {
            case 'text':
                return node.value || '';
                
            case 'strong': // **加粗**
                const boldText = this.extractTextFromNode(node);
                if (boldText.trim()) {
                    return {
                        title: boldText,
                        bold: true
                    };
                }
                return null;
                
            case 'emphasis': // *斜体*
                const italicText = this.extractTextFromNode(node);
                if (italicText.trim()) {
                    return {
                        title: italicText,
                        italic: true
                    };
                }
                return null;
                
            case 'inlineCode': // `行内代码`
                return {
                    title: node.value || '',
                    inline_code: true
                };
                
            case 'delete': // ~~删除线~~
                const strikeText = this.extractTextFromNode(node);
                if (strikeText.trim()) {
                    return {
                        title: strikeText,
                        strikethrough: true
                    };
                }
                return null;
                
            case 'link': // [文本](链接)
                if (node.url) {
                    // 处理链接文本，可能包含格式化内容
                    const linkTextContent = this.extractRichTextFromNode(node);
                    let linkTitle = '';
                    
                    // 如果链接文本是简单字符串，直接使用
                    if (typeof linkTextContent === 'string') {
                        linkTitle = linkTextContent;
                    } else if (Array.isArray(linkTextContent)) {
                        // 如果链接文本包含格式，提取纯文本作为标题
                        linkTitle = linkTextContent.map(item => 
                            typeof item === 'string' ? item : item.title
                        ).join('');
                    } else {
                        linkTitle = linkTextContent.title;
                    }
                    
                    if (linkTitle.trim()) {
                        return {
                            title: linkTitle,
                            link: node.url
                        };
                    }
                }
                return null;
                
            default:
                // 对于其他类型，递归处理子节点
                if (node.children) {
                    const childParts: (string | WolaiRichText)[] = [];
                    for (const child of node.children) {
                        const childResult = this.convertNodeToRichText(child);
                        if (childResult) {
                            if (Array.isArray(childResult)) {
                                childParts.push(...childResult);
                            } else {
                                childParts.push(childResult);
                            }
                        }
                    }
                    return childParts.length > 0 ? childParts : null;
                }
                return node.value || null;
        }
    }

    createHash(content: string): string {
        // 简单的哈希函数，用于检测文件变化
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash).toString(16);
    }

    sanitizeFileName(filename: string): string {
        // 从文件名生成合适的标题
        return filename
            .replace(/\.md$/, '')
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    extractTitle(frontMatter: any, filename: string): string {
        // 尝试从多个字段获取标题
        return frontMatter.title || 
               frontMatter.name || 
               frontMatter.标题 || 
               this.sanitizeFileName(filename);
    }

    convertWolaiPageToMarkdown(blocks: WolaiPageBlock[], title?: string): string {
        let markdown = '';
        
        // 添加标题（如果提供）
        if (title) {
            markdown += `# ${title}\n\n`;
        }
        
        // 转换每个块
        for (const block of blocks) {
            const blockMarkdown = this.convertWolaiBlockToMarkdown(block);
            if (blockMarkdown) {
                markdown += blockMarkdown + '\n\n';
            }
        }
        
        return markdown.trim();
    }

    private convertWolaiBlockToMarkdown(block: WolaiPageBlock): string {
        // 获取缩进级别
        const depth = (block as any).depth || 0;
        const isChildBlock = (block as any).isChildBlock || false;
        const indent = isChildBlock ? '\t'.repeat(depth) : '';
        
        let blockContent = '';
        
        switch (block.type) {
            case 'heading':
                const level = Math.min(Math.max(block.level || 1, 1), 6); // 限制在1-6级
                const headingPrefix = '#'.repeat(level);
                const headingContent = this.convertRichTextToMarkdown(block.content);
                blockContent = `${headingPrefix} ${headingContent}`;
                break;
                
            case 'text':
                blockContent = this.convertRichTextToMarkdown(block.content);
                break;
                
            case 'quote':
            case 'blockquote':
                const quoteContent = this.convertRichTextToMarkdown(block.content);
                blockContent = `> ${quoteContent}`;
                break;
                
            case 'code':
                const language = (block as any).language || '';
                const codeContent = typeof block.content === 'string' ? block.content : 
                                 Array.isArray(block.content) ? block.content.map(c => typeof c === 'string' ? c : c.title).join('') :
                                 block.content?.title || '';
                blockContent = `\`\`\`${language}\n${codeContent}\n\`\`\``;
                break;
                
            case 'bull_list':
            case 'unordered_list':
                const bulletContent = this.convertRichTextToMarkdown(block.content);
                // 无序列表直接应用缩进
                return `${indent}- ${bulletContent}`;
                
            case 'enum_list':
            case 'ordered_list':
                const enumContent = this.convertRichTextToMarkdown(block.content);
                // 有序列表需要正确的缩进，但保持1.编号
                return `${indent}1. ${enumContent}`;
                
            case 'image':
                // 处理图片块
                const altText = this.convertRichTextToMarkdown(block.content) || 'image';
                const imageUrl = (block as any).url || '';
                blockContent = imageUrl ? `![${altText}](${imageUrl})` : `*[图片: ${altText}]*`;
                break;
                
            case 'divider':
            case 'separator':
                blockContent = '---';
                break;
                
            case 'table':
                // 表格暂时作为文本处理
                blockContent = this.convertRichTextToMarkdown(block.content) || '*[表格内容]*';
                break;
                
            case 'equation':
                // 数学公式
                const equation = this.convertRichTextToMarkdown(block.content);
                blockContent = `$$\n${equation}\n$$`;
                break;
                
            case 'toggle':
                // 折叠块
                const toggleContent = this.convertRichTextToMarkdown(block.content);
                blockContent = `<details>\n<summary>${toggleContent}</summary>\n\n</details>`;
                break;
                
            default:
                // 对于未知类型，作为普通文本处理并记录日志
                console.warn(`Unknown block type: ${block.type}, treating as text`);
                const content = this.convertRichTextToMarkdown(block.content);
                blockContent = content || '';
        }
        
        // 应用缩进（对于非列表项）
        if (indent && blockContent) {
            // 对于其他类型，给每行添加缩进
            const lines = blockContent.split('\n');
            return lines.map(line => line.trim() ? `${indent}${line}` : line).join('\n');
        }
        
        return blockContent;
    }

    private convertRichTextToMarkdown(content?: CreateRichText): string {
        if (!content) {
            return '';
        }
        
        if (typeof content === 'string') {
            return content;
        }
        
        if (Array.isArray(content)) {
            return content.map(item => this.convertRichTextToMarkdown(item)).join('');
        }
        
        // 处理WolaiRichText对象
        const richText = content as WolaiRichText;
        let result = richText.title || '';
        
        // 应用格式
        if (richText.bold) {
            result = `**${result}**`;
        }
        if (richText.italic) {
            result = `*${result}*`;
        }
        if (richText.strikethrough) {
            result = `~~${result}~~`;
        }
        if (richText.inline_code) {
            result = `\`${result}\``;
        }
        if (richText.link) {
            result = `[${result}](${richText.link})`;
        }
        
        return result;
    }
} 