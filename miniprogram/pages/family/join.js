// pages/family/join.js
const { api } = require('../../utils/request');
const auth = require('../../utils/auth');
const inputHelper = require('../../utils/input');

Page({
  data: {
    familyCode: '',
    joining: false,
    inputFocus: false,
    statusBarHeight: 20,
    ph: { familyCode: '6位邀请码' }
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sysInfo.statusBarHeight || 20 });
  },

  // 每次进入都同步服务端状态：已在家庭则直接进入下一步，不再停留在加入页
  async onShow() {
    if (this._syncing) return;
    this._syncing = true;
    try {
      const user = await auth.fetchUser();
      if (!user) return auth.go(auth.ROUTES.login);
      if (user.familyId && user.role) return auth.go(auth.ROUTES.home);
      if (user.familyId && !user.role) return auth.go(auth.ROUTES.role);
    } catch (e) {
      // 服务端异常：留在本页
    } finally {
      this._syncing = false;
    }
  },

  onInput(e) { this.setData({ familyCode: e.detail.value }); },

  onInputFocus(e) {
    this.setData({ inputFocus: true });
    this.onFieldFocus(e);
  },

  onInputBlur(e) {
    this.setData({ inputFocus: false });
    this.onFieldBlur(e);
  },

  async onJoin() {
    const code = (this.data.familyCode || '').trim();
    if (code.length !== 6) return wx.showToast({ title: '🐰 请输入6位邀请码呀', icon: 'none' });
    if (this.data.joining) return;
    this.setData({ joining: true });
    try {
      const { family } = await api('family', 'join', { familyCode: code });
      const user = auth.getUser() || {};
      user.familyId = family._id;
      auth.setUser(user);
      wx.showToast({ title: '🎉 加入成功', icon: 'success' });
      // 加入新家庭后刷新全局背景图（失败不影响跳转）
      try {
        const app = getApp();
        if (app && app.refreshPageBg) app.refreshPageBg();
      } catch (e) {}
      setTimeout(() => auth.go(auth.ROUTES.role), 800);
    } catch (e) {
      this.setData({ joining: false });
    }
  },

  goCreate() {
    auth.go(auth.ROUTES.create);
  },

  // 加入页返回上一步 = 创建页
  goBack() {
    auth.go(auth.ROUTES.create);
  },

  ...inputHelper
});
