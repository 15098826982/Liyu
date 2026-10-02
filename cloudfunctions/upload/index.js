// upload 云函数：图片上传前置校验 + 每日限流
// actions: check | record
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const DAILY_LIMIT = 10;        // 每用户每天最多传 10 张
const MAX_SIZE_MB = 5;         // 单张最大 5MB
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp'];

function todayStr() {
  const d = new Date();
  const utc8 = new Date(d.getTime() + 8 * 3600 * 1000);
  return utc8.toISOString().slice(0, 10);
}

// 集合尚未创建时的错误
function isCollectionMissing(e) {
  return !!e && (e.errCode === -502005 || String(e.message || '').indexOf('not exist') > -1);
}

// 确保日志集合存在（云函数侧自动创建，无需去控制台手动建）
const LOG_COLLECTION = 'upload_logs';
let logCollectionEnsured = false;
async function ensureLogCollection() {
  if (logCollectionEnsured) return;
  try {
    await db.createCollection(LOG_COLLECTION);
  } catch (e) {
    // 集合已存在等情况直接忽略
  }
  logCollectionEnsured = true;
}

// 统计今日上传次数；集合异常时不拦截，避免上传整体失败
async function countToday(openid, day) {
  await ensureLogCollection();
  try {
    const res = await db.collection(LOG_COLLECTION).where({ openid, day }).count();
    return res.total;
  } catch (e) {
    if (isCollectionMissing(e)) return 0;
    throw e;
  }
}

// check：上传前调用，返回是否允许上传
async function check(openid, { type, fileSize }) {
  const day = todayStr();
  const total = await countToday(openid, day);

  if (total >= DAILY_LIMIT) {
    return { code: -1, msg: `今天上传已达上限（${DAILY_LIMIT}张），明天再试` };
  }

  // 文件大小校验（前端传的字节数）
  if (fileSize && fileSize > MAX_SIZE_MB * 1024 * 1024) {
    return { code: -1, msg: `图片不能超过${MAX_SIZE_MB}MB` };
  }

  return { code: 0, msg: 'ok', data: { remaining: DAILY_LIMIT - total } };
}

// record：上传成功后调用，记录日志（记录失败不影响上传结果）
async function record(openid, { type, cloudPath }) {
  const day = todayStr();
  await ensureLogCollection();
  try {
    await db.collection(LOG_COLLECTION).add({
      data: {
        openid,
        type: type || 'common',
        cloudPath: cloudPath || '',
        day,
        createdAt: new Date()
      }
    });
  } catch (e) {
    if (!isCollectionMissing(e)) console.error('[upload.record] error:', e);
  }
  return { code: 0, msg: 'ok' };
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action } = event;
  try {
    switch (action) {
      case 'check':  return await check(openid, event);
      case 'record': return await record(openid, event);
      default:       return { code: -1, msg: `unknown action: ${action}` };
    }
  } catch (e) {
    console.error(`[upload.${action}] error:`, e);
    return { code: -1, msg: e.message || '服务器错误' };
  }
};
