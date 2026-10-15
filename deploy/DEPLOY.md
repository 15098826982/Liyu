# 部署手册（阿里云轻量 2 核 2G 单机）

> 目标：一台机器上跑通「Nginx(443) → Spring Boot(8080) → MySQL/Redis」，并且让微信小程序真机能合法调用这个 HTTPS 域名。

## 0. 上线前必须搞清的一条硬规则

微信小程序**真机**请求有两条硬约束，跟后端代码写得对不对无关：

1. 必须走 **HTTPS**，且证书链完整（自签证书不行）；
2. 域名必须 **ICP 备案**，并在**公众平台 → 开发管理 → 服务器域名 → request 合法域名**里登记。
   域名没备案/没登记时，开发者工具可以靠 `urlCheck: false` 绕过，**真机一定失败**。

因此顺序是：**买域名 → 备案（7~20 天，不可控）→ 配 HTTPS → 登记合法域名 → 切前端地址**。
备案期间后端可以先部署好、用 curl 验证，但小程序端不要切过去（现在线上跑的是云开发版）。

## 1. 服务器准备

```bash
# 建独立用户，不用 root 跑服务
sudo useradd -r -m -d /opt/couple-nest -s /usr/sbin/nologin couplenest
sudo mkdir -p /opt/couple-nest && sudo chown -R couplenest:couplenest /opt/couple-nest

# 基础软件
sudo apt update && sudo apt install -y openjdk-17-jre-headless mysql-server redis-server nginx
sudo mysql_secure_installation
# Redis 只监听本机（公网暴露的 Redis 是挖矿重灾区）
sudo sed -i "s/^bind .*/bind 127.0.0.1 -::1/" /etc/redis/redis.conf
```

安全组只放行 **22 / 80 / 443**；**不要**放行 8080、3306、6379。

## 2. 数据库初始化

```bash
mysql -u root -p < server/src/main/resources/db/schema.sql
```

## 3. 打 jar 并上传

```bash
# 本地（Windows）
cd server && mvn -DskipTests clean package
scp target/couple-nest-server-0.0.1-SNAPSHOT.jar root@服务器IP:/opt/couple-nest/
```

## 4. 写入环境变量（唯一的密钥来源）

```bash
sudo cp deploy/systemd/couple-nest.env.example /opt/couple-nest/couple-nest.env
sudo chmod 600 /opt/couple-nest/couple-nest.env
sudo chown couplenest:couplenest /opt/couple-nest/couple-nest.env
openssl rand -base64 48        # 生成 JWT 密钥（至少 32 字节）后填进 JWT_SECRET
sudo vim /opt/couple-nest/couple-nest.env
```

> application.yml 里没有任何真实密钥：JWT_SECRET / MYSQL_PASSWORD / OSS_* 全部走环境变量占位符。
> JWT_SECRET 缺失或短于 32 字节时应用会**启动失败**——这是故意的，避免弱密钥上线。

## 5. systemd 守护

```bash
sudo cp deploy/systemd/couple-nest.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now couple-nest
systemctl status couple-nest
journalctl -u couple-nest -f      # 访问日志 / 慢请求 WARN / 异常堆栈都在这里
```

## 6. Nginx + HTTPS

```bash
sudo cp deploy/nginx/couple-nest.conf /etc/nginx/conf.d/
sudo vim /etc/nginx/conf.d/couple-nest.conf      # 先把 server_name 改成你的域名
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.example.com
sudo systemctl enable --now certbot.timer        # 自动续期
```

反代配置里的 `proxy_set_header X-Forwarded-For $remote_addr;`（**覆盖**而非追加）是登录限流取到真实客户端 IP 的前提，
详见 `deploy/nginx/couple-nest.conf` 顶部注释。

## 7. 自测清单

```bash
curl -s https://api.example.com/ping            # {"code":0,"msg":"ok"}
curl -s http://127.0.0.1:8080/ping              # 服务器上直连，验证服务本身
curl -s -X POST https://api.example.com/auth/login -H "Content-Type: application/json" -d "{\"code\":\"test\"}"
ss -lntp | grep -E "8080|3306|6379"             # 确认这些端口只监听 127.0.0.1
```

**上线前必须复查的两件事：**

1. `WECHAT_MOCK=false` 且 `WECHAT_APPID` / `WECHAT_SECRET` 已填真实值。
   否则 `openid = "mock_openid_" + code`，而每次 `wx.login()` 的 code 都不同 → **每次登录都会新建一个用户**，家庭和数据全部丢失。
2. `JWT_SECRET` 已通过环境变量注入（`systemctl show couple-nest -p EnvironmentFile` 确认路径，再确认文件里已填值）。
   轮换密钥会让所有已登录用户掉线，这是预期行为。

## 8. 切换小程序端

改 `miniprogram/utils/request.js` 顶部的 `API_HOSTS`（release / trial 指向你的 https 域名），
到公众平台登记 request 合法域名，然后上传体验版、真机回归「登录 → 创建/加入家庭 → 点菜」主链路。
