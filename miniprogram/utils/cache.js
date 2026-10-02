// utils/cache.js  列表数据本地缓存（缓存优先、后台更新）
// 统一加 cache_ 前缀，避免和 wx.setStorage 里的其他数据冲突
const PREFIX = 'cache_';

// 读缓存；无缓存返回 null
function getCache(key) {
  try {
    const v = wx.getStorageSync(PREFIX + key);
    return v === '' ? null : v;
  } catch (e) {
    return null;
  }
}

// 写缓存；失败（如超限）静默忽略，不影响页面
function setCache(key, data) {
  try {
    wx.setStorageSync(PREFIX + key, data);
  } catch (e) {}
}

// 清缓存
function removeCache(key) {
  try {
    wx.removeStorageSync(PREFIX + key);
  } catch (e) {}
}

// 清空所有 cache_ 前缀的本地缓存（退出/切换家庭时调用，避免残留上一个家庭的数据，含背景图）
function clearAll() {
  try {
    const info = wx.getStorageInfoSync();
    (info.keys || []).forEach((k) => {
      if (k.indexOf(PREFIX) === 0) wx.removeStorageSync(k);
    });
  } catch (e) {}
}

module.exports = { getCache, setCache, removeCache, clearAll };
