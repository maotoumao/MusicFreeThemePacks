---
name: todo-tracker
description: Manage project TODO items in docs/TODO.md. Use when the user asks to add, complete, list, or update TODOs, or when finishing a task that should be recorded as a TODO for future work. Triggers on phrases like "记个todo", "加个TODO", "标记完成", "TODO列表", or any request to track pending work items.
---

# TODO Tracker

Read `docs/TODO.md` before every operation to get the current max number and section list.

## Add TODO

1. Read `docs/TODO.md`, parse the `当前最大编号：**T-N**` line to get N
2. New number = T-(N+1)
3. Determine which `## section` the TODO belongs to; create a new section if none fits
4. Append a row to that section's table: `| T-(N+1) | \`file/path\` | 说明 |`
5. Update the header line to `当前最大编号：**T-(N+1)**`
6. When adding multiple TODOs at once, increment sequentially

## Complete TODO

1. Find the row by `T-<number>`
2. Do NOT delete the row — only prepend `~~` strikethrough to 说明 or note completion
3. Keep the row for traceability

## Table Format

Every section uses a 3-column markdown table:

```
| 编号 | 位置 | 说明 |
|------|------|------|
```

- 编号: `T-<number>`
- 位置: backtick-wrapped file path, e.g. `` `src/infra/foo/bar.ts` ``
- 说明: concise description in Chinese
