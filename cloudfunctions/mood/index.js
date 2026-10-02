// cloudfunctions/mood/index.js  心情打卡
const cloud = require('wx-server-sdk');
// 必须先 init 再 require 公共模块（模块顶层会调用 cloud.database()，未初始化会抛错）
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const rateLimit = require('./rateLimit');
const authGuard = require('./authGuard');
const db = cloud.database();
const _ = db.command;

// 家庭级权限：心情模块所有操作都需要已加入家庭
authGuard.init({ familyActions: ['add', 'today', 'list'] });

// 入口防刷配置：action 白名单 + 写操作限流阈值（同一 openid，分钟级）
rateLimit.init({
  actions: ['add', 'today', 'list'],
  limits: {
    add: { windowMs: 60 * 1000, max: 20 } // 记录心情：1 分钟 20 次
  },
  rules: {
    add: { mood: 'string' }
  }
});

function ok(data) { return { code: 0, msg: 'ok', data }; }
function fail(msg) { return { code: -1, msg, data: null }; }

async function getUserByOpenid(openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data[0] || null;
}

const VALID_MOODS = ['平静', '生气', '开心', '心动', '伤心', '疲惫'];

// 按北京时间(UTC+8)计算今天日期字符串，避免云函数 UTC 时区导致 0:00-8:00 跨天错位
function getTodayStr() {
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

// add：记录今日心情（同一天同角色只保留一条，覆盖）
// 按 familyId + role + date 去重，确保老婆和老公各一条，即使共用同一微信测试也不互相覆盖
async function add(openid, { mood, note }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!user.role) return fail('请先选择身份');
  if (!VALID_MOODS.includes(mood)) return fail('心情选项无效');

  const today = getTodayStr();
  const dateStr = today;

  // 查今天该角色是否已有记录（按 familyId + role 去重）
  const exist = await db.collection('moods').where({
    familyId: user.familyId,
    role: user.role,
    date: dateStr
  }).limit(1).get();

  const data = {
    familyId: user.familyId,
    openid,
    role: user.role,
    nickname: user.nickname || '',
    avatar: user.avatar || '',
    mood,
    note: note || '',
    date: dateStr,
    createdAt: db.serverDate()
  };

  if (exist.data.length > 0) {
    await db.collection('moods').doc(exist.data[0]._id).update({ data });
    return ok({ id: exist.data[0]._id, updated: true });
  } else {
    const r = await db.collection('moods').add({ data });
    return ok({ id: r._id, updated: false });
  }
}

// today：获取家庭今日两人的心情
async function today(openid) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');

  const today = getTodayStr();
  const dateStr = today;

  try {
    const res = await db.collection('moods').where({
      familyId: user.familyId,
      date: dateStr
    }).get();
    return ok({ moods: res.data });
  } catch (e) {
    // 集合不存在时返回空
    if (e.errCode === -502005 || (e.message && e.message.indexOf('not exist') > -1)) {
      return ok({ moods: [] });
    }
    throw e;
  }
}

// list：获取家庭最近 N 天的心情记录
async function list(openid, { days = 30 }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');

  try {
    const res = await db.collection('moods').where({
      familyId: user.familyId
    }).orderBy('date', 'desc').limit(days).get();
    return ok({ moods: res.data });
  } catch (e) {
    if (e.errCode === -502005 || (e.message && e.message.indexOf('not exist') > -1)) {
      return ok({ moods: [] });
    }
    throw e;
  }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action } = event;

  // 家庭级权限守卫：校验家庭成员身份 + 请求携带的 familyId 归属
  const permErr = await authGuard.guard(openid, action, event);
  if (permErr) return fail(permErr);

  // 入口守卫：action / 参数校验 + 写操作限流
  const blocked = await rateLimit.guard(openid, action, event);
  if (blocked) return fail(blocked);

  try {
    switch (action) {
      case 'add':   return await add(openid, event);
      case 'today': return await today(openid);
      case 'list':  return await list(openid, event);
      default:      return fail(`unknown action: ${action}`);
    }
  } catch (e) {
    console.error(`[mood.${action}] error:`, e);
    return fail(e.message || '服务器错误');
  }
};
