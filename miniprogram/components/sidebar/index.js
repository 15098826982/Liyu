// components/sidebar/index.js  侧边栏导航组件
const auth = require('../../utils/auth');
const { thumb } = require('../../utils/img');

Component({
  properties: {
    current: { type: String, value: 'home' }
  },

  data: {
    menus: [
      { key: 'home',     label: '首页',     emoji: '🏠', path: '/pages/home/index' },
      { key: 'meal',     label: '干饭',     emoji: '🍚', path: '/pages/meal/index' },
      { key: 'wishlist', label: '心愿清单', emoji: '🎁', path: '/pages/wishlist/index' },
      { key: 'checkin',  label: '打卡规划', emoji: '✅', path: '/pages/checkin/index' },
      { key: 'mood',     label: '心情打卡', emoji: '💌', path: '/pages/mood/index' },
      { key: 'period',   label: '经期管理', emoji: '🌸', path: '/pages/period/index' },
      { key: 'memo',     label: '共同备忘', emoji: '📝', path: '/pages/memo/index' },
      { key: 'settings', label: '设置',     emoji: '⚙️', path: '/pages/settings/index' }
    ],
    user: null,
    avatarUrl: '' // avatar 规格缩略图，失败兜底原值
  },

  lifetimes: {
    attached() {
      this.loadUser();
    }
  },

  methods: {
    async loadUser() {
      const user = auth.getUser();
      this.setData({ user });
      if (user && user.avatar) {
        const url = await thumb(user.avatar, 'avatar');
        this.setData({ avatarUrl: url });
      }
    },
    onSwitch(e) {
      const { path, key } = e.currentTarget.dataset;
      if (key === this.data.current) return;
      if (key === 'home') {
        wx.reLaunch({ url: path });
      } else {
        wx.navigateTo({ url: path });
      }
    },

    onSwitchUser() {
      wx.navigateTo({ url: '/pages/role/select' });
    }
  }
});
