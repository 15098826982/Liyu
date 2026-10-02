// pages/wishlist/index.js  心愿清单
const { api } = require('../../utils/request');
const auth = require('../../utils/auth');
const { chooseAndUpload } = require('../../utils/upload');
const inputHelper = require('../../utils/input');
const { checkText } = require('../../utils/security');
const { getCache, setCache } = require('../../utils/cache');
const { getTempUrls, thumb } = require('../../utils/img');

const CACHE_KEY = 'wish_list';

function isFileImg(img) {
  return !!img && img.indexOf('cloud://') === 0;
}

const ICON_OPTIONS = [
  { icon: '🎁', label: '礼物' },
  { icon: '🎂', label: '蛋糕' },
  { icon: '💍', label: '戒指' },
  { icon: '👗', label: '裙子' },
  { icon: '👠', label: '鞋子' },
  { icon: '👜', label: '包包' },
  { icon: '💄', label: '化妆' },
  { icon: '🌸', label: '花' },
  { icon: '📚', label: '书' },
  { icon: '🎧', label: '耳机' },
  { icon: '🎮', label: '游戏' },
  { icon: '🌹', label: '玫瑰' },
  { icon: '🍫', label: '巧克力' },
  { icon: '🧸', label: '玩偶' },
  { icon: '✨', label: '其他' }
];

const TYPE_OPTIONS = ['老婆的', '老公的', '共同的'];
const STATUS_OPTIONS = ['待实现', '已收到'];
const TABS = [
  { key: '全部', label: '全部' },
  { key: '待实现', label: '待实现' },
  { key: '已收到', label: '已收到' }
];

const STATUS_EMOJI = { '待实现': '💭', '已收到': '✅' };
const STATUS_KEY = { '待实现': 'todo', '已收到': 'done' };

const ROLE_EMOJI = { boss: '👩', manager: '👨' };

const MAX_LINK = 500; // 链接最大长度

