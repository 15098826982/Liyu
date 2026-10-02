// rateLimit.js  用户级限流 + 防刷 + 入口参数校验（本文件在每个云函数目录下各存一份，内容一致）
// 用法：
//   const rateLimit = require('./rateLimit');
//   rateLimit.init({
//     actions: ['add', 'list'],
//     limits: { add: { windowMs: 60000, max: 20 } },
//     rules:  { add: { title: 'string' } }
//   });
//   // 入口：
//   const err = await rateLimit.guard(openid, action, event);
//   if (err) return fail(err);
const cloud = require('wx-server-sdk');
const db = cloud.database();
const _ = db.command;

const COLLECTION = 'rate_limit_logs'; // 记录每次写调用：openid / action / familyId / createdAt
const KEEP_DAYS = 7;                  // 只保留最近 7 天记录
const DEFAULT_WINDOW_MS = 60 * 1000;  // 默认窗口：1 分钟
const DEFAULT_MAX = 20;               // 默认窗口内最多 20 次
const CLEAN_INTERVAL_MS = 6 * 3600 * 1000; // 清理频率：每个容器 6 小时最多清一次

let config = { actions: [], limits: {}, rules: {} };
let collectionEnsured = false;
let lastCleanAt = 0;

// 配置本函数的 action 白名单、限流阈值、必填参数规则
function init(opts = {}) {
  config = {
    actions: opts.actions || [],
    limits: opts.limits || {},
    rules: opts.rules || {}
  };
}

// 确保集合存在（云函数侧自动创建，无需去控制台手动建）
async function ensureCollection() {
  if (collectionEnsured) return;
  try {
    await db.createCollection(COLLECTION);
  } catch (e) {
    // 已存在或并发创建等情况忽略
  }
  collectionEnsured = true;
}

// 顺带清理过期数据；失败不影响主流程
function cleanExpired() {
  const now = Date.now();
  if (now - lastCleanAt < CLEAN_INTERVAL_MS) return;
  lastCleanAt = now;
  try {
    const before = new Date(now - KEEP_DAYS * 24 * 3600 * 1000);
    db.collection(COLLECTION).where({ createdAt: _.lt(before) }).remove().catch(() => {});
  } catch (e) {}
}

/**
 * 限流检查：统计该 openid 最近 windowMs 内该 action 的次数，超限返回 false
 * 未超限则记录本次调用；任何异常一律放行，避免影响主流程
 * @param {string} openid
 * @param {string} action
 * @param {object} opts { windowMs, max, familyId }
 * @returns {Promise<boolean>} true=允许，false=超限
 */
async function check(openid, action, opts = {}) {
  if (!openid || !action) return true;
  const windowMs = opts.windowMs || DEFAULT_WINDOW_MS;
  const max = opts.max || DEFAULT_MAX;

  await ensureCollection();

  try {
    const since = new Date(Date.now() - windowMs);
    const r = await db.collection(COLLECTION)
      .where({ openid, action, createdAt: _.gte(since) })
      .count();
    if (r.total >= max) return false;
  } catch (e) {
    return true; // 统计失败不拦
  }

  try {
    await db.collection(COLLECTION).add({
      data: {
        openid,
        action,
        familyId: opts.familyId || '',
        createdAt: new Date()
      }
    });
  } catch (e) {}

  cleanExpired();
  return true;
}

// 必填参数校验：返回错误提示，通过返回 ''
function validate(action, event = {}) {
  const rule = config.rules[action];
  if (!rule) return '';
  for (const key of Object.keys(rule)) {
    const type = rule[key];
    const v = event[key];
    if (type === 'array') {
      if (!Array.isArray(v) || v.length === 0) return '参数错误';
    } else if (typeof v !== type || !String(v).trim()) {
      return '参数错误';
    }
  }
  return '';
}

/**
 * 入口统一守卫：先校验 action 和必填参数，再对写操作限流
 * @returns {Promise<string>} '' 表示通过；否则为错误提示（直接 fail 返回给前端）
 */
async function guard(openid, action, event = {}) {
  if (!config.actions.includes(action)) return `unknown action: ${action}`;

  const invalid = validate(action, event);
  if (invalid) return invalid;

  const limit = config.limits[action];
  if (!limit) return '';

  try {
    const allowed = await check(openid, action, limit);
    if (!allowed) return '操作过于频繁，请稍后再试';
  } catch (e) {
    return ''; // 限流异常不阻塞业务
  }
  return '';
}

module.exports = { init, check, guard, validate, cleanExpired };
