// utils/img.js  云存储图片：批量取临时 URL + 按场景取缩略图（imageMogr2）

// 场景预设
const SPECS = {
  bg: 'thumbnail/1080x/quality/40/format/webp',       // 全屏背景
  avatar: 'thumbnail/200x200/quality/70/format/webp', // 头像
  list: 'thumbnail/300x/quality/70/format/webp'       // 列表缩略图
};

// 临时 URL 内存缓存：fileID -> 临时 URL，避免重复转换
const urlCache = {};

function isCloud(fileID) {
  return typeof fileID === 'string' && fileID.indexOf('cloud://') === 0;
}

function isHttp(url) {
  return typeof url === 'string' && url.indexOf('http') === 0;
}

// imageMogr2 要拼在查询串里；临时 URL 自带 ?sign= 时用 & 拼接
function appendSpec(url, spec) {
  const sep = url.indexOf('?') > -1 ? '&' : '?';
  return url + sep + 'imageMogr2/' + spec;
}

/**
 * 批量把 fileID 转成临时 URL（单次请求）
 * @param {string[]} fileIDs
 * @param {boolean} force 忽略内存缓存，强制重新转换
 * @returns {Promise<object>} { [fileID]: url }；非云文件/转换失败时原样返回 fileID
 */
async function getTempUrls(fileIDs, force) {
  const ids = (fileIDs || []).filter(Boolean);
  const result = {};
  const need = [];

  ids.forEach(id => {
    if (!isCloud(id)) {
      result[id] = id;                 // 本地路径、http 链接原样返回
    } else if (!force && urlCache[id]) {
      result[id] = urlCache[id];       // 命中内存缓存
    } else if (!need.includes(id)) {
      need.push(id);
    }
  });

  if (!need.length) return result;

  try {
    const res = await wx.cloud.getTempFileURL({ fileList: need });
    (res.fileList || []).forEach(f => {
      if (f && f.fileID && f.tempFileURL) {
        urlCache[f.fileID] = f.tempFileURL;
        result[f.fileID] = f.tempFileURL;
      }
    });
  } catch (e) {}

  // 兜底：没转换成功的仍返回原 fileID，保证页面不空白
  need.forEach(id => {
    if (!result[id]) result[id] = id;
  });
  return result;
}

/**
 * 取某个场景的缩略图 URL
 * @param {string} fileID
 * @param {string} spec 预设名（bg/avatar/list）或 imageMogr2 原始规则
 * @param {boolean} force 忽略内存缓存，强制重新转换（URL 过期时用）
 * @returns {Promise<string>} 缩略图 URL；失败兜底回原 fileID
 */
async function thumb(fileID, spec, force) {
  if (!isCloud(fileID)) return fileID;

  const urls = await getTempUrls([fileID], force);
  const url = urls[fileID];
  if (!isHttp(url)) return fileID;      // 转换失败：兜底原 fileID

  const rule = SPECS[spec] || spec;
  if (!rule) return url;
  return appendSpec(url, rule);
}

module.exports = { getTempUrls, thumb, SPECS };
