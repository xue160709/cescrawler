import * as fs from 'fs';
import * as path from 'path';

async function mergeMdFiles() {
    const inputDir = path.join(__dirname, 'output_md_en');
    const outputFile = path.join(__dirname, 'ces_en.md');
    
    try {
        // 读取目录中的所有文件
        const files = fs.readdirSync(inputDir)
            .filter(file => file.endsWith('.md'));
            
        let mergedContent = '';
        
        // 处理每个文件
        for (const file of files) {
            const content = fs.readFileSync(
                path.join(inputDir, file), 
                'utf-8'
            );
            
            // 添加文件内容和额外的换行
            mergedContent += content + '\n\n---\n\n';
        }
        
        // 写入合并后的文件
        fs.writeFileSync(outputFile, mergedContent, 'utf-8');
        console.log('成功合并所有 Markdown 文件到 ces_en.md');
        
    } catch (error) {
        console.error('合并文件时出错:', error);
    }
}

// 运行函数
mergeMdFiles().catch(console.error); 