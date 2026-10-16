#!/usr/bin/env node
/**
 * 纯 Node 实现的压测脚本 —— 不需要 wrk / ab / JMeter，Windows 上也能直接跑。
 *
 * 用法示例：
 *   node loadtest.mjs --url http://127.0.0.1:8080 --path /ping -c 20 -d 10
 *   node loadtest.mjs --url http://127.0.0.1:8080 --path /dish/list -c 50 -d 10 --token <JWT>
 *
 * 说明：
 *   - 采用「闭环压测」：c 个并发各自不断发请求，直到时间到。这测的是「给定并发下的容量」。
 *   - 会先 warmup 几秒再统计（JIT 预热 + 缓存预热），避免把冷启动算进结果。
 *   - 统计 P50/P90/P99，因为平均值会被少量慢请求拉平，P99 才是用户真正感受到的。
 */
import http from 'node:http';

function arg(name, def) {
  // 同时接受 --name 和 -name（PowerShell 传参习惯用单横线）
  const a = process.argv;
  for (const p of ['--' + name, '-' + name]) {
    const i = a.indexOf(p);
    if (i >= 0 && a[i + 1] !== undefined && !a[i + 1].startsWith('-')) return a[i + 1];
  }
  return def;
}

const BASE = arg('url', 'http://127.0.0.1:8080');
const PATH = arg('path', '/ping');
const METHOD = arg('method', 'GET');
const CONCURRENCY = Number(arg('c', 20));
const DURATION = Number(arg('d', 10));
const WARMUP = Number(arg('warmup', 3));
const TOKEN = arg('token', '');
const LOGIN_CODE = arg('code', '');
const LABEL = arg('label', PATH);
const BODY = arg('body', '');

const url = new URL(BASE);
const agent = new http.Agent({ keepAlive: true, maxSockets: CONCURRENCY * 2 });

function once(path, method, body, token) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;
    const req = http.request(
      { hostname: url.hostname, port: url.port || 80, path, method, agent, headers },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () =>
          resolve({
            ms: Number(process.hrtime.bigint() - start) / 1e6,
            status: res.statusCode,
            body: data
          })
        );
      }
    );
    req.on('error', () =>
      resolve({ ms: Number(process.hrtime.bigint() - start) / 1e6, status: 0, body: '', failed: true })
    );
    if (body) req.write(body);
    req.end();
  });
}

async function getToken(code) {
  const r = await once('/auth/login', 'POST', JSON.stringify({ code }), '');
  try {
    const json = JSON.parse(r.body);
    if (json.code === 0 && json.data && json.data.token) return json.data.token;
    throw new Error('登录失败: ' + r.body);
  } catch (e) {
    throw new Error('拿 token 失败: ' + r.body);
  }
}

async function phase(seconds, collect) {
  const deadline = Date.now() + seconds * 1000;
  const stats = { total: 0, failed: 0, http: new Map(), biz: new Map(), lat: [] };
  async function worker() {
    while (Date.now() < deadline) {
      const r = await once(PATH, METHOD, BODY, TOKEN);
      if (!collect) continue;
      stats.total++;
      if (r.failed) stats.failed++;
      stats.http.set(r.status, (stats.http.get(r.status) || 0) + 1);
      stats.lat.push(r.ms);
      try {
        const code = JSON.parse(r.body).code;
        if (code !== undefined) stats.biz.set(code, (stats.biz.get(code) || 0) + 1);
      } catch (e) {
        /* 非 JSON（比如 /ping 返回 ok）忽略 */
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return stats;
}

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

const main = async () => {
  let token = TOKEN;
  if (LOGIN_CODE) token = await getToken(LOGIN_CODE);

  await phase(WARMUP, false); // 预热，不计入结果
  const s = await phase(DURATION, true);

  s.lat.sort((a, b) => a - b);
  const sum = s.lat.reduce((a, b) => a + b, 0);
  const rps = (s.total / DURATION).toFixed(1);

  console.log('------------------------------------------------------------------');
  console.log('场景: ' + LABEL);
  console.log('  并发=' + CONCURRENCY + '  时长=' + DURATION + 's  路径=' + METHOD + ' ' + PATH);
  console.log('  总请求=' + s.total + '  失败(连接层)=' + s.failed + '  QPS=' + rps);
  console.log(
    '  延迟 ms: 平均=' + (sum / (s.total || 1)).toFixed(1) +
    '  P50=' + pct(s.lat, 50).toFixed(1) +
    '  P90=' + pct(s.lat, 90).toFixed(1) +
    '  P99=' + pct(s.lat, 99).toFixed(1) +
    '  最大=' + (s.lat[s.lat.length - 1] || 0).toFixed(1)
  );
  console.log('  HTTP 状态码: ' + [...s.http].map(([k, v]) => k + '×' + v).join(', '));
  if (s.biz.size) console.log('  业务码: ' + [...s.biz].map(([k, v]) => k + '×' + v).join(', '));
};

main();
