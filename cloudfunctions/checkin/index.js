// cloudfunctions/checkin/index.js  打卡规划
const cloud = require('wx-server-sdk');
// 必须先 init 再 require 公共模块（模块顶层会调用 cloud.database()，未初始化会抛错）
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const rateLimit = require('./rateLimit');
const authGuard = require('./authGuard');
const db = cloud.database();
const _ = db.command;

// 家庭级权限：打卡模块所有操作都需要已加入家庭
authGuard.init({ familyActions: ['add', 'list', 'checkin', 'toggleStage', 'toggle', 'update', 'delete'] });

// 入口防刷配置：action 白名单 + 写操作限流阈值（同一 openid，分钟级）
rateLimit.init({
  actions: ['add', 'list', 'checkin', 'toggleStage', 'toggle', 'update', 'delete'],
  limits: {
    add:         { windowMs: 60 * 1000, max: 20 }, // 新建目标：1 分钟 20 次
    update:      { windowMs: 60 * 1000, max: 20 }, // 编辑目标：1 分钟 20 次
    delete:      { windowMs: 60 * 1000, max: 20 }, // 删除目标：1 分钟 20 次
    checkin:     { windowMs: 60 * 1000, max: 20 }, // 每日打卡：1 分钟 20 次
    toggleStage: { windowMs: 60 * 1000, max: 30 }, // 勾选步骤：1 分钟 30 次
    toggle:      { windowMs: 60 * 1000, max: 30 }  // 切换完成：1 分钟 30 次
  },
  rules: {
    add:         { title: 'string' },
    checkin:     { id: 'string' },
    toggle:      { id: 'string' },
    update:      { id: 'string' },
    delete:      { id: 'string' },
    toggleStage: { id: 'string', stageIndex: 'number' }
  }
});

function ok(data) { return { code: 0, msg: 'ok', data }; }
function fail(msg) { return { code: -1, msg, data: null }; }

async function getUserByOpenid(openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data[0] || null;
}

function getTodayStr() {
  // 云函数默认 UTC 时区，这里统一按北京时间（UTC+8）计算"今天"
  const now = new Date();
  const beijing = new Date(now.getTime() + 8 * 3600 * 1000);
  return `${beijing.getUTCFullYear()}-${String(beijing.getUTCMonth() + 1).padStart(2, '0')}-${String(beijing.getUTCDate()).padStart(2, '0')}`;
}

function addDaysStr(startStr, days) {
  const s = new Date(startStr);
  s.setDate(s.getDate() + days);
  return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
}

// 根据 duration 自动生成阶段
// 7天→1段；30天→按周分段；100天→5段；其他→等分3-5段
function genStages(duration) {
  const stages = [];
  if (duration <= 7) {
    stages.push({ name: '完成打卡', threshold: duration, completed: false });
  } else if (duration <= 30) {
    let i = 1;
    for (let t = 7; t < duration; t += 7) {
      stages.push({ name: `第${i}周`, threshold: t, completed: false });
      i++;
    }
    stages.push({ name: `第${i}周`, threshold: duration, completed: false });
  } else {
    const segCount = duration >= 60 ? 5 : 3;
    const step = Math.ceil(duration / segCount);
    for (let i = 0; i < segCount; i++) {
      const t = Math.min((i + 1) * step, duration);
      stages.push({ name: `第${i + 1}阶段`, threshold: t, completed: false });
    }
  }
  return stages;
}

// 重算 stages 完成状态 + status（基于去重日期数）
function recalc(checkinDates, stages, duration) {
  const uniqueDates = [...new Set((checkinDates || []).map(c => c.date))];
  const checkedDays = uniqueDates.length;
  const newStages = (stages || []).map(s => ({
    ...s,
    completed: checkedDays >= s.threshold
  }));
  let status = 'pending';
  if (checkedDays > 0) status = 'ongoing';
  if (checkedDays >= duration) status = 'completed';
  return { checkedDays, stages: newStages, status };
}

