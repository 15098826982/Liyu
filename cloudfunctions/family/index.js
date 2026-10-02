// family 云函数：家庭模块
// actions: create | join | getInfo | leave
const cloud = require('wx-server-sdk');
// 必须先 init 再 require 公共模块（模块顶层会调用 cloud.database()，未初始化会抛错）
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const authGuard = require('./authGuard');
const db = cloud.database();

// 家庭级权限：updateInfo 需要已加入家庭（create/join/leave 本身在家庭之外，不做该校验）
authGuard.init({ familyActions: ['updateInfo'] });

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

// 生成 6 位邀请码（查重，最多重试 10 次）
async function genFamilyCode() {
  for (let i = 0; i < 10; i++) {
    const code = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    const exist = await db.collection('families').where({ familyCode: code }).count();
    if (exist.total === 0) return code;
  }
  return null;
}

// 统计家庭当前成员数（用于识别 0 成员的脏数据家庭）
async function familyMemberCount(familyId) {
  if (!familyId) return 0;
  try {
    const r = await db.collection('users').where({ familyId }).count();
    return r.total;
  } catch (e) {
    return 0;
  }
}

// 作废 0 成员的脏数据家庭：删除家庭记录并清空用户 familyId
// 返回 true=已作废（调用方可继续创建/加入）
async function voidEmptyFamily(user) {
  if (!user || !user.familyId) return false;
  const count = await familyMemberCount(user.familyId);
  if (count > 0) return false;
  try {
    await db.collection('families').doc(user.familyId).remove();
  } catch (e) {}
  await db.collection('users').doc(user._id).update({ data: { familyId: null, role: null } });
  return true;
}

// create：创建家庭（幂等：已有家庭直接返回现有家庭，不再新建）
async function create(openid, { name }) {
  const user = await getUserByOpenid(openid);
  if (!user) return fail('user not found');

  if (user.familyId) {
    // 已有家庭 → 直接返回现有家庭
    try {
      const fRes = await db.collection('families').doc(user.familyId).get();
      if (fRes.data) return ok({ family: fRes.data, existed: true });
    } catch (e) {}
    // 家庭记录已不存在（脏数据）→ 清空用户 familyId 后按新家庭处理
    await db.collection('users').doc(user._id).update({ data: { familyId: null, role: null } });
  }

  if (!name) return fail('请填写家庭名称');

  const code = await genFamilyCode();
  if (!code) return fail('生成邀请码失败，请重试');

  const now = new Date();
  const addRes = await db.collection('families').add({
    data: { familyCode: code, name, createdAt: now }
  });
  await db.collection('users').doc(user._id).update({
    data: { familyId: addRes._id }
  });
  return ok({
    family: { _id: addRes._id, familyCode: code, name }
  });
}

// join：输入邀请码加入家庭（幂等：已是该家庭成员直接返回）
async function join(openid, { familyCode }) {
  if (!familyCode) return fail('请输入邀请码');
  const user = await getUserByOpenid(openid);
  if (!user) return fail('user not found');

  const fRes = await db.collection('families').where({ familyCode }).get();
  if (fRes.data.length === 0) return fail('邀请码无效');
  const family = fRes.data[0];

  // 幂等：用户已是该家庭成员 → 直接返回该家庭，前端正常进入下一步
  if (user.familyId === family._id) return ok({ family, existed: true });

  // 已有其它家庭：0 成员的脏数据家庭可作废后继续，否则提示先退出
  if (user.familyId) {
    const voided = await voidEmptyFamily(user);
    if (!voided) return fail('已加入家庭，请先退出');
  }

  // 限制：一个家庭最多2人（情侣）
  const mCount = await db.collection('users').where({ familyId: family._id }).count();
  if (mCount.total >= 2) return fail('家庭已满（最多2位成员），无法加入');

  await db.collection('users').doc(user._id).update({
    data: { familyId: family._id }
  });
  return ok({ family });
}

// getInfo：当前家庭信息 + 成员列表
async function getInfo(openid) {
  const user = await getUserByOpenid(openid);
  if (!user) return fail('user not found');
  if (!user.familyId) return ok({ family: null, members: [] });

  let family = null;
  try {
    const fRes = await db.collection('families').doc(user.familyId).get();
    family = fRes.data;
  } catch (e) {
    // 家庭已被删
    return ok({ family: null, members: [] });
  }
  const mRes = await db.collection('users').where({ familyId: user.familyId }).get();
  return ok({
    family,
    members: mRes.data.map(m => ({
      _id: m._id,
      nickname: m.nickname,
      avatar: m.avatar,
      role: m.role
    }))
  });
}

// leave：退出家庭（清空 familyId 和 role）
async function leave(openid) {
  const user = await getUserByOpenid(openid);
  if (!user) return fail('user not found');
  if (!user.familyId) return fail('未加入家庭');
  await db.collection('users').doc(user._id).update({
    data: { familyId: null, role: null }
  });
  return ok({});
}

// updateInfo：更新家庭信息（相恋日期、纪念日、封面图等）
async function updateInfo(openid, { loveStartDate, anniversaryDate, coverImage, pageBg, categories }) {
  const user = await getUserByOpenid(openid);
  if (!user) return fail('user not found');
  if (!user.familyId) return fail('未加入家庭');

  const data = {};
  if (loveStartDate !== undefined) data.loveStartDate = loveStartDate;
  if (anniversaryDate !== undefined) data.anniversaryDate = anniversaryDate;
  if (coverImage !== undefined) data.coverImage = coverImage;
  if (pageBg !== undefined) data.pageBg = pageBg;
  if (categories !== undefined) data.categories = categories;

  if (Object.keys(data).length === 0) return fail('没有需要更新的字段');

  await db.collection('families').doc(user.familyId).update({ data });
  // 返回更新后的家庭信息
  const fRes = await db.collection('families').doc(user.familyId).get();
  return ok({ family: fRes.data });
}

// 整体兜底超时：冷启动/底层调用偶发变慢时，保证云函数最终一定返回
// create/join 均幂等，超时返回后前端可安全地"同步服务端状态"或重试
const MAIN_TIMEOUT_MS = 8000;
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ code: -1, msg: '请求处理较慢，请稍后重试' }), ms);
  });
  return Promise.race([promise, timeout]).then(
    (v) => { clearTimeout(timer); return v; },
    (e) => { clearTimeout(timer); throw e; }
  );
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action } = event;

  // 家庭级权限守卫：校验家庭成员身份 + 请求携带的 familyId 归属
  const permErr = await authGuard.guard(openid, action, event);
  if (permErr) return fail(permErr);

  try {
    const task = (async () => {
      switch (action) {
        case 'create':     return await create(openid, event);
        case 'join':       return await join(openid, event);
        case 'getInfo':    return await getInfo(openid);
        case 'leave':      return await leave(openid);
        case 'updateInfo': return await updateInfo(openid, event);
        default:           return fail(`unknown action: ${action}`);
      }
    })();
    return await withTimeout(task, MAIN_TIMEOUT_MS);
  } catch (e) {
    console.error(`[family.${action}] error:`, e);
    return fail(e.message || '服务器错误');
  }
};
