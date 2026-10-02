# 老婆点菜 微信小程序（v1.0 云开发版）

家庭互动小程序：老婆（一家之主）点菜、老公（管家）做饭。
后端用微信云开发，免备案 / 免 HTTPS / 免运维。

## 项目结构

```
wife-order/
├── cloudfunctions/              # 云函数（4 个，v1.0）
│   ├── user/      index.js + package.json   login/getInfo/updateProfile/setRole
│   ├── family/    index.js + package.json   create/join/getInfo/leave
│   ├── dish/      index.js + package.json   list/add/update/delete
│   └── order/     index.js + package.json   add/today/history/random/markDone
├── miniprogram/                 # 前端
│   ├── pages/
│   │   ├── home/index           # tabBar 首页（按 role 分支：boss 看今日菜单+去点菜；manager 看今日菜单+标记完成）
│   │   ├── dish/index           # tabBar 菜库（boss 点菜 / manager 增删）
│   │   ├── history/index        # tabBar 历史（分页 + 按日期分组）
│   │   ├── profile/index        # tabBar 我的（家庭信息 + 邀请码 + 退出家庭）
│   │   ├── login/login          # 登录
│   │   ├── family/create        # 创建家庭
│   │   ├── family/join          # 加入家庭
│   │   ├── role/select          # 选择身份
│   │   └── random/random        # 随机推荐（boss 从首页进入，非 tabBar）
│   ├── utils/
│   │   ├── request.js           # 封装 wx.cloud.callFunction，统一 loading + 错误 toast
│   │   └── auth.js              # 极简登录态（user 缓存 storage，onShow 校验未就绪 reLaunch）
│   ├── app.js / app.json / app.wxss / sitemap.json
├── project.config.json
├── 老婆点菜_开发说明书_云开发版.md
└── README.md
```

## 上线前必做步骤（按顺序）

### 1. 填占位值（两处）

| 文件 | 字段 | 值 |
| --- | --- | --- |
| `project.config.json` | `appid` | 你的小程序 AppID（微信公众平台 → 设置 → 开发设置） |
| `miniprogram/app.js` | `wx.cloud.init({ env })` | 把 `REPLACE_WITH_YOUR_ENV_ID` 改成你的云开发环境 ID |

> 两个值目前都是占位字符串 `REPLACE_WITH_YOUR_*`，直接搜索就能找到。

### 2. 开通云开发 + 部署 4 个云函数

1. 微信开发者工具打开本项目 → 点工具栏「云开发」→ 开通并创建环境，记下环境 ID（回填到 `app.js`）。
2. 左侧目录树 `cloudfunctions/` 下有 `user / family / dish / order` 四个文件夹。
3. 每个文件夹右键 → 「上传并部署：云端安装依赖」。（首次会有冷启动延迟，正常）

### 3. 云数据库建集合 + 索引

云开发控制台 → 数据库，新建以下 4 个集合（名字完全小写）：

- `users`
- `families`
- `dishes`
- `orders`

给每个集合加索引（控制台 → 集合 → 索引管理）：

| 集合 | 索引字段 | 是否唯一 |
| --- | --- | --- |
| `users` | `openid` | 唯一 |
| `families` | `familyCode` | 唯一 |
| `dishes` | `{familyId:1, name:1}` 复合 | 唯一 |
| `orders` | `{familyId:1, orderDate:-1}` 复合 | 否 |
| `orders` | `{familyId:1, orderDate:1, dishId:1}` 复合 | 唯一 |

> 唯一索引不是强制的——云函数里都做了查重兜底。但建了能防止并发漏判，建议都建。

### 4. 隐私协议填写

微信公众平台 → 设置 → 用户隐私保护指引，声明收集 openid / 昵称 / 头像 的用途（用于登录和家庭内互动）。

### 5. 联调测试（开发者工具里走一遍完整流程）

1. 用 A 账号登录 → 创建家庭 → 选「管家」身份 → 菜库 tab 添加几道荤菜和素菜
2. 用 B 账号登录 → 加入家庭（输入 A 的邀请码）→ 选「一家之主」身份 → 菜库 tab 点菜 / 随机推荐
3. A 账号首页 → 今日菜单 → 标记完成
4. 历史 tab 看记录是否按日期分组展示

### 6. 提交审核

代码写完、测试通过后，开发者工具点「上传」→ 微信公众平台 → 版本管理 → 提交审核（1~3 天）。

## 设计要点（给后面接手的人）

- **tabBar 不能按角色动态切换**（微信限制），所以 4 个 tab（首页/菜库/历史/我的）两个角色共用，页内 `wx:if` 按 `user.role` 分支显示。
- **鉴权**：云函数内 `cloud.getWXContext().OPENID` 自动取身份，前端无 token；`utils/auth.js` 只缓存 user 对象，onShow 校验 familyId/role 是否完整，缺失就 reLaunch 到对应流程页。
- **云函数按模块聚合**：每个云函数用 `event.action` 分发，统一返回 `{code:0, msg, data}`，`code!==0` 时 `request.js` 已自动弹 toast。
- **日期**：云函数运行时区是 UTC，`order/index.js` 的 `todayStr()` 统一用 UTC+8 当天。
- **防重**：云数据库无联合唯一约束，所有查重在云函数里做（同家庭菜名、同家庭同天同菜）。
- **颜色**：主色 `#ff6b6b`，荤菜标签红底、素菜标签绿底，不使用 emoji。

## v2.0 节点提醒（后续再加）

- 愿望池（wishes 集合）
- 月经记录（periods 集合，`note` 字段加密存储）
- 纪念日（anniversaries 集合）
- 社区论坛（posts 集合）—— **必须先升级企业主体 + UGC 内容审核**（`security.msgSecCheck` 文字 / `security.imgSecCheck` 图片）
