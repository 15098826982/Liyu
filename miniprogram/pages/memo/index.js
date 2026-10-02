// pages/memo/index.js  共同备忘录（便签墙）
const { api } = require('../../utils/request');
const auth = require('../../utils/auth');
const inputHelper = require('../../utils/input');
const { checkText } = require('../../utils/security');

const COLOR_BG = {
  yellow: '#FFF9C4',
  pink: '#FCE4EC',
  blue: '#E3F2FD',
  green: '#E8F5E9'
};
const COLOR_OPTIONS = [
  { key: 'yellow', label: '黄' },
  { key: 'pink', label: '粉' },
  { key: 'blue', label: '蓝' },
  { key: 'green', label: '绿' }
];
const CATEGORY_OPTIONS = ['生活', '购物', '旅行', '工作', '其他'];
const TABS = ['全部', '生活', '购物', '旅行', '工作', '其他'];
const ROLE_EMOJI = { boss: '👩', manager: '👨' };

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object' && v.$date) return new Date(v.$date);
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') return new Date(v);
  return null;
}

Page({
  data: {
    user: null,
    memos: [],
    leftList: [],
    rightList: [],
    activeTab: '全部',
    tabs: TABS,
    colorOptions: COLOR_OPTIONS,
    categoryOptions: CATEGORY_OPTIONS,
    showForm: false,
    isEdit: false,
    editingId: '',
    submitting: false,
    form: {
      title: '',
      content: '',
      color: 'yellow',
      category: '其他',
      isTodo: true
    },
    ph: {
      title: '如：周末计划',
      content: '写下要记住的事...'
    }
  },

  onShow() {
    const user = auth.getUser();
    if (!user || !user.familyId || !user.role) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.setData({ user });
    this.loadMemos();
  },

  // 排序：未完成在前、已完成在后；同状态按创建时间倒序
  sortMemos(list) {
    return list.sort((a, b) => {
      const ad = a.isCompleted ? 1 : 0;
      const bd = b.isCompleted ? 1 : 0;
      if (ad !== bd) return ad - bd;
      const at = toDate(a.createdAt) ? toDate(a.createdAt).getTime() : 0;
      const bt = toDate(b.createdAt) ? toDate(b.createdAt).getTime() : 0;
      return bt - at;
    });
  },

  async loadMemos() {
    try {
      const { memos } = await api('memo', 'list', {}, { showLoading: false });
      const list = this.sortMemos(memos.map(m => ({
        ...m,
        bgColor: COLOR_BG[m.color] || COLOR_BG.yellow,
        creatorEmoji: ROLE_EMOJI[m.creatorRole] || '👤',
        dateText: this.fmtDate(m.createdAt)
      })));
      this.setData({ memos: list });
      this.applyFilter();
    } catch (e) {}
  },

  fmtDate(v) {
    const d = toDate(v);
    if (!d || isNaN(d)) return '';
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return `${m}.${day}`;
  },

  applyFilter() {
    const tab = this.data.activeTab;
    const filtered = tab === '全部'
      ? this.data.memos
      : this.data.memos.filter(m => m.category === tab);
    // 双列：交替放入
    const left = [], right = [];
    filtered.forEach((m, i) => {
      const item = { ...m, rotate: i % 2 === 0 ? -1.5 : 1.5 };
      if (i % 2 === 0) left.push(item); else right.push(item);
    });
    this.setData({ leftList: left, rightList: right });
  },

  onTabChange(e) {
    this.setData({ activeTab: e.currentTarget.dataset.key }, () => this.applyFilter());
  },

  onOpenAdd() {
    this.setData({
      showForm: true,
      isEdit: false,
      editingId: '',
      form: { title: '', content: '', color: 'yellow', category: '其他', isTodo: true }
    });
  },

  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    const m = this.data.memos.find(x => x._id === id);
    if (!m) return;
    this.setData({
      showForm: true,
      isEdit: true,
      editingId: id,
      form: {
        title: m.title || '',
        content: m.content || '',
        color: m.color || 'yellow',
        category: m.category || '其他',
        isTodo: !!m.isTodo
      }
    });
  },

  onCloseForm() {
    this.setData({ showForm: false });
  },

  onTitleInput(e) { this.setData({ 'form.title': e.detail.value }); },
  onContentInput(e) { this.setData({ 'form.content': e.detail.value }); },
  onPickColor(e) { this.setData({ 'form.color': e.currentTarget.dataset.key }); },
  onPickCategory(e) { this.setData({ 'form.category': e.currentTarget.dataset.value }); },
  onToggleTodo(e) { this.setData({ 'form.isTodo': e.detail }); },

  async onSubmit() {
    const { title, content, color, category, isTodo } = this.data.form;
    if (!content.trim()) {
      wx.showToast({ title: '请填写备忘内容', icon: 'none' });
      return;
    }
    const pass = await checkText(`${title} ${content}`);
    if (!pass) {
      wx.showToast({ title: '内容包含违规文字', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      if (this.data.isEdit) {
        await api('memo', 'update', {
          id: this.data.editingId, title, content, color, category, isTodo
        }, { loadingText: '保存中' });
        wx.showToast({ title: '已保存', icon: 'success' });
      } else {
        await api('memo', 'add', { title, content, color, category, isTodo }, { loadingText: '创建中' });
        wx.showToast({ title: '已添加', icon: 'success' });
      }
      this.setData({ showForm: false, submitting: false });
      this.loadMemos();
    } catch (e) {
      this.setData({ submitting: false });
    }
  },

  async onToggleComplete(e) {
    const id = e.currentTarget.dataset.id;
    const isTodo = e.currentTarget.dataset.istodo;
    if (!isTodo) {
      // 非待办事项不支持切换，提示可去编辑开启
      wx.showToast({ title: '开启待办事项才能标记完成', icon: 'none' });
      return;
    }
    try {
      const { isCompleted } = await api('memo', 'toggle', { id }, { loadingText: '更新中' });
      const memos = this.sortMemos(this.data.memos.map(m =>
        m._id === id ? { ...m, isCompleted, bgColor: COLOR_BG[m.color] } : m
      ));
      this.setData({ memos });
      this.applyFilter();
      wx.showToast({ title: isCompleted ? '已完成' : '已取消', icon: 'none' });
    } catch (e) {}
  },

  async onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const res = await new Promise(resolve => {
      wx.showModal({
        title: '删除备忘录',
        content: '确定删除这张便签吗？',
        confirmColor: '#FF6B9D',
        success: r => resolve(r.confirm)
      });
    });
    if (!res) return;
    try {
      await api('memo', 'delete', { id }, { loadingText: '删除中' });
      const memos = this.data.memos.filter(m => m._id !== id);
      this.setData({ memos });
      this.applyFilter();
      wx.showToast({ title: '已删除', icon: 'success' });
    } catch (e) {}
  },

  ...inputHelper
});
