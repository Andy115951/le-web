# Quadrant Todo Plan

## 1. 项目定位

`quadrant-todo` 是一个基于四象限方法的轻量 Todo 工具，目标是帮助用户把日常事项按优先级拆开，而不是堆成一团。

核心方向不是做复杂团队协作平台，而是先把下面三件事做好：

- 启动快，打开就能用
- 主看板上就能完成高频操作
- 后续可以平滑扩展成可分享的小产品

## 2. 当前状态总览

### 当前版本阶段

当前已经完成 **V1 可用版**，项目不是纯骨架，已经具备可注册、可登录、可新增任务、可编辑任务、可删除任务、可切换状态与象限的完整基础链路。

### 当前部署状态

- 已接通 `Vercel`
- 已接通 `Supabase`
- 已完成线上部署
- 已完成真实联调

### 当前主流程可用性

当前主流程已经可用：

- 用户注册
- 用户登录
- 用户登出
- 创建任务
- 编辑任务
- 删除任务
- 切换任务状态
- 切换任务象限

### 当前主要缺口

当前最大的缺口不是“能不能用”，而是“是否足够顺手”。

主要还缺：

- 主看板上的更快完成路径
- 更完整的易用性优化
- 截止日期与逾期反馈
- 搜索 / 筛选 / 排序
- 更强的设置与账号管理能力

## 3. 开发进度

### V1 已完成

#### 目标

完成一个可上线、可注册、可创建任务的四象限 Todo MVP。

#### 功能点

- 自定义账号体系
  - `username + password`
  - 注册 / 登录 / 登出
  - `httpOnly` session cookie
  - 基础限流
- Supabase 数据表
  - `todo_users`
  - `todo_sessions`
  - `quadrant_tasks`
- Vercel 部署与环境变量配置
- 四象限任务主流程
  - 新增任务
  - 编辑任务
  - 删除任务
  - 状态切换
  - 象限切换
- 基础概览信息
  - 总任务数
  - 进行中数量
  - 已完成数量
  - `Q2` 长期任务数量
- 线上真实联调已通过
  - 注册成功
  - 登录成功
  - 创建任务成功

### V2.1 当前执行范围

#### 目标

聚焦“提高易用性”，先实现主看板上的快速完成路径，让用户更少依赖详情页。

#### 功能点

- 任务左侧增加 `[]` 勾选框
- 勾选框行为定义为：`todo <-> done` 直接切换
- `doing` 不走勾选逻辑
- 完成后原地保留，用删除线和弱化样式展示
- 主卡片移除“完成”按钮，改由勾选框承担主完成入口
- 后续再考虑是否扩展到 `doing -> done`

#### 重点 Usability Case

**Case 1：快速完成任务**

- 问题：当前完成任务主要依赖按钮或进入编辑层，完成路径偏长
- 方案：任务左侧增加复选框
- 状态切换：`todo <-> done`
- 目标：把“完成一项任务”的操作降到 1 次点击

### V2.2 后续候选

#### 目标

在主流程稳定后，继续补齐更强的任务管理能力和产品化基础。

#### 候选功能点

- 截止日期 `due_at`
- 逾期高亮
- 搜索 / 筛选 / 排序
- 今日聚焦
- 更完整的进度概览
- 设置页 / 账号完善
- 修改密码
- 退出其他设备

## 4. 易用性优化方向

这一节专门记录“提高易用性”的具体使用场景，而不是只写抽象功能名。

### Case 1：快速完成任务

- 场景：用户在主看板看到一条任务后，希望不进入详情页，直接把它完成
- 当前问题：完成路径还不够短
- 计划方案：任务左侧增加 `[]` 勾选框
- 行为定义：点击后在 `todo` 和 `done` 之间切换
- 设计目标：把最常见的“完成任务”操作变成单击完成

### 后续可扩展 Case

- Case 2：快速切换象限
- Case 3：快速找到今天要做的任务
- Case 4：快速识别哪些任务卡住了

## 5. 技术路线

项目作为 `le-web` 下的独立子项目存在，继续复用现有部署与数据库体系。

- 前端：单页 Web 应用
- 部署：Vercel
- 数据库：Supabase
- 认证：自定义 `username + password`
- 服务端：Vercel Functions 负责登录、登出、session 校验与任务接口

## 6. 当前技术实现

### 认证方案

- 不使用 Supabase Auth 作为第一版主登录流程
- 用户通过 `username + password` 注册与登录
- 密码使用哈希存储
- 服务端签发 `httpOnly` session cookie
- 任务数据不走前端直连 Supabase

### 当前数据模型

#### `todo_users`

- `id`
- `username`
- `password_hash`
- `display_name`
- `email`
- `email_verified`
- `created_at`
- `updated_at`

#### `todo_sessions`

- `id`
- `user_id`
- `session_token_hash`
- `expires_at`
- `created_at`
- `last_seen_at`
- `user_agent`
- `ip`

#### `quadrant_tasks`

- `id`
- `user_id`
- `title`
- `description`
- `quadrant`
- `status`
- `sort_order`
- `created_at`
- `updated_at`
- `completed_at`

#### 当前枚举

- `quadrant`: `q1 | q2 | q3 | q4`
- `status`: `todo | doing | done | archived`

## 7. 当前 API

### 认证

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### 任务

- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`

## 8. 当前边界与原则

### 当前优先级

先把单人 / 轻量多用户使用体验做顺，再逐步补更完整的产品化能力。

### 暂不优先

- 重团队协作
- 邮箱找回密码
- 第三方 OAuth
- 复杂通知系统

### 版本推进原则

- 先保证主流程可用
- 再提高主看板易用性
- 最后补账号体系完善和更重的扩展能力
