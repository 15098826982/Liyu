// pages/settings/index.js  设置页：修改头像 + 昵称
const { api } = require('../../utils/request');
const { chooseAndUpload } = require('../../utils/upload');
const auth = require('../../utils/auth');
const inputHelper = require('../../utils/input');
const { checkText } = require('../../utils/security');
const { thumb } = require('../../utils/img');

Page({
  data: {
    user: null,
    avatarUrl: '', // avatar 规格缩略图，失败兜底原值
    nickname: '',
    showNicknameEdit: false,
    couple: { loveStartDate: '', anniversaryDate: '', coverImage: '', pageBg: '' },
    coverThumb: '',   // 封面预览：list 规格缩略图
    pageBgThumb: '',  // 背景预览：list 规格缩略图
    savingCouple: false,
    familyCode: '',
    familyName: '',
    memberCount: 0,
    isDev: false,
    ph: { nickname: '请输入昵称' }
  },

  noop() {},

  onShow() {
    const user = auth.getUser();
    if (!user || !user.familyId || !user.role) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    // 测试入口只在开发版/体验版显示，正式版不展示
    const info = wx.getAccountInfoSync();
    const envVersion = (info && info.miniProgram && info.miniProgram.envVersion) || 'develop';
    this.setData({ user, nickname: user.nickname || '', isDev: envVersion !== 'release' });
    this.loadAvatar(user);
    this.loadCouple();
  },

  // 头像按 avatar 规格取缩略图
  async loadAvatar(user) {
    if (!user || !user.avatar) {
      this.setData({ avatarUrl: '' });
      return;
    }
    const url = await thumb(user.avatar, 'avatar');
    this.setData({ avatarUrl: url });
  },

  // ===== 我们的时光（家庭级配置） =====
  async loadCouple() {
    try {
      const { family, members } = await api('family', 'getInfo', {}, { showLoading: false });
      if (family) {
        this.setData({
          familyCode: family.familyCode || '',
          familyName: family.name || '',
          memberCount: (members && members.length) || 0,
          couple: {
            loveStartDate: family.loveStartDate || '',
            anniversaryDate: family.anniversaryDate || '',
            coverImage: family.coverImage || '',
            pageBg: family.pageBg || ''
          }
        }, () => this.refreshPreviews());
      }
    } catch (e) {}
  },

  // 封面/背景预览是小尺寸展示，按 list 规格取缩略图（失败兜底原图）
  async refreshPreviews() {
    const { coverImage, pageBg } = this.data.couple;
    const [coverThumb, pageBgThumb] = await Promise.all([
      coverImage ? thumb(coverImage, 'list') : '',
      pageBg ? thumb(pageBg, 'list') : ''
    ]);
    this.setData({ coverThumb, pageBgThumb });
  },

  onCopyFamilyCode() {
    if (!this.data.familyCode) return;
    wx.setClipboardData({
      data: this.data.familyCode,
      success: () => wx.showToast({ title: '邀请码已复制', icon: 'success' })
    });
  },

  async onChooseCover() {
    const fileID = await chooseAndUpload({ type: 'family' });
    if (fileID) {
      this.setData({ 'couple.coverImage': fileID }, () => this.refreshPreviews());
    }
  },

  onClearCover() {
    this.setData({ 'couple.coverImage': '', coverThumb: '' });
  },

  async onChoosePageBg() {
    const fileID = await chooseAndUpload({ type: 'family' });
    if (fileID) {
      this.setData({ 'couple.pageBg': fileID }, () => this.refreshPreviews());
    }
  },

  onClearPageBg() {
    this.setData({ 'couple.pageBg': '', pageBgThumb: '' });
  },

  onLoveDateChange(e) {
    this.setData({ 'couple.loveStartDate': e.detail.value });
  },

  onAnniChange(e) {
    this.setData({ 'couple.anniversaryDate': e.detail.value });
  },

  async onSaveCouple() {
    const { couple, savingCouple } = this.data;
    if (savingCouple) return;
    if (!couple.loveStartDate) {
      wx.showToast({ title: '请选择相恋日期', icon: 'none' });
      return;
    }
    if (!couple.anniversaryDate) {
      wx.showToast({ title: '请选择纪念日', icon: 'none' });
      return;
    }
    this.setData({ savingCouple: true });
    try {
      await api('family', 'updateInfo', {
        loveStartDate: couple.loveStartDate,
        anniversaryDate: couple.anniversaryDate,
        coverImage: couple.coverImage,
        pageBg: couple.pageBg
      }, { loadingText: '保存中' });
      wx.showToast({ title: '已保存', icon: 'success' });
      // 刷新全局背景图
      const app = getApp();
      if (app.refreshPageBg) app.refreshPageBg();
    } catch (e) {}
    this.setData({ savingCouple: false });
  },

  // ===== 修改头像 =====
  async onChooseAvatar() {
    const fileID = await chooseAndUpload({ type: 'avatar' });
    if (!fileID) return;
    try {
      const { user } = await api('user', 'updateProfile', { avatar: fileID }, { loadingText: '上传中' });
      auth.setUser(user);
      this.setData({ user });
      this.loadAvatar(user);
      wx.showToast({ title: '头像已更新', icon: 'success' });
    } catch (e) {}
  },

  async onClearAvatar() {
    try {
      const { user } = await api('user', 'updateProfile', { avatar: '' }, { loadingText: '恢复中' });
      auth.setUser(user);
      this.setData({ user, avatarUrl: '' });
      wx.showToast({ title: '已恢复默认头像', icon: 'success' });
    } catch (e) {}
  },

  // ===== 修改昵称 =====
  onEditNickname() {
    this.setData({ showNicknameEdit: true, nickname: this.data.user.nickname || '' });
  },
  onHideNicknameEdit() {
    this.setData({ showNicknameEdit: false });
  },
  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },
  async onSaveNickname() {
    const nickname = this.data.nickname.trim();
    if (!nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    if (nickname.length > 20) {
      wx.showToast({ title: '昵称不超过20字', icon: 'none' });
      return;
    }
    const pass = await checkText(nickname);
    if (!pass) {
      wx.showToast({ title: '内容包含违规文字', icon: 'none' });
      return;
    }
    try {
      const { user } = await api('user', 'updateProfile', { nickname }, { loadingText: '保存中' });
      auth.setUser(user);
      this.setData({ user, showNicknameEdit: false });
      wx.showToast({ title: '昵称已更新', icon: 'success' });
    } catch (e) {}
  },

  // ===== 切换身份 =====
  onSwitchRole() {
    wx.navigateTo({ url: '/pages/role/select' });
  },

  // ===== 测试功能：模拟老公视角（只有一个微信时） =====
  async onSimulateManager() {
    try {
      const { user } = await api('user', 'createTestMate', {}, { loadingText: '创建测试老公中' });
      auth.setUser(user);
      wx.showToast({ title: '已切换为老公视角', icon: 'success' });
      setTimeout(() => wx.reLaunch({ url: '/pages/home/index' }), 600);
    } catch (e) {}
  },

  async onRestoreSelf() {
    try {
      const { user } = await api('user', 'login', {}, { loadingText: '切换中' });
      auth.setUser(user);
      wx.showToast({ title: '已切回自己的视角', icon: 'success' });
      setTimeout(() => wx.reLaunch({ url: '/pages/home/index' }), 600);
    } catch (e) {}
  },

  // ===== 退出家庭 =====
  async onLeave() {
    const confirm = await new Promise(resolve => {
      wx.showModal({
        title: '退出家庭',
        content: '退出后需重新输入邀请码加入，确认退出？',
        success: r => resolve(r.confirm)
      });
    });
    if (!confirm) return;
    try {
      await api('family', 'leave');
      auth.clearUser();
      // 清空背景图与家庭相关缓存（否则新用户身份下仍会显示上一个家庭的背景图）
      const app = getApp();
      if (app && app.clearFamilyData) app.clearFamilyData();
      wx.showToast({ title: '已退出家庭', icon: 'success' });
      setTimeout(() => wx.reLaunch({ url: '/pages/login/login' }), 800);
    } catch (e) {}
  },

  ...inputHelper
});
