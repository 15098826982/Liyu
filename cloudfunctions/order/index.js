// order 云函数：点菜模块
// actions: add | today | history | random | markDone
const cloud = require('wx-server-sdk');
// 必须先 init 再 require 公共模块（模块顶层会调用 cloud.database()，未初始化会抛错）
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const rateLimit = require('./rateLimit');
const authGuard = require('./authGuard');
const db = cloud.database();
const _ = db.command;

// 家庭级权限：点菜模块所有操作都需要已加入家庭
authGuard.init({ familyActions: ['add', 'batchAdd', 'today', 'history', 'random', 'markDone'] });

// 入口防刷配置：action 白名单 + 写操作限流阈值（同一 openid，分钟级）
rateLimit.init({
  actions: ['add', 'batchAdd', 'today', 'history', 'random', 'markDone'],
  limits: {
    add:      { windowMs: 60 * 1000, max: 20 }, // 点菜：1 分钟 20 次
    batchAdd: { windowMs: 60 * 1000, max: 10 }, // 批量点菜：1 分钟 10 次
    markDone: { windowMs: 60 * 1000, max: 30 }  // 改状态：1 分钟 30 次
  },
  rules: {
    add:      { dishId: 'string' },
    batchAdd: { dishIds: 'array' },
    markDone: { id: 'string' }
  }
});

function ok(data = {}, msg = 'success') {
  return { code: 0, msg, data };
}
function fail(msg = 'fail', code = -1) {
  return { code, msg };
}

// 判断是否为联合唯一索引冲突（familyId + orderDate + dishId）
function isDuplicateError(err) {
  if (!err) return false;
  if (err.errCode === -50202) return true;
  return String(err.errMsg || err.message || '').indexOf('Duplicate key') > -1;
}

async function getUserByOpenid(openid) {
  const r = await db.collection('users').where({ openid }).get();
  return r.data[0] || null;
}

// 云函数运行时区是 UTC，统一用 UTC+8 当天日期
function todayStr() {
  const d = new Date();
  const utc8 = new Date(d.getTime() + 8 * 3600 * 1000);
  return utc8.toISOString().slice(0, 10);
}

// 批量 join：根据 orders 数组返回带 dish/user 的列表
async function joinOrders(orders) {
  const dishIds = [...new Set(orders.map(o => o.dishId))];
  const userIds = [...new Set(orders.map(o => o.userId))];
  const dishMap = {}, userMap = {};
  if (dishIds.length) {
    const r = await db.collection('dishes').where({ _id: _.in(dishIds) }).get();
    r.data.forEach(d => dishMap[d._id] = d);
  }
  if (userIds.length) {
    const r = await db.collection('users').where({ _id: _.in(userIds) }).get();
    r.data.forEach(u => userMap[u._id] = u);
  }
  return orders.map(o => ({
    _id: o._id,
    orderDate: o.orderDate,
    status: o.status,
    dish: dishMap[o.dishId] ? {
      _id: dishMap[o.dishId]._id,
      name: dishMap[o.dishId].name,
      category: dishMap[o.dishId].category
    } : null,
    user: userMap[o.userId] ? {
      nickname: userMap[o.userId].nickname || '家人',
      avatar: userMap[o.userId].avatar
    } : null
  }));
}

// 错误日志：写入 error_logs 集合，不抛异常
async function logError(module, action, err, context) {
  try {
    await db.collection('error_logs').add({
      data: {
        module, action,
        message: err.message || String(err),
        stack: err.stack || '',
        context: context || {},
        createdAt: new Date()
      }
    });
  } catch (e) { /* 日志写不进去就算了 */ }
}

// 给家庭另一个成员推送订阅消息（失败不影响主流程）
async function notifyMate(user, dishName) {
  try {
    // 找同家庭另一个人
    const mates = await db.collection('users').where({
      familyId: user.familyId,
      _id: _.neq(user._id)
    }).get();
    if (mates.data.length === 0) return;
    const mateOpenid = mates.data[0].openid;
    // 订阅消息模板ID，需在微信公众平台申请后替换
    const TEMPLATE_ID = 'REPLACE_WITH_YOUR_TEMPLATE_ID';
    if (!TEMPLATE_ID || TEMPLATE_ID.startsWith('REPLACE')) return;
    await cloud.openapi.subscribeMessage.send({
      touser: mateOpenid,
      templateId: TEMPLATE_ID,
      page: 'pages/home/index',
      data: {
        thing1: { value: `${user.nickname || '家人'}点了${dishName}` },
        time2: { value: new Date().toLocaleString('zh-CN') }
      }
    });
  } catch (e) {
    await logError('order', 'notifyMate', e, { userId: user._id });
  }
}