// add：创建目标（家庭共享，两人都能创建）
// mode: 'checkin' 打卡型（每天坚持，按天数算进度）/ 'wish' 愿望型（一次性，如旅游，二态完成）
async function add(openid, { title, description, icon, frequency, duration, startDate, mode, stages, goalDate }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!title) return fail('请填写目标名称');

  const m = mode === 'wish' ? 'wish' : 'checkin';
  const today = getTodayStr();
  const start = startDate || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return fail('开始日期格式错误');

  const data = {
    familyId: user.familyId,
    openid,
    creatorRole: user.role,
    creatorName: user.nickname || '',
    title,
    description: description || '',
    icon: icon || '✅',
    mode: m,
    checkinDates: [],
    status: 'pending',
    createdAt: db.serverDate()
  };

  if (m === 'checkin') {
    const dur = parseInt(duration) || 7;
    if (dur < 1 || dur > 1000) return fail('目标时长 1~1000 天');
    data.frequency = frequency || '每天';
    data.duration = dur;
    data.startDate = start;
    data.endDate = addDaysStr(start, dur - 1);
    data.stages = genStages(dur);
  } else {
    // wish 愿望型：无频率时长，二态完成（0% 或 100%）
    data.frequency = '';
    data.duration = 0;
    data.startDate = start;
    // 目标日期（可选，仅展示）
    if (goalDate && /^\d{4}-\d{2}-\d{2}$/.test(goalDate)) {
      data.endDate = goalDate;
    } else {
      data.endDate = '';
    }
    // 自定义步骤（可选）
    let sts = [];
    if (Array.isArray(stages)) {
      sts = stages.filter(s => s && String(s).trim()).map(s => ({ name: String(s).trim(), completed: false }));
    }
    data.stages = sts;
  }

  try {
    const r = await db.collection('checkins').add({ data });
    return ok({ id: r._id });
  } catch (e) {
    if (e.errCode === -502005 || (e.message && e.message.indexOf('not exist') > -1)) {
      const r = await db.collection('checkins').add({ data });
      return ok({ id: r._id });
    }
    throw e;
  }
}

// list：家庭所有目标（两人都能看），按 createdAt desc
async function list(openid) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  try {
    const res = await db.collection('checkins').where({
      familyId: user.familyId
    }).orderBy('createdAt', 'desc').limit(100).get();
    const today = getTodayStr();
    const goals = res.data.map(g => {
      // wish 愿望型：按步骤逐个勾选，进度=已完成步骤/总步骤
      if (g.mode === 'wish') {
        const stages = g.stages || [];
        const doneCount = stages.filter(s => s.completed).length;
        let status = g.status || 'pending';
        let progress = g.status === 'completed' ? 100 : 0;
        if (stages.length > 0) {
          status = doneCount === 0 ? 'pending' : (doneCount === stages.length ? 'completed' : 'ongoing');
          progress = Math.round(doneCount / stages.length * 100);
        }
        return {
          ...g,
          checkinDates: g.checkinDates || [],
          stages,
          status,
          checkedDays: doneCount,
          progress,
          todayChecked: false,
          todayAnyChecked: false
        };
      }
      const r = recalc(g.checkinDates, g.stages, g.duration);
      return {
        ...g,
        checkinDates: g.checkinDates || [],
        stages: r.stages,
        status: r.status,
        checkedDays: r.checkedDays,
        progress: g.duration > 0 ? Math.min(100, Math.round(r.checkedDays / g.duration * 100)) : 0,
        todayChecked: (g.checkinDates || []).some(c => c.date === today && c.openid === openid),
        todayAnyChecked: (g.checkinDates || []).some(c => c.date === today)
      };
    });
    return ok({ goals });
  } catch (e) {
    if (e.errCode === -502005 || (e.message && e.message.indexOf('not exist') > -1)) {
      return ok({ goals: [] });
    }
    throw e;
  }
}

// checkin：今日打卡 / 取消（家庭共享，两人各打各的，进度按日期去重）
async function checkin(openid, { id }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!id) return fail('缺少目标ID');

  const goalRes = await db.collection('checkins').doc(id).get();
  const goal = goalRes.data;
  if (!goal) return fail('目标不存在');
  if (goal.familyId !== user.familyId) return fail('无权操作');
  if (goal.mode === 'wish') return fail('愿望型目标请点击卡片切换完成');

  const today = getTodayStr();
  const checkinDates = goal.checkinDates || [];
  const existIdx = checkinDates.findIndex(c => c.date === today && c.openid === openid);

  let newCheckinDates;
  let action;
  if (existIdx > -1) {
    newCheckinDates = checkinDates.filter((_, i) => i !== existIdx);
    action = 'cancel';
  } else {
    newCheckinDates = [...checkinDates, {
      date: today,
      openid,
      role: user.role,
      nickname: user.nickname || ''
    }];
    action = 'checkin';
  }

  const r = recalc(newCheckinDates, goal.stages, goal.duration);
  await db.collection('checkins').doc(id).update({
    data: {
      checkinDates: newCheckinDates,
      stages: r.stages,
      status: r.status
    }
  });

  return ok({
    action,
    checkedDays: r.checkedDays,
    totalDays: goal.duration,
    status: r.status,
    progress: goal.duration > 0 ? Math.min(100, Math.round(r.checkedDays / goal.duration * 100)) : 0,
    todayChecked: action === 'checkin',
    todayAnyChecked: newCheckinDates.some(c => c.date === today)
  });
}

