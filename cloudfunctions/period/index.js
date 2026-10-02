// cloudfunctions/period/index.js  经期管理
const cloud = require('wx-server-sdk');
// 必须先 init 再 require 公共模块（模块顶层会调用 cloud.database()，未初始化会抛错）
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const authGuard = require('./authGuard');
const db = cloud.database();
const _ = db.command;

// 家庭级权限：以下操作需要已加入家庭
authGuard.init({ familyActions: ['add', 'list', 'delete'] });

function ok(data) { return { code: 0, msg: 'ok', data }; }
function fail(msg) { return { code: -1, msg, data: null }; }

async function getUserByOpenid(openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data[0] || null;
}

const VALID_FLOW = ['少', '中', '多'];
const VALID_PAIN = ['无', '轻', '中', '重'];
const VALID_MOOD = ['开心', '平静', '烦躁', '难过'];
const VALID_SYMPTOMS = ['腰酸', '腹痛', '乏力', '胸胀', '头痛', '失眠'];

// add：记录经期（仅老婆 role=boss 可记）
// 同开始日期已存在则覆盖更新
async function add(openid, { startDate, endDate, flow, pain, mood, symptoms, note }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (user.role !== 'boss') return fail('只有老婆可以记录经期');

  if (!startDate) return fail('请选择开始日期');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return fail('开始日期格式错误');
  if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return fail('结束日期格式错误');

  if (flow && !VALID_FLOW.includes(flow)) return fail('经量选项无效');
  if (pain && !VALID_PAIN.includes(pain)) return fail('痛经程度无效');
  if (mood && !VALID_MOOD.includes(mood)) return fail('心情选项无效');
  const symps = Array.isArray(symptoms) ? symptoms.filter(s => VALID_SYMPTOMS.includes(s)) : [];

  const data = {
    familyId: user.familyId,
    openid,
    role: user.role,
    startDate,
    endDate: endDate || '',
    flow: flow || '',
    pain: pain || '',
    mood: mood || '',
    symptoms: symps,
    note: note || '',
    createdAt: db.serverDate()
  };

  try {
    // 同开始日期已存在 → 覆盖
    const exist = await db.collection('periods').where({
      familyId: user.familyId,
      startDate
    }).limit(1).get();
    if (exist.data.length > 0) {
      await db.collection('periods').doc(exist.data[0]._id).update({ data });
      return ok({ id: exist.data[0]._id, updated: true });
    }
    const r = await db.collection('periods').add({ data });
    return ok({ id: r._id, updated: false });
  } catch (e) {
    // 集合不存在时 add 会自动创建
    if (e.errCode === -502005 || (e.message && e.message.indexOf('not exist') > -1)) {
      const r = await db.collection('periods').add({ data });
      return ok({ id: r._id, updated: false });
    }
    throw e;
  }
}

// list：家庭所有经期记录（老婆+老公都能查看）
async function list(openid) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  try {
    const res = await db.collection('periods').where({
      familyId: user.familyId
    }).orderBy('startDate', 'desc').limit(100).get();
    return ok({ periods: res.data });
  } catch (e) {
    if (e.errCode === -502005 || (e.message && e.message.indexOf('not exist') > -1)) {
      return ok({ periods: [] });
    }
    throw e;
  }
}

// delete：删除一条记录（仅老婆）
async function del(openid, { id }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (user.role !== 'boss') return fail('只有老婆可以删除');
  if (!id) return fail('缺少记录ID');

  // 按 _id 取出记录后，校验确实属于当前家庭，防止水平越权删除别家数据
  let pRes;
  try {
    pRes = await db.collection('periods').doc(id).get();
  } catch (e) {
    return fail('记录不存在');
  }
  if (!pRes.data) return fail('记录不存在');
  const member = await authGuard.assertFamilyMember(openid, pRes.data.familyId);
  if (!member || pRes.data.familyId !== user.familyId) return fail(authGuard.NO_PERMISSION);

  await db.collection('periods').doc(id).remove();
  return ok({ deleted: true });
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action } = event;

  // 家庭级权限守卫：校验家庭成员身份 + 请求携带的 familyId 归属
  const permErr = await authGuard.guard(openid, action, event);
  if (permErr) return fail(permErr);

  try {
    switch (action) {
      case 'add':    return await add(openid, event);
      case 'list':   return await list(openid);
      case 'delete': return await del(openid, event);
      default:       return fail(`unknown action: ${action}`);
    }
  } catch (e) {
    console.error(`[period.${action}] error:`, e);
    return fail(e.message || '服务器错误');
  }
};
