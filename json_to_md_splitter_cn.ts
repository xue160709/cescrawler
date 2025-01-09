import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

interface Product {
    url: string;
    name: string;
    image: {
        src: string;
        alt: string;
    };
    company: string;
    honor: string;
    categories: string[];
    description?: string;
}

function sanitizeFileName(fileName: string): string {
    // 移除或替换不合法的文件名字符
    return fileName
        .replace(/[<>:"/\\|?*]/g, '')  // 移除Windows不允许的字符
        .replace(/\s+/g, '_')          // 将空格替换为下划线
        .toLowerCase();                 // 转换为小写以避免大小写问题
}

async function translateText(text: string, targetLang: string = 'zh-CN', sourceLang: string = 'en'): Promise<string> {
    const maxRetries = 3;
    const timeout = 30000; // 30秒超时
    
    // 将文本分成较小的块，每个不超过1000个字符
    const textChunks = text.match(/.{1,1000}/g) || [text];
    let translatedChunks = [];
    
    for (const chunk of textChunks) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(chunk)}`;
                
                const response = await axios({
                    method: 'get',
                    url: url,
                    timeout: timeout,
                    proxy: {
                        protocol: 'http',
                        host: '127.0.0.1',
                        port: 7890  // 根据你的代理端口修改
                    },
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'application/json',
                        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7'
                    }
                });
                
                if (!response.data || !response.data[0]) {
                    throw new Error('Invalid translation response');
                }
                
                const translatedChunk = response.data[0]
                    .map((item: any[]) => item[0])
                    .join('');
                    
                translatedChunks.push(translatedChunk);
                
                // 成功后等待一小段时间再处理下一块，避免请求过快
                if (textChunks.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                break; // 成功后跳出重试循环
                
            } catch (error: any) {
                console.error(`翻译尝试 ${attempt}/${maxRetries} 失败:`, error.message);
                
                if (attempt === maxRetries) {
                    console.warn('所有翻译尝试都失败，返回原文');
                    translatedChunks.push(chunk);
                    break;
                }
                
                // 在重试之前等待更长时间
                await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
            }
        }
    }
    
    return translatedChunks.join('');
}

async function createMarkdownContent(product: Product): Promise<string> {
    // 翻译描述（如果存在）
    const translatedDescription = product.description 
        ? await translateText(product.description)
        : '';

    return `# ${product.name}

## 基本信息
- 公司: ${product.company}
- 荣誉: ${product.honor}
- 类别: ${product.categories.join(', ')}
- 链接: ${product.url}

## 图片
![${product.image.alt || product.name}](${product.image.src})

${translatedDescription ? `## 描述
${translatedDescription}` : ''}
`;
}

async function splitJsonToMarkdown() {
    try {
        // 创建输出目录
        const outputDir = path.join(__dirname, 'output_md');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        // 读取JSON文件
        const jsonContent = fs.readFileSync(
            path.join(__dirname, 'ces_products.json'), 
            'utf-8'
        );
        const products: Product[] = JSON.parse(jsonContent);

        // 处理每个产品
        for (const product of products) {
            try {
                if (!product.name) {
                    console.warn('跳过没有名称的产品');
                    continue;
                }

                const fileName = sanitizeFileName(product.name);
                const filePath = path.join(outputDir, `${fileName}.md`);

                // 创建markdown内容 - 注意这里需要 await
                const markdownContent = await createMarkdownContent(product);

                // 写入文件
                fs.writeFileSync(filePath, markdownContent, 'utf-8');
                console.log(`成功创建: ${fileName}.md`);

            } catch (productError) {
                console.error(`处理产品 "${product.name}" 时出错:`, productError);
                continue; // 继续处理下一个产品
            }
        }

        console.log('所有文件处理完成！');

    } catch (error) {
        console.error('程序执行出错:', error);
    }
}

// 执行程序
splitJsonToMarkdown(); 