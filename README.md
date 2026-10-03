# 情侣小窝 ovo · 微信小程序（云开发）

> 面向情侣双人场景、以「家庭」为核心的互动小程序：把两个人的点菜、心愿礼物、心情、打卡、经期记录整合在一个小窝里，双方数据实时共享。
> 后端基于**微信云开发**（云函数 Node.js + 云数据库 + 云存储），免备案、免 HTTPS、免运维。已独立完成设计、开发、提审并通过微信审核上架。

---

## 功能一览

| 模块 | 说明 |
| --- | --- |
| 家庭体系 | 创建小窝 / 邀请码加入、两人绑定、身份（老公 / 老婆）、退出家庭 |
| 点菜 | 家庭菜单、点菜、今日菜单、随机抽菜（选择困难救星）、历史记录、标记完成 |
| 心愿礼物清单 | 记录想要的礼物、对方可见，附购买链接 / 口令，避免"不知道送什么" |
| 心情记录 | 记录每日心情，双方可见 |
| 打卡 | 设定共同目标、每日打卡、连续打卡统计 |
| 经期记录 | 记录经期、备注，仅家庭内可见 |
| 相册 | 头像 / 背景 / 照片上传，自动压缩、内容安全校验、上传限流 |

---

## 技术栈

- 微信小程序原生（WXML / WXSS / JS）、Vant Weapp 组件库
- 微信云开发：云函数（Node.js）、云数据库（文档型）、云存储
- 云存储数据万象 **imageMogr2**：按场景动态生成 webp 缩略图
- 微信 **内容安全 API**（`imgSecCheck` / `msgSecCheck`）：图片 / 文字违规检测
- `wx.cloud` SDK、Git Credential Manager

---

## 项目结构

```
Liyu/
├── cloudfunctions/                 # 云函数（按模块聚合，event.action 分发）
│   ├── user/          登录 / 资料 / 角色 / 同步伴侣信息
│   ├── family/        创建 / 加入 / 详情 / 退出（幂等）
│   ├── dish/          菜品 增删改查
│   ├── order/         点菜 / 今日 / 历史 / 随机 / 完成
│   ├── checkin/       目标打卡
│   ├── memo/          备忘 / 公共记录
│   ├── mood/          心情记录
│   ├── period/        经期记录
│   ├── wish/          心愿礼物清单
│   ├── upload/        图片上传限流与记录
│   ├── imgSecCheck/   图片内容安全
│   ├── msgSecCheck/   文字内容安全
│   └── dedupeOrders/  历史订单去重
├── miniprogram/
│   ├── components/    nav-bar / page-bg / sidebar / top-bar
│   ├── pages/         home / meal / history / family / role / login / random
│   │                  checkin / memo / mood / period / wishlist / settings / agreement ...
│   ├── utils/         request / auth / cache(SWR) / img(缩略图) / upload / security ...
│   ├── images/        默认图、心情情绪图（webp）
│   └── app.js / app.json / app.wxss / sitemap.json
├── moodimage/                     # 情绪表情素材
├── project.config.json
├── LICENSE
└── README.md
```

> 说明：云函数内通用 `authGuard.js`（登录与家庭归属校验）、部分模块含 `rateLimit.js`（限流）。

---

## 快速开始（跑起来）

### 1. 替换为你自己的 AppID 和云环境
仓库里目前是**作者本人的** AppID / 环境 ID（客户端标识，非密钥），克隆后必须替换：

| 文件 | 字段 | 改成 |
| --- | --- | --- |
| `project.config.json` | `appid` | 你自己的小程序 AppID（公众平台 → 设置 → 开发设置） |
| `miniprogram/app.js` | `wx.cloud.init({ env })` | 你自己的云开发环境 ID |

### 2. 开通云开发
微信开发者工具打开项目 → 工具栏「云开发」→ 开通并创建环境，记下环境 ID 回填到 `app.js`。

### 3. 构建 npm（Vant 组件）
项目前端依赖 Vant Weapp：开发者工具菜单「工具 → 构建 npm」。（`miniprogram_npm` 构建产物不入库。）

### 4. 部署全部云函数
`cloudfunctions/` 下**每一个**文件夹右键 → 「上传并部署：云端安装依赖」。改动云函数后需重新部署，云函数不随代码版本自动上传。

### 5. 创建数据库集合与索引
按各云函数中 `db.collection('xxx')` 用到的名字创建集合，主要包括：
`users`、`families`、`dishes`、`orders`、`checkins`、`wishes`、`periods`、`error_logs`、`upload_logs` 等。

关键索引（控制台 → 集合 → 索引管理）：

| 集合 | 索引字段 | 唯一 |
| --- | --- | --- |
| `users` | `openid` | 是 |
| `families` | `familyCode` | 是 |
| `dishes` | `familyId + name` | 是 |
| `orders` | `familyId + orderDate + dishId` | 是 |

### 6. 配置隐私协议
公众平台 → 设置 → 用户隐私保护指引，声明 openid / 昵称 / 头像 / 相册 的用途，否则提审可能被打回。

### 7. 联调与提审
真机走一遍「创建 / 加入家庭 → 点菜 → 心愿 / 打卡 / 心情」完整流程 → 开发者工具「上传」填版本号 → 公众平台版本管理 → 真机回归该开发版本 → 提交审核 → 发布。

---

## 工程设计要点

- **并发安全与接口幂等**：点菜采用「归属校验 + 当日查重」，并对 `orders` 的 `familyId + orderDate + dishId` 建**联合唯一索引**兜底，捕获 Duplicate Key（`errCode -50202`）返回「今日已点过」友好提示——查重负责体验、索引负责正确性；家庭 `create / join` 接口幂等，重复调用或超时重进返回现有家庭，避免重复创建与前端状态错乱。
- **数据一致性与可观测性**：订单以 `dishId` 引用菜品而非冗余菜名，改名后云函数用 `_.in()` **批量 join**（非 N+1）实时查询，避免更新扩散；量级增长后可演进为「快照 + 对账」。结构化 `error_logs`（模块 / 动作 / 堆栈 / 上下文）支持按模块过滤，曾据此定位修复云函数 **UTC 时区跨天**问题。
- **首屏与图片性能**：真机首次进入约 2~3s，通过小程序 Network 面板（callFunction ≈ 2s）对比云函数日志（`Duration` 仅一百多 ms），定位主因为**云函数冷启动**叠加无缓存、图片偏大；随后做 **SWR 缓存优先 + 后台静默更新**、imageMogr2 按场景出 webp 缩略图 + 懒加载，整页图片体积显著下降；预热 / 预置并发需持续计费故不采用，首次冷启动以 loading 兜底。
- **上传治理**：图片上传前做限流（每日上限）、端上压缩，再经内容安全 API 检测，防止违规内容与账单被刷爆。

---

## License

[MIT](./LICENSE)
