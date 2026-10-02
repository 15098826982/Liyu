// authGuard.js  家庭级权限校验（本文件在每个需要的云函数目录下各存一份，内容一致）
// 用法：
//   const authGuard = require('./authGuard');
//   authGuard.init({ familyActions: ['list', 'add'] });
//   // 入口统一守卫：
//   const permErr = await authGuard.guard(openid, action, event);
//   if (permErr) return fail(permErr);
//   // 校验某条记录归属（避免只靠 _id 查询/修改）：
//   const member = await authGuard.assertFamilyMember(openid, record.familyId);
//   if (!member) return fail(authGuard.NO_PERMISSION);
const cloud = require('wx-server-sdk');
const db = cloud.database();

// 统一无权限返回文案
const NO_PERMISSION = '无权操作该家庭数据';

let config = { familyActions: [] };

// 配置需要家庭身份的操作（不在此列表的 action 不做家庭校验）
function init(opts = {}) {
  config = { familyActions: opts.familyActions || [] };
}

// 按 openid 取用户记录（失败返回 null，不抛异常）
async function getUserByOpenid(openid) {
  if (!openid) return null;
  try {
    const r = await db.collection('users').where({ openid }).limit(1).get();
    return r.data[0] || null;
  } catch (e) {
    return null;
  }
}

/**
 * 校验 openid 是否确实属于 familyId
 * @returns {Promise<object|null>} 属于则返回用户记录（含 role），不属于返回 null
 */
async function assertFamilyMember(openid, familyId) {
  if (!openid || !familyId) return null;
  try {
    const r = await db.collection('users')
      .where({ openid, familyId })
      .limit(1)
      .get();
    return r.data[0] || null;
  } catch (e) {
    return null;
  }
}

/**
 * 入口统一守卫
 * - 需要家庭身份的操作：校验用户已加入家庭
 * - 请求里带 familyId 时：校验该 familyId 与当前用户所属家庭一致（防越权）
 * @returns {Promise<string>} '' 表示通过；否则为错误提示（直接 fail 返回前端）
 */
async function guard(openid, action, event = {}) {
  const needFamily = config.familyActions.includes(action);
  if (!needFamily && !event.familyId) return '';

  const user = await getUserByOpenid(openid);
  if (!user) return needFamily ? '未加入家庭' : 'user not found';
  if (needFamily && !user.familyId) return '未加入家庭';
  if (event.familyId && user.familyId !== event.familyId) return NO_PERMISSION;
  return '';
}

module.exports = { init, guard, getUserByOpenid, assertFamilyMember, NO_PERMISSION };
