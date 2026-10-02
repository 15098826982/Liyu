// pages/role/select.js  选择身份
const { api } = require('../../utils/request');
const auth = require('../../utils/auth');

Page({
  data: {
    selected: '',          // 当前选中身份：'' / 'boss' / 'manager'
    shaking: false,        // 未选择时点确认，卡片抖动
    submitting: false,     // 提交中，防重复点击
    statusBarHeight: 20
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sysInfo.statusBarHeight || 20 });
  },

  // 每次进入同步服务端状态：未加入家庭则回到创建页；已在家庭（含切换身份）则停留本页
  async onShow() {
    if (this._syncing) return;
    this._syncing = true;
    try {
      const user = await auth.fetchUser();
      if (!user) return auth.go(auth.ROUTES.login);
      if (!user.familyId) return auth.go(auth.ROUTES.create);
      if (user.role && !this.data.selected) {
        this.setData({ selected: user.role }); // 切换身份场景：回显当前身份
      }
    } catch (e) {
      // 服务端异常：留在本页
    } finally {
      this._syncing = false;
    }
  },

  // 返回：切换身份场景（已有身份且有上级页）退回上一页；引导场景回到创建页（带 from=role 防止来回跳）
  goBack() {
    const user = auth.getUser();
    const pages = getCurrentPages();
    if (user && user.role && pages.length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    auth.go(auth.ROUTES.create + '?from=role');
  },

  // 点卡片：选中该身份（互斥）
  onSelect(e) {
    if (this.data.submitting) return;
    if (this.data.shaking) this.setData({ shaking: false });
    this.setData({ selected: e.currentTarget.dataset.role });
  },

  // 点确认：未选中抖动提示；已选中走原确认身份逻辑
  async onConfirm() {
    const { selected } = this.data;
    if (!selected) {
      this.setData({ shaking: true });
      setTimeout(() => this.setData({ shaking: false }), 500);
      return;
    }
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      const { user } = await api('user', 'setRole', { role: selected });
      auth.setUser(user);
      wx.showToast({ title: '设置成功', icon: 'success' });
      setTimeout(() => auth.go(auth.ROUTES.home), 800);
    } catch (e) {
      this.setData({ submitting: false });
    }
  }
});