// toggleStage：愿望型目标，逐步勾选/取消某个步骤
async function toggleStage(openid, { id, stageIndex }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!id) return fail('缺少目标ID');
  if (typeof stageIndex !== 'number' || stageIndex < 0) return fail('步骤索引错误');

  const goalRes = await db.collection('checkins').doc(id).get();
  const goal = goalRes.data;
  if (!goal) return fail('目标不存在');
  if (goal.familyId !== user.familyId) return fail('无权操作');
  if (goal.mode !== 'wish') return fail('仅愿望型目标可逐步勾选');

  const stages = (goal.stages || []).map((s, i) => ({
    ...s,
    completed: i === stageIndex ? !s.completed : s.completed
  }));
  const doneCount = stages.filter(s => s.completed).length;
  let status = doneCount === 0 ? 'pending' : 'ongoing';
  if (stages.length > 0 && doneCount === stages.length) status = 'completed';
  const progress = stages.length > 0 ? Math.round(doneCount / stages.length * 100) : 0;

  await db.collection('checkins').doc(id).update({
    data: { stages, status }
  });
  return ok({
    action: status === 'completed' ? 'complete' : 'toggle',
    status,
    progress,
    stages,
    doneCount
  });
}

// toggle：愿望型目标完成/取消切换（二态，仅无步骤时使用）
async function toggle(openid, { id }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!id) return fail('缺少目标ID');

  const goalRes = await db.collection('checkins').doc(id).get();
  const goal = goalRes.data;
  if (!goal) return fail('目标不存在');
  if (goal.familyId !== user.familyId) return fail('无权操作');
  if (goal.mode !== 'wish') return fail('仅愿望型目标可切换完成');

  const willComplete = goal.status !== 'completed';
  const stages = (goal.stages || []).map(s => ({ ...s, completed: willComplete }));
  const status = willComplete ? 'completed' : 'pending';
  await db.collection('checkins').doc(id).update({
    data: { stages, status }
  });
  return ok({
    action: willComplete ? 'complete' : 'cancel',
    status,
    progress: willComplete ? 100 : 0,
    stages
  });
}

// update：编辑目标（两人都能改）
async function update(openid, { id, title, description, icon, frequency, duration, startDate }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!id) return fail('缺少目标ID');

  const goalRes = await db.collection('checkins').doc(id).get();
  const goal = goalRes.data;
  if (!goal) return fail('目标不存在');
  if (goal.familyId !== user.familyId) return fail('无权操作');

  const data = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (icon !== undefined) data.icon = icon;
  if (frequency !== undefined) data.frequency = frequency;

  // 若改了 duration 或 startDate，重新生成 stages 和 endDate
  let dur = duration !== undefined ? parseInt(duration) : goal.duration;
  if (dur < 1 || dur > 1000) return fail('目标时长 1~1000 天');
  let start = startDate !== undefined ? startDate : goal.startDate;
  if (data.title !== undefined && !title) return fail('目标名称不能为空');

  if (duration !== undefined || startDate !== undefined) {
    data.duration = dur;
    data.startDate = start;
    data.endDate = addDaysStr(start, dur - 1);
    // 改时长时重置 stages
    data.stages = genStages(dur);
    const r = recalc(goal.checkinDates, data.stages, dur);
    data.stages = r.stages;
    data.status = r.status;
  }

  await db.collection('checkins').doc(id).update({ data });
  return ok({ updated: true });
}

// delete：删除目标（两人都能删）
async function del(openid, { id }) {
  const user = await getUserByOpenid(openid);
  if (!user || !user.familyId) return fail('未加入家庭');
  if (!id) return fail('缺少目标ID');

  const goalRes = await db.collection('checkins').doc(id).get();
  const goal = goalRes.data;
  if (!goal) return fail('目标不存在');
  if (goal.familyId !== user.familyId) return fail('无权操作');

  await db.collection('checkins').doc(id).remove();
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
      case 'add':     return await add(openid, event);
      case 'list':    return await list(openid);
      case 'checkin': return await checkin(openid, event);
      case 'toggleStage': return await toggleStage(openid, event);
      case 'toggle':  return await toggle(openid, event);
      case 'update':  return await update(openid, event);
      case 'delete':  return await del(openid, event);
      default:        return fail(`unknown action: ${action}`);
    }
  } catch (e) {
    console.error(`[checkin.${action}] error:`, e);
    return fail(e.message || '服务器错误');
  }
};
