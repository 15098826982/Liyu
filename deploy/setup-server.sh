#!/bin/bash
set -e

# ============================================
# 一键部署脚本：配环境变量 + 重启
# 用法：把新 AK/SK 填到下面两个引号里，然后 bash setup.sh
# ============================================

# 👇 填这里（换成你刚创建的 RAM 用户 AccessKey）
NEW_AK="填你的新AccessKeyID"
NEW_SK="填你的新AccessKeySecret"
# 👆 填这里

echo "===== 1. 生成 JWT_SECRET ====="
JWT_SECRET=$(openssl rand -hex 32)
echo "JWT_SECRET = $JWT_SECRET"

echo "===== 2. 创建 /root/couple-nest.env ====="
cat > /root/couple-nest.env <<EOF
OSS_ACCESS_KEY_ID=$NEW_AK
OSS_ACCESS_KEY_SECRET=$NEW_SK
JWT_SECRET=$JWT_SECRET
WECHAT_MOCK=true
EOF
chmod 600 /root/couple-nest.env
echo "完成（权限设为 600，只有 root 能读）"

echo "===== 3. 修改 systemd service ====="
if ! grep -q "EnvironmentFile" /etc/systemd/system/couple-nest.service; then
    sed -i '/WorkingDirectory=\/root/a EnvironmentFile=/root/couple-nest.env' /etc/systemd/system/couple-nest.service
    echo "已加入 EnvironmentFile=/root/couple-nest.env"
else
    echo "service 文件已有 EnvironmentFile，跳过"
fi

echo "===== 4. 确认新 jar 在 /root/ ====="
ls -lh /root/couple-nest-server-0.0.1-SNAPSHOT.jar

echo "===== 5. 重载 + 重启 ====="
systemctl daemon-reload
systemctl restart couple-nest
sleep 4

echo "===== 6. 服务状态 ====="
systemctl status couple-nest --no-pager | head -12

echo ""
echo "===== 7. 最近日志（看有没有报错） ====="
journalctl -u couple-nest -n 20 --no-pager

echo ""
echo "===== 完成 ====="
echo "如果看到 'Started CoupleNestApplication' 且没有红色 ERROR，就成功了"
