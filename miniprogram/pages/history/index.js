// pages/history/index.js  历史记录（tabBar）
const { api } = require('../../utils/request');
const auth = require('../../utils/auth');

Page({
  data: {
    grouped: [], // [{ orderDate, orders: [...] }]
    page: 1,
    hasMore: true,
    loading: false
  },

  onShow() {
    const user = auth.getUser();
    if (!user || !user.familyId || !user.role) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.setData({ grouped: [], page: 1, hasMore: true });
    this.loadList();
  },

  async loadList() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const { orders } = await api('order', 'history',
        { page: this.data.page, limit: 20 }, { showLoading: false });
      const grouped = this.groupByDate(orders, this.data.grouped);
      this.setData({
        grouped,
        page: this.data.page + 1,
        hasMore: orders.length === 20,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  groupByDate(newOrders, existing) {
    const map = {};
    existing.forEach(g => { map[g.orderDate] = g.orders; });
    newOrders.forEach(o => {
      if (!map[o.orderDate]) map[o.orderDate] = [];
      map[o.orderDate].push(o);
    });
    return Object.keys(map).sort((a, b) => (a < b ? 1 : -1)).map(date => ({
      orderDate: date,
      orders: map[date]
    }));
  },

  onReachBottom() {
    this.loadList();
  }
});
