// pages/home/index.js  首页模块（侧边栏布局）
const { api } = require('../../utils/request');
const auth = require('../../utils/auth');
const { getCache, setCache } = require('../../utils/cache');

const CACHE_KEY = 'home_today';

Page({
  data: {
    user: null,
    todayOrders: [],
    todayDate: '',
    animOrderId: ''
  },

  onShow() {
    const user = auth.getUser();
    if (!user || !user.familyId || !user.role) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.setData({ user, todayDate: this.formatDate(new Date()) });
    this.loadToday();
  },

  formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  // useCache=true：先渲染本地缓存秒显，再后台拉最新覆盖
  async loadToday(useCache = true) {
    const cached = useCache ? getCache(CACHE_KEY) : null;
    if (cached) {
      this.setData({ todayOrders: cached });
    } else {
      wx.showLoading({ title: '加载中', mask: true });
    }
    try {
      const { orders } = await api('order', 'today', {}, { showLoading: false });
      this.setData({ todayOrders: orders });
      setCache(CACHE_KEY, orders);
      if (!cached) wx.hideLoading();
    } catch (e) {
      if (cached) return; // 有缓存：保留缓存，不报错
      wx.hideLoading();
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  },

  goMeal() {
    wx.navigateTo({ url: '/pages/meal/index' });
  },

  goRandom() {
    wx.navigateTo({ url: '/pages/random/random' });
  },

  // 点状态：已做/未做互切（右上状态标记），整卡变色反馈
  async onMarkDone(e) {
    const id = e.currentTarget.dataset.id;
    const order = this.data.todayOrders.find(o => o._id === id);
    if (!order) return;
    const nextStatus = order.status === 'done' ? 'pending' : 'done';
    try {
      await api('order', 'markDone', { id, status: nextStatus }, { showLoading: false });
      // 触发整卡变色动画
      this.setData({ animOrderId: '' }, () => {
        this.setData({ animOrderId: id });
        setTimeout(() => this.setData({ animOrderId: '' }), 500);
      });
      wx.showToast({ title: nextStatus === 'done' ? '完成啦 🍳' : '已改回未做', icon: 'none' });
      this.loadToday(false); // 改动后拉最新，避免旧缓存闪回
    } catch (e) {}
  }
});
