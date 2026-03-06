/**
 * MusicFree 主题包校验脚本
 *
 * 用法:
 *   node .scripts/validate.mjs                      # 校验所有主题
 *   node .scripts/validate.mjs --themes a,b,c       # 校验指定主题
 *   node .scripts/validate.mjs --changed-only        # 仅列出变更主题（配合 CI）
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const THEMES_DIR = path.join(ROOT, 'themes');

const SIZE_LIMITS = {
    IMAGE_MAX: 500 * 1024,         // 500 KB
    VIDEO_MAX: 5 * 1024 * 1024,    // 5 MB
    THEME_TOTAL_MAX: 10 * 1024 * 1024, // 10 MB
};

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const VIDEO_EXTS = new Set(['.mp4', '.webm']);
const ALLOWED_EXTS = new Set([
    ...IMAGE_EXTS, ...VIDEO_EXTS,
    '.css', '.html', '.js', '.json', '.md',
]);

const FOLDER_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;
const COLOR_VALUE_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;
const PREVIEW_PATH_REGEX = /^@\/.+\/.+$/;

// ============ 工具函数 ============

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function loadTags() {
    const raw = await fs.readFile(path.join(ROOT, 'tags.json'), 'utf-8');
    const data = JSON.parse(raw);
    return new Set(data.tags.map(t => t.label));
}

async function getThemeFolders() {
    const entries = await fs.readdir(THEMES_DIR, { withFileTypes: true });
    return entries
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .sort();
}

async function getAllFiles(dir) {
    const results = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...(await getAllFiles(fullPath)));
        } else {
            results.push(fullPath);
        }
    }
    return results;
}

// ============ 校验器 ============

class ThemeValidator {
    constructor(themeName, themeDir, validTags) {
        this.name = themeName;
        this.dir = themeDir;
        this.validTags = validTags;
        this.errors = [];
        this.warnings = [];
    }

    error(msg) { this.errors.push(msg); }
    warn(msg) { this.warnings.push(msg); }

    // --- 1. 文件夹命名校验 ---
    validateFolderName() {
        if (!FOLDER_NAME_REGEX.test(this.name)) {
            this.error(`文件夹名 "${this.name}" 不符合规范（仅允许字母、数字、连字符、下划线）`);
        }
    }

    // --- 2. 必要文件检测 ---
    async validateRequiredFiles() {
        const configPath = path.join(this.dir, 'config.json');
        const cssPath = path.join(this.dir, 'index.css');

        try {
            await fs.access(configPath);
        } catch {
            this.error('缺少 config.json');
        }
        try {
            await fs.access(cssPath);
        } catch {
            this.error('缺少 index.css');
        }
    }

    // --- 3. 目录结构校验 ---
    async validateDirectoryStructure() {
        const entries = await fs.readdir(this.dir, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (!FOLDER_NAME_REGEX.test(entry.name)) {
                    this.error(`子目录名不符合规范: ${entry.name}/（仅允许字母、数字、连字符、下划线）`);
                }
            }
        }
    }

    // --- 4. config.json Schema 校验 ---
    async validateConfig() {
        const configPath = path.join(this.dir, 'config.json');
        let config;

        try {
            const raw = await fs.readFile(configPath, 'utf-8');
            config = JSON.parse(raw);
        } catch (e) {
            this.error(`config.json 解析失败: ${e.message}`);
            return null;
        }

        // 必填字段
        const required = ['name', 'author', 'preview', 'description', 'version', 'tags'];
        for (const field of required) {
            if (config[field] === undefined || config[field] === null || config[field] === '') {
                this.error(`config.json 缺少必填字段: ${field}`);
            }
        }

        // 禁止字段
        if ('id' in config) {
            this.error('config.json 中不允许包含 "id" 字段（由 meta.json 统一管理）');
        }

        // 不允许的字段（typo 检测）
        if ('iframes' in config) {
            this.error('config.json 中存在拼写错误："iframes" 应为 "iframe"');
        }

        // version 格式
        if (config.version && !SEMVER_REGEX.test(config.version)) {
            this.error(`version 格式不符合 semver: "${config.version}"（应为 x.y.z）`);
        }

        // tags 校验
        if (Array.isArray(config.tags)) {
            if (config.tags.length < 1) {
                this.error('tags 至少需要 1 个标签');
            }
            if (config.tags.length > 5) {
                this.error('tags 最多 5 个标签');
            }
            for (const tag of config.tags) {
                if (!this.validTags.has(tag)) {
                    this.error(`无效标签: "${tag}"（不在 tags.json 预定义列表中）`);
                }
            }
            // 含 iframe 的主题必须有 "动态" 标签
            if (config.iframe && !config.tags.includes('动态')) {
                this.error('含 iframe 的动态主题必须包含 "动态" 标签');
            }
        }

        // preview 路径校验
        if (config.preview) {
            if (config.preview.startsWith('@/')) {
                // 文件路径，必须以 @/ 开头并指向存在的文件
                if (!PREVIEW_PATH_REGEX.test(config.preview)) {
                    this.error(`preview 路径格式不正确，应为 "@/目录/文件名"，当前: "${config.preview}"`);
                }
                // 检查文件是否存在
                const previewFile = path.join(this.dir, config.preview.replace('@/', ''));
                try {
                    await fs.access(previewFile);
                } catch {
                    this.error(`preview 引用的文件不存在: ${config.preview}`);
                }
            } else if (config.preview.startsWith('#')) {
                // CSS 颜色值
                if (!COLOR_VALUE_REGEX.test(config.preview)) {
                    this.error(`preview 颜色值格式不正确: "${config.preview}"`);
                }
            } else {
                this.error(`preview 格式不正确: "${config.preview}"（应为 @/目录/文件名 或 #颜色值）`);
            }
        }

        // iframe 配置校验
        if (config.iframe) {
            if (typeof config.iframe !== 'object' || !config.iframe.app) {
                this.error('iframe 配置格式不正确（需要 { "app": "@/iframes/xxx.html" }）');
            } else {
                // 检查 iframe 文件是否存在
                const iframePath = path.join(this.dir, config.iframe.app.replace('@/', ''));
                try {
                    await fs.access(iframePath);
                } catch {
                    this.error(`iframe 引用的文件不存在: ${config.iframe.app}`);
                }
            }
        }

        // 额外字段检测
        const allowedFields = new Set(['name', 'author', 'authorUrl', 'preview', 'description', 'version', 'tags', 'iframe']);
        for (const key of Object.keys(config)) {
            if (!allowedFields.has(key)) {
                this.warn(`config.json 包含未知字段: "${key}"`);
            }
        }

        return config;
    }

    // --- 5. 资源大小校验 ---
    async validateResourceSizes() {
        const files = await getAllFiles(this.dir);
        let totalSize = 0;

        for (const filePath of files) {
            const stat = await fs.stat(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const relativePath = path.relative(this.dir, filePath);
            totalSize += stat.size;

            // 文件格式白名单
            if (!ALLOWED_EXTS.has(ext)) {
                this.warn(`文件格式不在白名单中: ${relativePath} (${ext})`);
            }

            // 图片大小
            if (IMAGE_EXTS.has(ext) && stat.size > SIZE_LIMITS.IMAGE_MAX) {
                this.error(`图片过大: ${relativePath} (${formatSize(stat.size)} > ${formatSize(SIZE_LIMITS.IMAGE_MAX)})`);
            }

            // 视频大小
            if (VIDEO_EXTS.has(ext) && stat.size > SIZE_LIMITS.VIDEO_MAX) {
                this.error(`视频过大: ${relativePath} (${formatSize(stat.size)} > ${formatSize(SIZE_LIMITS.VIDEO_MAX)})`);
            }
        }

        // 主题包总大小
        if (totalSize > SIZE_LIMITS.THEME_TOTAL_MAX) {
            this.error(`主题包总大小超限: ${formatSize(totalSize)} > ${formatSize(SIZE_LIMITS.THEME_TOTAL_MAX)}`);
        }
    }

    // --- 执行所有校验 ---
    async validate() {
        this.validateFolderName();
        await this.validateRequiredFiles();
        await this.validateDirectoryStructure();
        await this.validateConfig();
        await this.validateResourceSizes();
        return {
            name: this.name,
            errors: this.errors,
            warnings: this.warnings,
            passed: this.errors.length === 0,
        };
    }
}

// ============ 主函数 ============

async function main() {
    const args = process.argv.slice(2);
    let targetThemes = null;

    // 解析参数
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--themes' && args[i + 1]) {
            targetThemes = args[i + 1].split(',').map(s => s.trim()).filter(Boolean);
            i++;
        }
        if (args[i] === '--changed-only') {
            // 仅列出变更主题名（供 CI 使用）
            const allThemes = await getThemeFolders();
            console.log(allThemes.join(','));
            process.exit(0);
        }
    }

    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   MusicFree ThemePacks 主题校验工具      ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');

    const validTags = await loadTags();
    const allThemes = await getThemeFolders();
    const themes = targetThemes
        ? targetThemes.filter(t => allThemes.includes(t))
        : allThemes;

    if (targetThemes) {
        const notFound = targetThemes.filter(t => !allThemes.includes(t));
        if (notFound.length) {
            console.log(`⚠️  未找到的主题: ${notFound.join(', ')}`);
        }
    }

    console.log(`📋 待校验主题: ${themes.length} 个\n`);

    let passCount = 0;
    let failCount = 0;
    const allResults = [];

    for (const themeName of themes) {
        const themeDir = path.join(THEMES_DIR, themeName);
        const validator = new ThemeValidator(themeName, themeDir, validTags);
        const result = await validator.validate();
        allResults.push(result);

        // 输出结果
        console.log(`🔍 ${themeName}`);
        if (result.passed) {
            passCount++;
            if (result.warnings.length) {
                for (const w of result.warnings) console.log(`   ⚠️  ${w}`);
            }
            console.log(`   ✅ 通过`);
        } else {
            failCount++;
            for (const e of result.errors) console.log(`   ❌ ${e}`);
            for (const w of result.warnings) console.log(`   ⚠️  ${w}`);
        }
        console.log('');
    }

    // 汇总
    console.log('────────────────────────────────────────────');
    console.log(`📊 校验结果: ${themes.length} 个主题, ✅ ${passCount} 通过, ❌ ${failCount} 失败`);
    console.log('');

    if (failCount > 0) {
        process.exit(1);
    }
}

main().catch(e => {
    console.error('校验脚本执行出错:', e);
    process.exit(1);
});
