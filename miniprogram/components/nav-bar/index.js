// components/nav-bar/index.js  自定义顶部导航栏
Component({
  options: {
    multipleSlots: true
  },
  properties: {
    title: { type: String, value: '' },
    showBack: { type: Boolean, value: true },
    transparent: { type: Boolean, value: false }
  },

  data: {
    statusBarHeight: 20,
    navBarHeight: 44
  },

  lifetimes: {
    attached() {
      const sysInfo = wx.getSystemInfoSync();
      const menuInfo = wx.getMenuButtonBoundingClientRect();
      // 状态栏高度：优先 statusBarHeight，兜底 safeArea.top，再兜底 20
      const statusBarHeight = sysInfo.statusBarHeight || (sysInfo.safeArea && sysInfo.safeArea.top) || 20;
      // 胶囊按钮上下间距推算导航栏内容高度
      const gap = Math.max(0, menuInfo.top - statusBarHeight);
      const navBarHeight = Math.max(44, gap * 2 + menuInfo.height);
      this.setData({ statusBarHeight, navBarHeight });
    }
  },

  methods: {
    onBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack({ delta: 1 });
      } else {
        wx.reLaunch({ url: '/pages/home/index' });
      }
    }
  }
});
