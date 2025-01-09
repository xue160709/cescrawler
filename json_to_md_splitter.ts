import * as fs from 'fs';
import * as path from 'path';

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

function createMarkdownContent(product: Product): string {
    return `# ${product.name}

## Basic Information
- Company: ${product.company}
- Honor: ${product.honor}
- Categories: ${product.categories.join(', ')}
- URL: ${product.url}

![${product.image.alt || product.name}](${product.image.src})

${product.description ? `## Description
${product.description}` : ''}
`;
}

async function splitJsonToMarkdown() {
    try {
        // 创建输出目录
        const outputDir = path.join(__dirname, 'output_md_en');
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
                    console.warn('Skipping product without name');
                    continue;
                }

                const fileName = sanitizeFileName(product.name);
                const filePath = path.join(outputDir, `${fileName}.md`);

                // 创建markdown内容
                const markdownContent = createMarkdownContent(product);

                // 写入文件
                fs.writeFileSync(filePath, markdownContent, 'utf-8');
                console.log(`Successfully created: ${fileName}.md`);

            } catch (productError) {
                console.error(`Error processing product "${product.name}":`, productError);
                continue;
            }
        }

        console.log('All files processed successfully!');

    } catch (error) {
        console.error('Program execution error:', error);
    }
}

// 执行程序
splitJsonToMarkdown(); 