// add：点一个菜
async function add(openid, { dishId }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!dishId) return fail('参数错误');
  let dRes;
  try {
    dRes = await db.collection('dishes').doc(dishId).get();
  } catch (e) {
    return fail('菜品不存在');
  }
  if (!dRes.data || dRes.data.familyId !== user.familyId) return fail('菜品无效');

  const orderDate = todayStr();
  const exist = await db.collection('orders').where({
    familyId: user.familyId, orderDate, dishId
  }).count();
  if (exist.total > 0) return fail('今天已经点过这道菜了');

  const now = new Date();
  let addRes;
  try {
    addRes = await db.collection('orders').add({
      data: {
        familyId: user.familyId,
        dishId,
        userId: user._id,
        orderDate,
        status: 'pending',
        createdAt: now
      }
    });
  } catch (e) {
    if (isDuplicateError(e)) return fail('今天已经点过这道菜了');
    await logError('order', 'add', e, { openid, dishId });
    return fail('下单失败，请重试');
  }
  // 异步推送通知，不阻塞返回
  notifyMate(user, dRes.data.name);
  return ok({ order: { _id: addRes._id, dishId, orderDate, status: 'pending' } });
}

// batchAdd：批量点菜
async function batchAdd(openid, { dishIds }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!Array.isArray(dishIds) || dishIds.length === 0) return fail('参数错误');
  const orderDate = todayStr();
  const added = [], skipped = [];
  for (const dishId of dishIds) {
    // 查重
    const exist = await db.collection('orders').where({
      familyId: user.familyId, orderDate, dishId
    }).count();
    if (exist.total > 0) { skipped.push(dishId); continue; }
    // 校验菜品
    let dRes;
    try {
      dRes = await db.collection('dishes').doc(dishId).get();
    } catch (e) { skipped.push(dishId); continue; }
    if (!dRes.data || dRes.data.familyId !== user.familyId) { skipped.push(dishId); continue; }
    // 写入（撞唯一索引则该道菜跳过，不中断整批）
    try {
      await db.collection('orders').add({
        data: {
          familyId: user.familyId,
          dishId,
          userId: user._id,
          orderDate,
          status: 'pending',
          createdAt: new Date()
        }
      });
    } catch (e) {
      if (isDuplicateError(e)) { skipped.push(dishId); continue; }
      await logError('order', 'batchAdd', e, { openid, dishId });
      skipped.push(dishId);
      continue;
    }
    added.push(dishId);
  }
  // 批量点菜后推送一次通知
  if (added.length > 0) {
    notifyMate(user, `${added.length}道菜`);
  }
  return ok({ added, skipped });
}

// today：今日菜单
async function today(openid) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  const orderDate = todayStr();
  const r = await db.collection('orders').where({
    familyId: user.familyId, orderDate
  }).orderBy('createdAt', 'asc').get();
  return ok({ orders: await joinOrders(r.data) });
}

// history：历史记录，分页
async function history(openid, { page = 1, limit = 20 } = {}) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (page - 1) * limit;
  const countRes = await db.collection('orders').where({ familyId: user.familyId }).count();
  const r = await db.collection('orders').where({ familyId: user.familyId })
    .orderBy('orderDate', 'desc')
    .orderBy('createdAt', 'asc')
    .skip(skip).limit(limit).get();
  return ok({
    total: countRes.total,
    orders: await joinOrders(r.data)
  });
}

// random：随机抽 3 道菜
async function random(openid) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  const allRes = await db.collection('dishes').where({
    familyId: user.familyId
  }).get();
  if (allRes.data.length < 3) {
    return fail('菜品不足：至少需要 3 道菜才能推荐');
  }
  function pick(arr, n) {
    const copy = [...arr];
    const result = [];
    for (let i = 0; i < n && copy.length > 0; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  }
  const dishes = pick(allRes.data, 3);
  return ok({
    dishes: dishes.map(d => ({
      _id: d._id, name: d.name, category: d.category, image: d.image || ''
    }))
  });
}

// markDone：标记完成/重置为待做
async function markDone(openid, { id, status }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!id) return fail('参数错误');
  if (status && !['pending', 'done'].includes(status)) return fail('状态错误');
  let oRes;
  try {
    oRes = await db.collection('orders').doc(id).get();
  } catch (e) {
    return fail('点菜记录不存在');
  }
  if (!oRes.data || oRes.data.familyId !== user.familyId) return fail('无权操作');
  const finalStatus = status || 'done';
  await db.collection('orders').doc(id).update({ data: { status: finalStatus } });
  return ok({ order: { ...oRes.data, status: finalStatus } });
}

exports.main = async (event, context) => {
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
      case 'add':       return await add(openid, event);
      case 'batchAdd':  return await batchAdd(openid, event);
      case 'today':    return await today(openid);
      case 'history':  return await history(openid, event);
      case 'random':   return await random(openid);
      case 'markDone': return await markDone(openid, event);
      default:         return fail(`unknown action: ${action}`);
    }
  } catch (e) {
    await logError('order', action, e, { openid });
    console.error(`[order.${action}] error:`, e);
    return fail(e.message || '服务器错误');
  }
};
