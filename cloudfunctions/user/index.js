// user 云函数：用户模块
// actions: login | getInfo | updateProfile | setRole
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// ---- 统一响应 ----
function ok(data = {}, msg = 'success') {
  return { code: 0, msg, data };
}
function fail(msg = 'fail', code = -1) {
  return { code, msg };
}

// ---- 业务 ----

// login：openid upsert 用户，返回用户信息
async function login(openid) {
  if (!openid) return fail('no openid');
  const col = db.collection('users');
  const { data } = await col.where({ openid }).get();
  let user;
  if (data.length === 0) {
    const newUser = {
      openid,
      nickname: '',
      avatar: '',
      familyId: null,
      role: null,
      createdAt: new Date()
    };
    const addRes = await col.add({ data: newUser });
    user = { _id: addRes._id, ...newUser };
  } else {
    user = data[0];
  }
  return ok({ user });
}

// getInfo：返回当前登录用户信息
async function getInfo(openid) {
  if (!openid) return fail('no openid');
  const { data } = await db.collection('users').where({ openid }).get();
  if (data.length === 0) return fail('user not found');
  return ok({ user: data[0] });
}

// updateProfile：更新昵称/头像
async function updateProfile(openid, { nickname, avatar }) {
  const { data } = await db.collection('users').where({ openid }).get();
  if (data.length === 0) return fail('user not found');
  const update = {};
  if (nickname !== undefined) update.nickname = nickname;
  if (avatar !== undefined) update.avatar = avatar;
  await db.collection('users').doc(data[0]._id).update({ data: update });
  return ok({ user: { ...data[0], ...update } });
}

// setRole：选择身份
async function setRole(openid, { role }) {
  if (!['boss', 'manager'].includes(role)) return fail('invalid role');
  const { data } = await db.collection('users').where({ openid }).get();
  if (data.length === 0) return fail('user not found');
  await db.collection('users').doc(data[0]._id).update({ data: { role } });
  return ok({ user: { ...data[0], role } });
}

// createTestMate：开发测试用 - 为当前家庭造一个假"老公"成员，返回假用户
// 用于只有一个微信时模拟两个人进入家庭的样子
async function createTestMate(openid) {
  const { data } = await db.collection('users').where({ openid }).get();
  if (data.length === 0) return fail('user not found');
  const me = data[0];
  if (!me.familyId) return fail('请先创建/加入家庭');
  const mateOpenid = 'test-manager';
  const mate = {
    openid: mateOpenid,
    nickname: '测试老公',
    avatar: '',
    familyId: me.familyId,
    role: 'manager'
  };
  const { data: mates } = await db.collection('users').where({ openid: mateOpenid }).get();
  if (mates.length === 0) {
    const r = await db.collection('users').add({ data: { ...mate, createdAt: new Date() } });
    return ok({ user: { _id: r._id, ...mate } });
  }
  await db.collection('users').doc(mates[0]._id).update({ data: { ...mate, updatedAt: new Date() } });
  return ok({ user: { _id: mates[0]._id, ...mate } });
}

// ---- 入口 ----
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action } = event;
  try {
    switch (action) {
      case 'login':          return await login(openid);
      case 'getInfo':        return await getInfo(openid);
      case 'updateProfile':  return await updateProfile(openid, event);
      case 'setRole':        return await setRole(openid, event);
      case 'createTestMate': return await createTestMate(openid);
      default:               return fail(`unknown action: ${action}`);
    }
  } catch (e) {
    console.error(`[user.${action}] error:`, e);
    return fail(e.message || '服务器错误');
  }
};
