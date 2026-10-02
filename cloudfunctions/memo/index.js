// cloudfunctions/memo/index.js  共同备忘录
const cloud = require('wx-server-sdk');
// 必须先 init 再 require 公共模块（模块顶层会调用 cloud.database()，未初始化会抛错）
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const rateLimit = require('./rateLimit');
const authGuard = require('./authGuard');
const db = cloud.database();

// 家庭级权限：备忘录模块所有操作都需要已加入家庭
authGuard.init({ familyActions: ['add', 'list', 'update', 'toggle', 'delete'] });

// 入口防刷配置：action 白名单 + 写操作限流阈值（同一 openid，分钟级）
rateLimit.init({
  actions: ['add', 'list', 'update', 'toggle', 'delete'],
  limits: {
    add:    { windowMs: 60 * 1000, max: 20 }, // 新建备忘：1 分钟 20 次
    update: { windowMs: 60 * 1000, max: 20 }, // 编辑备忘：1 分钟 20 次
    delete: { windowMs: 60 * 1000, max: 20 }, // 删除备忘：1 分钟 20 次
    toggle: { windowMs: 60 * 1000, max: 30 }  // 切换完成：1 分钟 30 次
  },
  rules: {
    add:    { content: 'string' },
    update: { id: 'string' },
    toggle: { id: 'string' },
    delete: { id: 'string' }
  }
});

function ok(data) { return { code: 0, msg: 'ok', data }; }
function fail(msg) { return { code: -1, msg, data: null }; }

async function getUserByOpenid(openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data[0] || null;
}

const VALID_COLOR = ['yellow', 'pink', 'blue', 'green'];
const VALID_CATEGORY = ['生活', '购物', '旅行', '工作', '其他'];

// add：创建备忘录（家庭共享）
async function add(openid, { title, content, color, category, isTodo, isCompleted }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!content || !content.trim()) return fail('请填写备忘内容');

  let c = VALID_COLOR.includes(color) ? color : 'yellow';
  let cat = VALID_CATEGORY.includes(category) ? category : '其他';

  const data = {
    familyId: user.familyId,
    openid,
    creatorRole: user.role,
    creatorName: user.nickname || '',
    title: (title || '').trim(),
    content: content.trim(),
    color: c,
    category: cat,
    isTodo: !!isTodo,
    isCompleted: !!isCompleted,
    isTop: false,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  };

  try {
    const r = await db.collection('memos').add({ data });
    return ok({ id: r._id });
  } catch (e) {
    if (e.errCode === -502005 || (e.message && e.message.indexOf('not exist') > -1)) {
      const r = await db.collection('memos').add({ data });
      return ok({ id: r._id });
    }
    throw e;
  }
}

// list：家庭所有备忘录（两人都能看），置顶在前、再按 createdAt desc
async function list(openid) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  try {
    const res = await db.collection('memos').where({
      familyId: user.familyId
    }).orderBy('isTop', 'desc').orderBy('createdAt', 'desc').limit(100).get();
    return ok({ memos: res.data });
  } catch (e) {
    if (e.errCode === -502005 || (e.message && e.message.indexOf('not exist') > -1)) {
      return ok({ memos: [] });
    }
    throw e;
  }
}

// update：编辑备忘录（两人都能改）
async function update(openid, { id, title, content, color, category, isTodo, isCompleted }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!id) return fail('缺少备忘录ID');

  const memoRes = await db.collection('memos').doc(id).get();
  const memo = memoRes.data;
  if (!memo) return fail('备忘录不存在');
  if (memo.familyId !== user.familyId) return fail('无权操作');

  const data = { updatedAt: db.serverDate() };
  if (title !== undefined) data.title = (title || '').trim();
  if (content !== undefined) {
    if (!content || !content.trim()) return fail('内容不能为空');
    data.content = content.trim();
  }
  if (color !== undefined) {
    if (!VALID_COLOR.includes(color)) return fail('颜色无效');
    data.color = color;
  }
  if (category !== undefined) {
    if (!VALID_CATEGORY.includes(category)) return fail('分类无效');
    data.category = category;
  }
  if (isTodo !== undefined) data.isTodo = !!isTodo;
  if (isCompleted !== undefined) data.isCompleted = !!isCompleted;

  await db.collection('memos').doc(id).update({ data });
  return ok({ updated: true });
}

// toggle：标记完成/取消完成
async function toggle(openid, { id }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!id) return fail('缺少备忘录ID');

  const memoRes = await db.collection('memos').doc(id).get();
  const memo = memoRes.data;
  if (!memo) return fail('备忘录不存在');
  if (memo.familyId !== user.familyId) return fail('无权操作');

  const next = !memo.isCompleted;
  await db.collection('memos').doc(id).update({
    data: { isCompleted: next, updatedAt: db.serverDate() }
  });
  return ok({ isCompleted: next });
}

// delete：删除备忘录（两人都能删）
async function del(openid, { id }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!id) return fail('缺少备忘录ID');

  const memoRes = await db.collection('memos').doc(id).get();
  const memo = memoRes.data;
  if (!memo) return fail('备忘录不存在');
  if (memo.familyId !== user.familyId) return fail('无权操作');

  await db.collection('memos').doc(id).remove();
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
      case 'toggle': return await toggle(openid, event);
      case 'delete': return await del(openid, event);
      default:       return fail(`unknown action: ${action}`);
    }
  } catch (e) {
    console.error(`[memo.${action}] error:`, e);
    return fail(e.message || '服务器错误');
  }
};
