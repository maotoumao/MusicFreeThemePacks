# 贡献指南

感谢你对 MusicFree 主题包项目的贡献！请仔细阅读以下指南。

## 提交新主题

### 1. Fork 仓库

Fork 本仓库，并基于 `v1/source` 分支创建你的开发分支。

### 2. 创建主题文件夹

在 `themes/` 目录下创建主题文件夹，命名规则：**仅允许字母、数字、连字符（-）、下划线（_）**。

```
themes/your-theme-name/
├── config.json          # 必须 - 主题配置
├── index.css            # 必须 - 主题样式
├── imgs/                # 图片/视频资源
│   ├── preview.webp     # 预览图（推荐 webp 格式）
│   └── ...
└── iframes/             # 仅动态主题需要
    ├── app.html         # 动态主题入口
    └── ...
```

### 3. 编写 config.json

**静态主题模板：**

```json
{
    "name": "你的主题名称",
    "preview": "@/imgs/preview.webp",
    "description": "主题描述",
    "author": "你的名字",
    "authorUrl": "https://github.com/yourname",
    "version": "0.0.1",
    "tags": ["标签1", "标签2"]
}
```

**动态主题模板：**

```json
{
    "name": "你的主题名称【动态】",
    "preview": "@/imgs/preview.webp",
    "description": "主题描述",
    "author": "你的名字",
    "authorUrl": "https://github.com/yourname",
    "version": "0.0.1",
    "tags": ["动态", "标签2"],
    "iframe": {
        "app": "@/iframes/app.html"
    }
}
```

> ⚠️ **不要** 在 config.json 中添加 `id` 字段，ID 由系统自动管理。

### 4. 选择标签

从 [`tags.json`](./tags.json) 中选择 1-5 个预定义标签。含 `iframe` 的动态主题必须包含 `"动态"` 标签。

### 5. 资源限制

| 约束项 | 限制 |
|--------|------|
| 单张图片 | ≤ 500 KB |
| 单个视频 | ≤ 5 MB |
| 整个主题包 | ≤ 10 MB |

**推荐做法：**
- 使用 WebP 格式图片（比 PNG/JPG 体积小很多）
- 使用 [TinyPNG](https://tinypng.com/) 等工具压缩图片
- 视频尽量使用较低的分辨率或帧率

### 6. 本地校验

提交 PR 前，请在本地运行校验确保通过：

```bash
npm install
npm run validate
```

或仅校验你的主题：

```bash
npm run validate:theme your-theme-name
```

### 7. 提交 PR

将你的分支推送到 fork 仓库，然后向本仓库的 `v1/source` 分支提交 Pull Request。

CI 会自动运行校验，请确保所有检查通过。

---

## 更新已有主题

1. 在对应主题的 config.json 中 **递增 version 版本号**
2. 进行修改
3. 本地校验通过后提交 PR

---

## 新增标签

如果现有标签不能满足需求，可以提交 PR 修改 `tags.json` 文件添加新标签，需要维护者审批。

---

## 常见问题

**Q: 预览图可以不用文件吗？**  
A: 可以。如果你的主题是纯色主题，`preview` 字段可以使用 CSS 颜色值，如 `"#000"`。

**Q: 为什么不能在 config.json 中设置 id？**  
A: 为了保证 ID 的全局唯一性和一致性，所有主题的 ID 由 `meta.json` 统一管理，在发布时自动合并。

**Q: 图片资源必须放在 imgs/ 目录下吗？**  
A: 不是必须的。你可以使用任意子目录名（如 `imgs/`、`assets/` 等），只要 `config.json` 中的 `preview` 路径与实际文件位置一致即可。推荐使用 `imgs/` 保持统一。