Page({
  data: {
    user: null,
    wishes: [],
    filteredWishes: [],
    activeTab: '全部',
    tabs: TABS,
    iconOptions: ICON_OPTIONS,
    typeOptions: TYPE_OPTIONS,
    statusOptions: STATUS_OPTIONS,
    showForm: false,
    isEdit: false,
    editingId: '',
    submitting: false,
    form: {
      title: '',
      description: '',
      budget: '',
      image: '🎁',
      status: '待实现',
      type: '',
      link: ''
    },
    showPop: false,
    popEmoji: '',
    ph: {
      title: '如：一支口红',
      description: '如：想要很久的颜色',
      budget: '如：299',
      link: '如：商品链接或得物口令'
    }
  },

  onShow() {
    const user = auth.getUser();
    if (!user || !user.familyId || !user.role) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.setData({ user });
    this.loadWishes();
  },

  // useCache=true：先渲染本地缓存秒显，再后台拉最新覆盖
  async loadWishes(useCache = true) {
    const cached = useCache ? getCache(CACHE_KEY) : null;
    if (cached) {
      this.setData({ wishes: cached });
      this.applyFilter();
      this.applyThumbs(cached); // 缓存的临时 URL 可能过期，重新按 list 规格转换
    } else {
      wx.showLoading({ title: '加载中', mask: true });
    }
    try {
      const { wishes } = await api('wish', 'list', {}, { showLoading: false });
      const list = wishes.map(w => ({
        ...w,
        statusEmoji: STATUS_EMOJI[w.status] || '',
        statusKey: STATUS_KEY[w.status] || 'todo',
        creatorEmoji: ROLE_EMOJI[w.creatorRole] || '👤',
        isFileImg: isFileImg(w.image)
      }));
      // 排序：待实现在上、已收到底；同状态内按创建时间倒序
      list.sort((a, b) => {
        const aDone = a.status === '已收到' ? 1 : 0;
        const bDone = b.status === '已收到' ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        const at = a.createdAt && a.createdAt.$date ? a.createdAt.$date : 0;
        const bt = b.createdAt && b.createdAt.$date ? b.createdAt.$date : 0;
        return bt - at;
      });
      this.setData({ wishes: list });
      this.applyFilter();
      setCache(CACHE_KEY, list);
      if (!cached) wx.hideLoading();
      this.applyThumbs(list); // 后台补列表缩略图，不阻塞渲染
    } catch (e) {
      if (cached) return; // 有缓存：保留缓存，不报错
      wx.hideLoading();
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  },

  // 列表图按 list 规格取缩略图；image 始终保留原图（编辑大图用）
  async applyThumbs(list) {
    const ids = list.filter(w => w.isFileImg && w.image).map(w => w.image);
    if (!ids.length) return;
    await getTempUrls(ids); // 批量转换（一次请求），结果进内存缓存
    const urls = await Promise.all(list.map(w =>
      (w.isFileImg && w.image) ? thumb(w.image, 'list') : ''
    ));
    if (this.data.wishes !== list) return; // 期间已被新数据替换，放弃本次写入
    list.forEach((w, i) => {
      if (urls[i]) w.imageThumb = urls[i];
    });
    this.setData({ wishes: list });
    this.applyFilter();
  },

  // 缩略图加载失败：兜底回原图，避免空白
  onThumbErr(e) {
    const id = e.currentTarget.dataset.id;
    const target = this.data.wishes.find(w => w._id === id);
    if (!target || target.thumbFailed || !target.image) return;
    const wishes = this.data.wishes.map(w =>
      w._id === id ? { ...w, imageThumb: w.image, thumbFailed: true } : w
    );
    this.setData({ wishes }, () => this.applyFilter());
  },

  applyFilter() {
    const tab = this.data.activeTab;
    // 已排序，筛选后保持顺序
    const filtered = tab === '全部'
      ? this.data.wishes
      : this.data.wishes.filter(w => w.status === tab);
    this.setData({ filteredWishes: filtered });
  },

  onTabChange(e) {
    this.setData({ activeTab: e.currentTarget.dataset.key }, () => this.applyFilter());
  },

  onOpenAdd() {
    const defaultType = this.data.user.role === 'boss' ? '老婆的' : '老公的';
    this.setData({
      showForm: true,
      isEdit: false,
      editingId: '',
      form: {
        title: '', description: '', budget: '',
        image: '🎁', isFileImg: false,
        status: '待实现', type: defaultType, link: ''
      }
    });
  },

  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    const w = this.data.wishes.find(x => x._id === id);
    if (!w) return;
    const img = w.image || '🎁';
    this.setData({
      showForm: true,
      isEdit: true,
      editingId: id,
      form: {
        title: w.title || '',
        description: w.description || '',
        budget: w.budget ? String(w.budget) : '',
        image: img,
        isFileImg: isFileImg(img),
        status: w.status || '待实现',
        type: w.type || '',
        link: w.link || ''
      }
    });
  },

  async onUploadImage() {
    try {
      const fileID = await chooseAndUpload({ type: 'wish' });
      if (!fileID) return;
      this.setData({ 'form.image': fileID, 'form.isFileImg': true });
      wx.showToast({ title: '已上传', icon: 'success' });
    } catch (e) {
      if (e && e.errMsg && e.errMsg.indexOf('cancel') > -1) return;
      wx.showToast({ title: '上传失败', icon: 'none' });
    }
  },

  onClearImage() {
    this.setData({ 'form.image': '🎁', 'form.isFileImg': false });
  },

  onCloseForm() {
    this.setData({ showForm: false });
  },

  onTitleInput(e) { this.setData({ 'form.title': e.detail.value }); },
  onDescInput(e) { this.setData({ 'form.description': e.detail.value }); },
  onBudgetInput(e) { this.setData({ 'form.budget': e.detail.value }); },
  onLinkInput(e) { this.setData({ 'form.link': e.detail.value }); },
  onPickIcon(e) { this.setData({ 'form.image': e.currentTarget.dataset.icon }); },
  onPickType(e) { this.setData({ 'form.type': e.currentTarget.dataset.value }); },
  onPickStatus(e) { this.setData({ 'form.status': e.currentTarget.dataset.value }); },

  async onSubmit() {
    const { title, description, budget, image, status, type } = this.data.form;
    const link = (this.data.form.link || '').trim();
    if (!title.trim()) {
      wx.showToast({ title: '请填写心愿名称', icon: 'none' });
      return;
    }
    if (link.length > MAX_LINK) {
      wx.showToast({ title: `链接不能超过${MAX_LINK}字`, icon: 'none' });
      return;
    }
    const pass = await checkText(`${title} ${description}`);
    if (!pass) {
      wx.showToast({ title: '内容包含违规文字', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      if (this.data.isEdit) {
        await api('wish', 'update', {
          id: this.data.editingId, title, description, budget, image, status, type, link
        }, { loadingText: '保存中' });
        wx.showToast({ title: '已保存', icon: 'success' });
      } else {
        await api('wish', 'add', { title, description, budget, image, status, type, link }, { loadingText: '创建中' });
        wx.showToast({ title: '已添加', icon: 'success' });
      }
      this.setData({ showForm: false, submitting: false });
      this.loadWishes(false); // 新增/编辑后拉最新，避免旧缓存闪回
    } catch (e) {
      this.setData({ submitting: false });
    }
  },

  // 卡片状态 picker 切换
  async onStatusChange(e) {
    const id = e.currentTarget.dataset.id;
    const idx = e.detail.value;
    const newStatus = STATUS_OPTIONS[idx];
    try {
      await api('wish', 'update', { id, status: newStatus }, { loadingText: '更新中' });
      // 本地更新
      const wishes = this.data.wishes.map(w =>
        w._id === id ? { ...w, status: newStatus, statusEmoji: STATUS_EMOJI[newStatus], statusKey: STATUS_KEY[newStatus] } : w
      );
      // 重排序：已收到底
      wishes.sort((a, b) => {
        const aDone = a.status === '已收到' ? 1 : 0;
        const bDone = b.status === '已收到' ? 1 : 0;
        return aDone - bDone;
      });
      this.setData({ wishes });
      this.applyFilter();
      if (newStatus === '已收到') {
        this.showPopAnim('🎉');
      } else {
        wx.showToast({ title: '已更新', icon: 'none' });
      }
    } catch (e) {}
  },

  async onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const res = await new Promise(resolve => {
      wx.showModal({
        title: '删除心愿',
        content: '确定删除这个心愿吗？',
        confirmColor: '#FF6B9D',
        success: r => resolve(r.confirm)
      });
    });
    if (!res) return;
    try {
      await api('wish', 'delete', { id }, { loadingText: '删除中' });
      const wishes = this.data.wishes.filter(w => w._id !== id);
      this.setData({ wishes });
      this.applyFilter();
      wx.showToast({ title: '已删除', icon: 'success' });
    } catch (e) {}
  },

  // 复制心愿链接（商品链接或口令）
  onCopyLink(e) {
    const link = (e.currentTarget.dataset.link || '').trim();
    if (!link) return;
    if (link.length > MAX_LINK) {
      wx.showToast({ title: `链接不能超过${MAX_LINK}字`, icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: link,
      success: () => {
        wx.showModal({
          title: '已复制',
          content: '链接已复制，打开浏览器即可查看',
          showCancel: false,
          confirmText: '知道啦',
          confirmColor: '#FF80AB'
        });
      },
      fail: () => {
        wx.showToast({ title: '复制失败，请重试', icon: 'none' });
      }
    });
  },

  showPopAnim(emoji) {
    this.setData({ showPop: true, popEmoji: emoji });
    setTimeout(() => this.setData({ showPop: false }), 600);
  },

  ...inputHelper
});
