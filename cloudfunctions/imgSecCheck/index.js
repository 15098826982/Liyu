// 云函数 imgSecCheck：图片内容安全审核
// 参数：mediaUrl（图片云存储 fileID）
// 返回：{ pass, errCode, errMsg }  pass=true 合规
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function getContentType(fileID) {
  const m = String(fileID || '').match(/\.(jpg|jpeg|png|webp|gif)$/i);
  const ext = m ? m[1].toLowerCase() : 'png';
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
  return map[ext] || 'image/png';
}

exports.main = async (event) => {
  const { mediaUrl } = event;
  if (!mediaUrl) return { pass: false, errCode: -1, errMsg: 'mediaUrl 不能为空' };
  try {
    const dl = await cloud.downloadFile({ fileID: mediaUrl });
    const buffer = dl.fileContent;
    const result = await cloud.openapi.security.imgSecCheck({
      media: {
        contentType: getContentType(mediaUrl),
        value: buffer
      }
    });
    return { pass: result.errCode === 0, errCode: result.errCode, errMsg: result.errMsg || 'ok' };
  } catch (e) {
    // 87014 表示内容违规，其余视为检测失败（一律不放行）
    return { pass: false, errCode: e.errCode || -1, errMsg: e.errMsg || e.message };
  }
};
