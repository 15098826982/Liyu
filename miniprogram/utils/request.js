// utils/request.js
// 云函数统一调用封装

/**
 * 调用云函数
 * @param {string} name 云函数名
 * @param {object} data 参数（通常含 action 字段）
 * @param {object} opts { showLoading, loadingText }
 * @returns {Promise<any>} resolve 云函数返回的 data 字段；reject 时已弹错误提示
 */
function call(name, data = {}, opts = {}) {
  const { showLoading = true, loadingText = '加载中' } = opts;
  if (showLoading) {
    wx.showLoading({ title: loadingText, mask: true });
  }
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: (res) => {
        if (showLoading) wx.hideLoading();
        // 约定云函数返回 { code, msg, data }
        if (res.result && res.result.code === 0) {
          resolve(res.result.data);
        } else {
          const msg = (res.result && res.result.msg) || '请求失败';
          wx.showToast({ title: msg, icon: 'none' });
          reject(res.result || { code: -1, msg });
        }
      },
      fail: (err) => {
        if (showLoading) wx.hideLoading();
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
        reject(err);
      }
    });
  });
}

/**
 * 便捷方法：调用某模块某 action
 * 例：api('dish', 'list', { category: '荤菜' })
 */
function api(moduleName, action, params = {}, opts) {
  return call(moduleName, { action, ...params }, opts);
}

module.exports = { call, api };
