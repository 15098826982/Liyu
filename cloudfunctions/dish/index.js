// dish 云函数：菜品模块
// actions: list | add | update | delete
const cloud = require('wx-server-sdk');
// 必须先 init 再 require 公共模块（模块顶层会调用 cloud.database()，未初始化会抛错）
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const authGuard = require('./authGuard');
const db = cloud.database();

// 家庭级权限：菜品模块所有操作都需要已加入家庭
authGuard.init({ familyActions: ['list', 'add', 'update', 'delete', 'renameCategory', 'clearCategory'] });

function ok(data = {}, msg = 'success') {
  return { code: 0, msg, data };
}
function fail(msg = 'fail', code = -1) {
  return { code, msg };
}

async function getUserByOpenid(openid) {
  const r = await db.collection('users').where({ openid }).get();
  return r.data[0] || null;
}

// list：当前家庭菜品，可按 category 筛选
async function list(openid, { category } = {}) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  const q = { familyId: user.familyId };
  if (category) q.category = category;
  const r = await db.collection('dishes').where(q).orderBy('createdAt', 'desc').get();
  return ok({ dishes: r.data });
}

// add：加菜，校验同家庭菜名不重复（category 为自由字符串）
async function add(openid, { name, category, image }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!name) return fail('请输入菜名');
  if (!category) return fail('请选择分类');
  const exist = await db.collection('dishes').where({
    familyId: user.familyId, name
  }).count();
  if (exist.total > 0) return fail('该菜名已存在');
  const now = new Date();
  const addRes = await db.collection('dishes').add({
    data: { familyId: user.familyId, name, category, image: image || '', createdAt: now }
  });
  return ok({
    dish: { _id: addRes._id, familyId: user.familyId, name, category, image: image || '', createdAt: now }
  });
}

// update：编辑菜品
async function update(openid, { id, name, category, image }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!id) return fail('参数错误');
  let dRes;
  try {
    dRes = await db.collection('dishes').doc(id).get();
  } catch (e) {
    return fail('菜品不存在');
  }
  if (!dRes.data || dRes.data.familyId !== user.familyId) return fail('无权操作');
  const update = {};
  if (name !== undefined) update.name = name;
  if (category !== undefined) {
    if (!category) return fail('分类不能为空');
    update.category = category;
  }
  if (image !== undefined) update.image = image;
  // 如果改名，校验同名
  if (update.name && update.name !== dRes.data.name) {
    const dup = await db.collection('dishes').where({
      familyId: user.familyId, name: update.name
    }).count();
    if (dup.total > 0) return fail('该菜名已存在');
  }
  await db.collection('dishes').doc(id).update({ data: update });
  return ok({ dish: { ...dRes.data, ...update } });
}

// renameCategory：重命名分类，同步更新该分类下所有菜品
async function renameCategory(openid, { oldName, newName }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!oldName || !newName) return fail('参数错误');
  const _ = db.command;
  await db.collection('dishes').where({
    familyId: user.familyId, category: oldName
  }).update({ data: { category: newName } });
  return ok({});
}

// clearCategory：删除分类，该分类下菜品的 category 置空（归入全部）
async function clearCategory(openid, { name }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!name) return fail('参数错误');
  await db.collection('dishes').where({
    familyId: user.familyId, category: name
  }).update({ data: { category: '' } });
  return ok({});
}

// delete：删菜
async function del(openid, { id }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!id) return fail('参数错误');
  let dRes;
  try {
    dRes = await db.collection('dishes').doc(id).get();
  } catch (e) {
    return fail('菜品不存在');
  }
  if (!dRes.data || dRes.data.familyId !== user.familyId) return fail('无权操作');
  await db.collection('dishes').doc(id).remove();
  return ok({});
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action } = event;

  // 家庭级权限守卫：校验家庭成员身份 + 请求携带的 familyId 归属
  const permErr = await authGuard.guard(openid, action, event);
  if (permErr) return fail(permErr);

  try {
    switch (action) {
      case 'list':           return await list(openid, event);
      case 'add':            return await add(openid, event);
      case 'update':         return await update(openid, event);
      case 'delete':         return await del(openid, event);
      case 'renameCategory': return await renameCategory(openid, event);
      case 'clearCategory':  return await clearCategory(openid, event);
      default:               return fail(`unknown action: ${action}`);
    }
  } catch (e) {
    console.error(`[dish.${action}] error:`, e);
    return fail(e.message || '服务器错误');
  }
};
