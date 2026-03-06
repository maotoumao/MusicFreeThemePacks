import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import { rimraf } from 'rimraf';
import CryptoJS from 'crypto-js';
import { nanoid } from 'nanoid';

const THEMES_DIR = './themes';

function safeParse(str) {
    try {
        return JSON.parse(str);
    } catch {
        return {};
    }
}

/**
 * 从主题的 preview 字段中提取预览图文件，复制到 .publish/previews/
 */
async function extractPreview(folderName, config) {
    if (!config.preview || !config.preview.startsWith('@/')) {
        return null;
    }

    const previewRelPath = config.preview.replace('@/', '');
    const previewSrc = path.join(THEMES_DIR, folderName, previewRelPath);
    const ext = path.extname(previewSrc);
    const previewDest = `./.publish/previews/${folderName}${ext}`;

    try {
        await fs.copyFile(previewSrc, previewDest);
        return `previews/${folderName}${ext}`;
    } catch (e) {
        console.warn(`  ⚠️  预览图提取失败: ${previewSrc} - ${e.message}`);
        return null;
    }
}

async function publish() {
    console.log('🚀 开始发布...\n');

    // 1. 清理临时目录
    await rimraf('./.publish/*', { 'glob': true });
    await rimraf('./.temp/*', { 'glob': true });

    // 创建产物目录结构
    await fs.mkdir('./.publish/themes', { recursive: true });
    await fs.mkdir('./.publish/previews', { recursive: true });

    // 2. 加载 meta.json 和 tags.json
    const metaConfig = await fs.readFile('./meta.json', 'utf-8');
    const meta = safeParse(metaConfig);

    const tagsData = JSON.parse(await fs.readFile('./tags.json', 'utf-8'));
    const availableTags = tagsData.tags;

    // 3. 获取所有主题文件夹
    const validFolders = (await fs.readdir(THEMES_DIR, {
        'withFileTypes': true
    })).filter(it => it.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));

    console.log(`📋 发现 ${validFolders.length} 个主题\n`);

    // 4. 逐个处理主题
    const themeConfigs = await Promise.all(validFolders.map(async folder => {
        try {
            const themeMeta = meta[folder.name] || {};
            meta[folder.name] = themeMeta;

            // 分配稳定 ID
            if (!themeMeta.id) {
                themeMeta.id = nanoid();
            }

            // 记录创建时间（首次加入时自动设置，永不更改）
            if (!themeMeta.createdAt) {
                themeMeta.createdAt = new Date().toISOString();
            }

            // 复制到临时目录
            await fs.cp(`${THEMES_DIR}/${folder.name}`, `./.temp/${folder.name}`, {
                recursive: true
            });

            // 读取原始 config
            const rawConfig = JSON.parse(await fs.readFile(`${THEMES_DIR}/${folder.name}/config.json`, 'utf-8'));

            // 合并 config（meta 覆盖 config 字段）
            const mergedConfig = {
                ...rawConfig,
                ...themeMeta
            };

            const mergedConfigStr = JSON.stringify(mergedConfig);
            await fs.writeFile(`./.temp/${folder.name}/config.json`, mergedConfigStr, 'utf-8');

            // 内容哈希
            const hash = CryptoJS.MD5(mergedConfigStr).toString(CryptoJS.enc.Hex);

            // 打包成 .mftheme
            const outputName = `${folder.name}-${hash}`;
            const outputPath = `./.publish/themes/${outputName}.mftheme`;
            const archive = archiver('zip');
            const output = createWriteStream(outputPath);
            const promise = new Promise((resolve, reject) => {
                archive.on('end', resolve);
                archive.on('close', resolve);
                archive.on('error', reject);
            });

            archive.pipe(output);
            archive.directory(`./.temp/${folder.name}`, false);
            archive.finalize();
            await promise;

            // 提取预览图
            const previewUrl = await extractPreview(folder.name, rawConfig);

            // 推断类型
            const type = rawConfig.iframe ? 'dynamic' : 'static';

            console.log(`  ✅ ${folder.name} → ${outputName}.mftheme`);

            return {
                id: themeMeta.id,
                name: mergedConfig.name,
                packageName: folder.name,
                author: mergedConfig.author,
                authorUrl: mergedConfig.authorUrl || '',
                description: mergedConfig.description || '',
                version: mergedConfig.version || '0.0.1',
                type,
                tags: mergedConfig.tags || [],
                preview: previewUrl || mergedConfig.preview,
                themeUrl: `themes/${outputName}.mftheme`,
                hash,
                publishName: outputName,
                createdAt: themeMeta.createdAt,
            };

        } catch (e) {
            console.warn(`  ❌ ${folder.name} 打包失败: ${e.message}`);
            return null;
        } finally {
            await rimraf(`./.temp/${folder.name}`);
        }
    }));

    // 5. 过滤失败项
    const validThemes = themeConfigs.filter(Boolean);

    // 6. 构建标签索引
    const tagIndex = {};
    for (const theme of validThemes) {
        for (const tag of theme.tags) {
            if (!tagIndex[tag]) {
                tagIndex[tag] = [];
            }
            tagIndex[tag].push(theme.id);
        }
    }

    // 7. 写入 publish.json
    const publishData = {
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
        themes: validThemes,
        tagIndex,
        availableTags,
    };

    await fs.writeFile('./.publish/publish.json', JSON.stringify(publishData, null, 2), 'utf-8');

    // 8. 更新 meta.json
    await fs.writeFile('./meta.json', JSON.stringify(meta, undefined, 4), 'utf-8');

    console.log('');
    console.log(`✅ 发布完成: ${validThemes.length} 个主题`);
    console.log(`📁 产物目录: .publish/`);
    console.log(`   ├── publish.json`);
    console.log(`   ├── themes/ (${validThemes.length} 个 .mftheme)`);
    console.log(`   └── previews/`);
}

publish();