# 项目目录整理方案

## 整理原则

1. exe 必须保持在根目录（WebView2 要求）
2. 移动脚本不影响开发者工作流
3. 更新文档同步说明变更
4. 保持向后兼容

## 整理内容

### 1. 启动脚本迁移

**移动文件：**
```
根目录 → launch/
  - Start Studio.cmd
  - Start Portable.cmd
  - Stop Studio.cmd
```

**理由：**
- 减少根目录文件数量
- 分类管理启动相关脚本
- 便于未来添加其它启动方式

**影响：**
- 开发者：不影响（主要用 npm start）
- 桌面用户：主要双击 exe，很少用 cmd
- 文档：需更新 README 中的路径说明

### 2. .gitignore 补充

添加以下内容：
```
# Windows 系统临时目录
%SystemDrive%/

# 可能的其它系统缓存
Thumbs.db
desktop.ini
```

### 3. 根目录结构（整理后）

```
IMAGE_GEN/
├── Image Studio.exe          # 桌面版入口（必须在根目录）
├── Image_key.txt             # API 密钥（gitignore）
├── package.json              # 项目元数据
├── .gitignore                # Git 忽略规则
├── README.md                 # 项目说明
│
├── launch/                   # 【新建】启动脚本集合
│   ├── Start Studio.cmd
│   ├── Start Portable.cmd
│   └── Stop Studio.cmd
│
├── config/                   # 配置文件
│   └── studio.json
│
├── docs/                     # 文档群
│   ├── AGENTS.md            # Agent 工作入口（项目根也保留软链接）
│   ├── worknow.md           # 当前状态
│   ├── rules.md             # 规则和边界
│   ├── taskshot.md          # 任务快照
│   ├── handoff.md           # 交接说明
│   ├── architecture.md      # 架构文档
│   ├── api.md               # API 设计
│   ├── verification.md      # 验证记录
│   ├── features.md          # 【新建】功能说明
│   └── guide.md             # 【新建】使用指南
│
├── server/                   # 后端服务
│   ├── index.mjs            # 服务入口
│   ├── config.mjs
│   ├── jobs.mjs
│   ├── provider.mjs
│   └── lock.mjs
│
├── public/                   # 前端资源
│   ├── index.html
│   ├── app.js
│   └── styles.css
│
├── scripts/                  # 工具脚本
│   ├── check.mjs            # 项目检查
│   └── build.mjs            # 打包构建
│
├── test/                     # 测试文件
│   └── studio.test.mjs
│
├── .data/                    # 运行时数据（gitignore）
│   ├── jobs/                # 任务记录
│   ├── session              # 会话 token
│   └── studio.lock          # 互斥锁
│
└── outputs/                  # 生成图片（gitignore）
    └── YYYY-MM-DD/          # 按日期分类
```

### 4. 需要更新的文档

**README.md：**
- 启动方式：补充 `launch/` 路径
- 目录结构：更新说明

**docs/guide.md：**
- 不受影响（用户主要用 exe）

**docs/handoff.md：**
- 更新"如何运行"章节

## 执行步骤

1. 创建 `launch/` 目录
2. 移动三个 .cmd 文件
3. 更新 .gitignore
4. 更新 README.md
5. 更新 docs/handoff.md
6. 提交 Git：「目录整理：启动脚本迁移到 launch/」
7. 验证：测试 exe 启动正常、npm start 正常

## 验收标准

- [ ] launch/ 目录包含三个 cmd 脚本
- [ ] 根目录不再有 .cmd 文件
- [ ] Image Studio.exe 保持在根目录
- [ ] .gitignore 包含 %SystemDrive%/
- [ ] README 和 handoff.md 路径更新
- [ ] Git 提交干净，无遗留文件
- [ ] 双击 exe 启动正常
- [ ] npm start 启动正常
- [ ] 测试和检查全部通过
