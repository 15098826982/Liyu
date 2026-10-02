// pages/login/login.js
const { api } = require('../../utils/request');
const auth = require('../../utils/auth');

console.log('[login] login.js module loaded');

Page({
  data: {
    agreed: false,
    shakeBtn: false,
    shakeAgree: false
  },

  // 触发抖动动画（先置 false 再置 true，确保每次点击都重播）
  triggerShake(key) {
    this.setData({ [key]: false }, () => {
      this.setData({ [key]: true });
    });
  },

  onLoad() {
    // 恢复协议勾选状态
    this.setData({ agreed: !!wx.getStorageSync('login_agreed') });
  },

  // 每次显示都拉服务端最新用户：已就绪(有家庭+身份)直接进首页，否则停留在登录页
  // readyOnly 保证不会把「未完成引导」的用户又弹回创建/身份页，避免与上一页来回跳
  async onShow() {
    await auth.ensureReady({ readyOnly: true });
  },

  onToggleAgree() {
    const agreed = !this.data.agreed;
    this.setData({ agreed });
    if (agreed) {
      wx.setStorageSync('login_agreed', true);
    } else {
      wx.removeStorageSync('login_agreed');
    }
  },

  handleAgreeTap() {
    this.onToggleAgree();
  },

  onShowAgreement() {
    wx.navigateTo({ url: '/pages/agreement/user-agreement' });
  },

  onShowPrivacy() {
    wx.navigateTo({ url: '/pages/agreement/privacy-policy' });
  },

  async onLogin() {
    // 未勾选协议：抖动 + 提示，不登录
    if (!this.data.agreed) {
      this.triggerShake('shakeBtn');
      this.triggerShake('shakeAgree');
      wx.showToast({ title: '请先阅读并同意用户协议和隐私政策', icon: 'none' });
      return;
    }
    try {
      const { user } = await api('user', 'login', {}, { loadingText: '登录中' });
      auth.setUser(user);
      auth.go(auth.routeOf(user));
    } catch (e) {
      console.error('[login] 登录失败:', e);
      wx.showToast({ title: '登录失败，请稍后重试', icon: 'none' });
    }
  },

  handleLoginTap() {
    this.onLogin();
  }
});
