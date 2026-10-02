// pages/family/create.js
const { api } = require('../../utils/request');
const auth = require('../../utils/auth');
const inputHelper = require('../../utils/input');

Page({
  data: {
    name: '',
    created: false,
    familyCode: '',
    familyName: '',
    codeTitle: '家庭创建成功',
    creating: false,
    needSync: false,       // 上次创建超时未确认结果，下次点击先同步服务端状态
    inputFocus: false,
    fromRole: false,
    statusBarHeight: 20,
    ph: { name: '比如：我们的家、猪猪小窝...' }
  },

  onLoad(options) {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 20,
      fromRole: options && options.from === 'role'   // 从「选择身份」返回时不再自动跳转，避免来回跳
    });
  },

  // 每次进入都同步服务端状态：已在家庭则不再停留在创建页
  async onShow() {
    if (this._syncing) return;
    this._syncing = true;
    try {
      const user = await auth.fetchUser();
      if (!user) return auth.go(auth.ROUTES.login);
      if (user.familyId && user.role) return auth.go(auth.ROUTES.home);
      if (user.familyId && !user.role) {
        if (this.data.fromRole) {
          // 从身份页返回：展示已有家庭信息（可复制邀请码），不自动再跳身份页
          await this.showExistingFamily();
        } else {
          return auth.go(auth.ROUTES.role);
        }
      }
    } catch (e) {
      // 服务端异常：留在本页，让用户手动重试，避免卡死
    } finally {
      this._syncing = false;
    }
  },

  // 展示已存在的家庭（含邀请码）
  async showExistingFamily() {
    try {
      const { family } = await api('family', 'getInfo', {}, { showLoading: false });
      if (family) {
        this.setData({
          created: true,
          familyCode: family.familyCode || '',
          familyName: family.name || '',
          codeTitle: '你的家庭'
        });
      }
    } catch (e) {}
  },

  onInput(e) { this.setData({ name: e.detail.value }); },

  onInputFocus(e) {
    this.setData({ inputFocus: true });
    this.onFieldFocus(e);
  },

  onInputBlur(e) {
    this.setData({ inputFocus: false });
    this.onFieldBlur(e);
  },

  // 创建请求：超过 8 秒未返回则按超时处理（不阻塞按钮，交给用户再次点击同步）
  _createWithTimeout(name, ms = 8000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject({ timeout: true });
      }, ms);
      api('family', 'create', { name }, { showLoading: false })
        .then((res) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(res);
        })
        .catch((err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(err);
        });
    });
  },

  async onCreate() {
    if (this.data.creating) return;

    // 上次超时未确认结果：先同步服务端状态，可能家庭已经建好
    if (this.data.needSync) {
      this.setData({ creating: true });
      try {
        const user = await auth.fetchUser();
        if (user && user.familyId) {
          wx.showToast({ title: '家庭已创建成功', icon: 'success' });
          setTimeout(() => auth.go(auth.ROUTES.role), 700);
          return;
        }
      } catch (e) {}
      // 服务端仍未建好 → 继续走创建（云函数幂等，不会重复创建）
      this.setData({ needSync: false, creating: false });
    }

    const name = (this.data.name || '').trim();
    if (!name) {
      wx.showToast({ title: '🐱 喵～先给小窝起个名字吧！', icon: 'none' });
      return;
    }
    if (this.data.creating) return;
    this.setData({ creating: true });
    try {
      const { family } = await this._createWithTimeout(name);
      const user = auth.getUser() || {};
      user.familyId = family._id;
      auth.setUser(user);
      // 显示邀请码，不立即跳转（先出结果，再刷新背景，避免背景刷新异常挡住流程）
      this.setData({
        created: true,
        familyCode: family.familyCode,
        familyName: family.name,
        codeTitle: '家庭创建成功',
        creating: false,
        needSync: false
      });
      // 新家庭默认无背景图，刷新全局背景图（蓝粉兜底）
      try {
        const app = getApp();
        if (app && app.refreshPageBg) app.refreshPageBg();
      } catch (e) {}
    } catch (e) {
      if (e && e.timeout) {
        // 超时：结束"创建中"状态，提示用户可稍候或再次点击（再次点击会先同步服务端）
        this.setData({ creating: false, needSync: true });
        wx.showToast({ title: '创建较慢，请稍候或再次点击（不会重复创建）', icon: 'none', duration: 3000 });
      } else {
        this.setData({ creating: false });
      }
    }
  },

  onCopyCode() {
    wx.setClipboardData({
      data: this.data.familyCode,
      success: () => wx.showToast({ title: '邀请码已复制', icon: 'success' })
    });
  },

  onGoNext() {
    auth.go(auth.ROUTES.role);
  },

  goJoin() {
    auth.go(auth.ROUTES.join);
  },

  // 创建页是引导第一步，返回回到登录页（统一 reLaunch，不留返回栈）
  goBack() {
    auth.go(auth.ROUTES.login);
  },

  ...inputHelper
});
