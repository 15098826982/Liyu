// cloudfunctions/wish/index.js  心愿清单
const cloud = require('wx-server-sdk');
// 必须先 init 再 require 公共模块（模块顶层会调用 cloud.database()，未初始化会抛错）
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const rateLimit = require('./rateLimit');
const authGuard = require('./authGuard');
const db = cloud.database();

// 家庭级权限：心愿清单所有操作都需要已加入家庭
authGuard.init({ familyActions: ['add', 'list', 'update', 'delete'] });

// 入口防刷配置：action 白名单 + 写操作限流阈值（同一 openid，分钟级）
rateLimit.init({
  actions: ['add', 'list', 'update', 'delete'],
  limits: {
    add:    { windowMs: 60 * 1000, max: 20 }, // 新建心愿：1 分钟 20 次
    update: { windowMs: 60 * 1000, max: 20 }, // 编辑心愿：1 分钟 20 次
    delete: { windowMs: 60 * 1000, max: 20 }  // 删除心愿：1 分钟 20 次
  },
  rules: {
    add:    { title: 'string' },
    update: { id: 'string' },
    delete: { id: 'string' }
  }
});

function ok(data) { return { code: 0, msg: 'ok', data }; }
function fail(msg) { return { code: -1, msg, data: null }; }

async function getUserByOpenid(openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data[0] || null;
}

const VALID_STATUS = ['待实现', '已收到'];
const VALID_TYPE = ['老婆的', '老公的', '共同的'];
const MAX_LINK = 500;

// add：创建心愿（家庭共享，两人都能创建）
async function add(openid, { title, description, budget, image, status, type, link }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!title) return fail('请填写心愿名称');

  // 链接（选填）：商品链接或口令
  const lk = String(link || '').trim();
  if (lk.length > MAX_LINK) return fail('链接过长');

  // 类型默认按添加人：老婆=boss→老婆的，老公=manager→老公的
  let t = type;
  if (!VALID_TYPE.includes(t)) {
    t = user.role === 'boss' ? '老婆的' : '老公的';
  }

  let st = VALID_STATUS.includes(status) ? status : '待实现';
  let bud = 0;
  if (budget !== undefined && budget !== '' && budget !== null) {
    bud = Number(budget);
    if (isNaN(bud) || bud < 0) return fail('预算需为非负数字');
    bud = Math.round(bud * 100) / 100;
  }

  const data = {
    familyId: user.familyId,
    openid,
    creatorRole: user.role,
    creatorName: user.nickname || '',
    title,
    description: description || '',
    budget: bud,
    image: image || '🎁',
    status: st,
    type: t,
    link: lk,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  };

  try {
    const r = await db.collection('wishes').add({ data });
    return ok({ id: r._id });
  } catch (e) {
    if (e.errCode === -502005 || (e.message && e.message.indexOf('not exist') > -1)) {
      const r = await db.collection('wishes').add({ data });
      return ok({ id: r._id });
    }
    throw e;
  }
}

// list：家庭所有心愿（两人都能看），按 createdAt desc
async function list(openid) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  try {
    const res = await db.collection('wishes').where({
      familyId: user.familyId
    }).orderBy('createdAt', 'desc').limit(100).get();
    return ok({ wishes: res.data });
  } catch (e) {
    if (e.errCode === -502005 || (e.message && e.message.indexOf('not exist') > -1)) {
      return ok({ wishes: [] });
    }
    throw e;
  }
}

// update：编辑心愿（含切换状态，两人都能改）
async function update(openid, { id, title, description, budget, image, status, type, link }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!id) return fail('缺少心愿ID');

  const wishRes = await db.collection('wishes').doc(id).get();
  const wish = wishRes.data;
  if (!wish) return fail('心愿不存在');
  if (wish.familyId !== user.familyId) return fail('无权操作');

  const data = { updatedAt: db.serverDate() };
  if (title !== undefined) {
    if (!title) return fail('心愿名称不能为空');
    data.title = title;
  }
  if (description !== undefined) data.description = description;
  if (image !== undefined) data.image = image;
  if (status !== undefined) {
    if (!VALID_STATUS.includes(status)) return fail('状态无效');
    data.status = status;
  }
  if (type !== undefined) {
    if (!VALID_TYPE.includes(type)) return fail('类型无效');
    data.type = type;
  }
  if (link !== undefined) {
    const lk = String(link || '').trim();
    if (lk.length > MAX_LINK) return fail('链接过长');
    data.link = lk;
  }
  if (budget !== undefined) {
    let bud = 0;
    if (budget !== '' && budget !== null) {
      bud = Number(budget);
      if (isNaN(bud) || bud < 0) return fail('预算需为非负数字');
      bud = Math.round(bud * 100) / 100;
    }
    data.budget = bud;
  }

  await db.collection('wishes').doc(id).update({ data });
  return ok({ updated: true });
}

// delete：删除心愿（两人都能删）
async function del(openid, { id }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!id) return fail('缺少心愿ID');

  const wishRes = await db.collection('wishes').doc(id).get();
  const wish = wishRes.data;
  if (!wish) return fail('心愿不存在');
  if (wish.familyId !== user.familyId) return fail('无权操作');

  await db.collection('wishes').doc(id).remove();
  return ok({ deleted: true });
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
      case 'add':    return await add(openid, event);
      case 'list':   return await list(openid);
      case 'update': return await update(openid, event);
      case 'delete': return await del(openid, event);
      default:       return fail(`unknown action: ${action}`);
    }
  } catch (e) {
    console.error(`[wish.${action}] error:`, e);
    return fail(e.message || '服务器错误');
  }
};
