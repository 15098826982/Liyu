// pages/random/random.js  随机推荐（boss 从首页进入）
const { api } = require('../../utils/request');
const auth = require('../../utils/auth');

Page({
  data: {
    dishes: [],
    loading: false,
    ordered: {} // 已点 dishId -> true
  },

  onShow() {
    const user = auth.getUser();
    if (!user || !user.familyId || !user.role) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
  },

  async onPick() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const { dishes } = await api('order', 'random', {}, { loadingText: '抽菜中' });
      this.setData({ dishes, ordered: {} });
    } catch (e) {
      this.setData({ dishes: [] });
    } finally {
      this.setData({ loading: false });
    }
  },

  async onOrder(e) {
    const id = e.currentTarget.dataset.id;
    if (this.data.ordered[id]) return;
    try {
      await api('order', 'add', { dishId: id }, { loadingText: '添加中' });
      wx.showToast({ title: '已加入今日菜单', icon: 'success' });
      this.setData({ [`ordered.${id}`]: true });
    } catch (e) {}
  }
});
