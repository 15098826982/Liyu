// components/page-bg/index.js  全局页面背景图
const app = getApp();

Component({
  data: {
    bgUrl: ''
  },

  lifetimes: {
    attached() {
      this.setData({ bgUrl: app.globalData.pageBgUrl || '' });
    }
  },

  // 页面每次回到前台都刷新（设置页改完背景图返回时生效）
  pageLifetimes: {
    show() {
      this.setData({ bgUrl: app.globalData.pageBgUrl || '' });
    }
  },

  methods: {
    // 背景图临时 URL 过期时兜底：触发一次后台强制刷新（同一 URL 只重试一次）
    async onBgError() {
      const url = this.data.bgUrl;
      if (!url || this.bgErrUrl === url) return;
      this.bgErrUrl = url;
      const app = getApp();
      if (!app.refreshPageBg) return;
      await app.refreshPageBg(true);
      const next = app.globalData.pageBgUrl || '';
      if (next && next !== url) this.setData({ bgUrl: next });
    }
  }
});
