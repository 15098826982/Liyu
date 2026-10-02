// app.js
const { api } = require('./utils/request');
const { thumb } = require('./utils/img');
const cache = require('./utils/cache');

const BG_CACHE_KEY = 'cache_page_bg';

App({
  globalData: {
    userInfo: null,
    openid: null,
    pageBgUrl: '' // 全局页面背景图临时 URL
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    wx.cloud.init({
      env: 'cloud1-d5gqz2wlx6b4c8c65',
      traceUser: true
    });
    this.loadPageBg();
  },

  // 读背景图缓存（含来源 fileID 和生成时间），命中则立即写入 globalData 秒显
  readBgCache() {
    try {
      const c = wx.getStorageSync(BG_CACHE_KEY);
      if (c && c.url) {
        this.globalData.pageBgUrl = c.url;
        return c;
      }
    } catch (e) {}
    return null;
  },

  saveBgCache(fileID, url) {
    try {
      wx.setStorageSync(BG_CACHE_KEY, { fileID, url, time: Date.now() });
    } catch (e) {}
  },

  clearBgCache() {
    try {
      wx.removeStorageSync(BG_CACHE_KEY);
    } catch (e) {}
  },

  // 退出/切换家庭时调用：清空全局背景图 + 所有 cache_ 前缀的本地缓存
  // 避免新用户身份下仍显示上一个家庭的背景图和列表数据
  clearFamilyData() {
    this.globalData.pageBgUrl = '';
    cache.clearAll();
  },

  // 加载全局页面背景图：缓存优先，后台拉最新
  // force=true 时忽略缓存直接重新转换（临时 URL 过期时兜底用）
  async loadPageBg(force) {
    const cached = this.readBgCache(); // 先秒显上次处理好的 URL，不等云函数

    try {
      const { family } = await api('family', 'getInfo', {}, { showLoading: false });
      const bg = family && family.pageBg;

      // 背景被移除：清空 globalData 和缓存
      if (!bg) {
        this.globalData.pageBgUrl = '';
        this.clearBgCache();
        return;
      }

      // 非云文件（外链/本地路径）：直接用
      if (bg.indexOf('cloud://') !== 0) {
        this.globalData.pageBgUrl = bg;
        this.saveBgCache(bg, bg);
        return;
      }

      // 背景没变且不是强制刷新：保持缓存不动
      if (!force && cached && cached.fileID === bg && cached.url) return;

      // 变了：取 bg 规格缩略图（全屏背景用的小尺寸 webp）
      let url = await thumb(bg, 'bg', force);
      if (!url || url === bg || url.indexOf('http') !== 0) {
        // 缩略图失败：退回原图临时 URL
        const res = await wx.cloud.getTempFileURL({ fileList: [bg] });
        url = (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) || '';
      }
      if (url) {
        this.globalData.pageBgUrl = url;
        this.saveBgCache(bg, url);
      }
    } catch (e) {}
  },

  // 刷新背景图（设置页保存后、或背景图加载失败时调用）
  refreshPageBg(force) {
    return this.loadPageBg(force);
  }
});
