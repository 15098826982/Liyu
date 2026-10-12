// exportAll 云函数：一次性把云数据库所有集合导出成 JSON
// 用途：后端迁移前，把旧的云开发数据整包备份出来
// 两种取数方式（同时提供）：
//   1. 结果直接挂在返回值 data.collections 里，可以复制/下载结果文件
//   2. 同时上传一份到云存储 migration/all_data.json，数据太大时用这个
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 导出文件在云存储里的路径（重复跑会覆盖同名文件）
const CLOUD_PATH = 'migration/all_data.json';

// 需要导出的集合清单（按顺序，方便对照）
const COLLECTIONS = [
  'users',
  'families',
  'dishes',
  'orders',
  'wishes',
  'moods',
  'memos',
  'periods',
  'checkins',
  'error_logs',
  'rate_limit_logs'
];

// 云函数侧单次 get 上限是 1000，这里取 100 分页，稳妥一点
const PAGE_SIZE = 100;

// 分页把一个集合拉全
async function exportCollection(name) {
  const docs = [];
  let skip = 0;
  for (;;) {
    // 按 _id 排序，保证 skip 分页不会漏读、重复读
    const res = await db.collection(name)
      .orderBy('_id', 'asc')
      .skip(skip)
      .limit(PAGE_SIZE)
      .get();
    const batch = res.data || [];
    docs.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    skip += batch.length;
  }
  return docs;
}

exports.main = async () => {
  const collections = {};
  const errors = {};
  const counts = {};

  for (const name of COLLECTIONS) {
    try {
      const docs = await exportCollection(name);
      collections[name] = docs;
      counts[name] = docs.length;
    } catch (e) {
      // 集合不存在或读取失败：只记录错误，不影响其他集合
      errors[name] = (e && e.errMsg) || (e && e.message) || String(e);
      console.error('[exportAll] 导出失败:', name, e);
    }
  }

  const payload = {
    code: 0,
    msg: 'success',
    data: {
      collections, // { users: [...], dishes: [...], ... }
      counts,      // { users: 3, dishes: 42, ... }
      errors       // { rate_limit_logs: 'collection not exists' }
    }
  };

  // 同时存一份到云存储：返回值有 1MB 上限，数据大时靠这个文件拿全量数据
  const json = JSON.stringify(payload);
  try {
    const up = await cloud.uploadFile({
      cloudPath: CLOUD_PATH,
      fileContent: Buffer.from(json, 'utf8')
    });
    payload.data.fileID = up.fileID;
    payload.data.sizeKB = Math.round(json.length / 1024);
  } catch (e) {
    payload.data.uploadError = (e && e.errMsg) || (e && e.message) || String(e);
    console.error('[exportAll] 上传云存储失败:', e);
  }

  return payload;
};
