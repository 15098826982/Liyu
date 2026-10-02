// utils/security.js  内容安全审核工具（云函数 imgSecCheck / msgSecCheck）
// 审核失败或违规一律返回 false，不放行

function checkImage(mediaUrl) {
  return new Promise((resolve) => {
    wx.cloud.callFunction({
      name: 'imgSecCheck',
      data: { mediaUrl },
      success: (res) => {
        const r = res.result || {};
        resolve(!!r.pass);
      },
      fail: () => resolve(false)
    });
  });
}

function checkText(content) {
  if (!content || !String(content).trim()) return Promise.resolve(true);
  return new Promise((resolve) => {
    wx.cloud.callFunction({
      name: 'msgSecCheck',
      data: { content: String(content) },
      success: (res) => {
        const r = res.result || {};
        resolve(!!r.pass);
      },
      fail: () => resolve(false)
    });
  });
}

module.exports = { checkImage, checkText };
