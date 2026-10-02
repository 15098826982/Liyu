// pages/meal/index.js  干饭模块（温馨可爱动物风 UI，保留原业务逻辑）
const { api } = require('../../utils/request');
const { chooseAndUpload } = require('../../utils/upload');
const auth = require('../../utils/auth');
const inputHelper = require('../../utils/input');
const { checkText } = require('../../utils/security');
const { getTempUrls, thumb } = require('../../utils/img');

const DEFAULT_CATEGORIES = ['荤菜', '素菜'];
const CAT_ICONS = { '荤菜': '🥩', '素菜': '🥬', '汤类': '🍲', '主食': '🍚', '小吃': '🍟' };

Page({
  data: {
    user: null,
    categories: [],
    activeCategory: '',
    dishes: [],
    filteredDishes: [],
    searchKeyword: '',
    searchFocus: false,
    catIcons: CAT_ICONS,
    todayOrderedIds: [],
    cart: [],
    cartIds: [],
    showCart: false,
    showAdd: false,
    showManageCategory: false,
    showRename: false,
    renameOld: '',
    renameNew: '',
    newCategoryName: '',
    submitting: false,
    addForm: { name: '', category: '', image: '' },
    showEdit: false,
    editForm: { id: '', name: '', category: '', image: '' },
    showDelDialog: false,
    deleteTarget: { id: '', name: '' },
    statusBarHeight: 20,
    ph: {
      newCategoryName: '输入新分类名',
      renameNew: '输入新名称',
      addName: '请输入菜名',
      editName: '菜名'
    }
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sysInfo.statusBarHeight || 20 });
  },

  onShow() {
    const user = auth.getUser();
    if (!user || !user.familyId || !user.role) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.setData({ user });
    this.loadCategories();
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.reLaunch({ url: '/pages/home/index' });
    }
  },

  // ===== 搜索 =====
  onSearch(e) {
    const kw = (e.detail.value || '').trim();
    this.setData({
      searchKeyword: kw,
      filteredDishes: this.filterDishes(this.data.dishes, kw)
    });
  },
  onSearchFocus() { this.setData({ searchFocus: true }); },
  onSearchBlur() { this.setData({ searchFocus: false }); },
  filterDishes(list, kw) {
    if (!kw) return list;
    return list.filter(d => (d.name || '').toLowerCase().includes(kw.toLowerCase()));
  },

  // ===== 分类管理 =====
  async loadCategories() {
    try {
      const { family } = await api('family', 'getInfo', {}, { showLoading: false });
      let categories = (family && family.categories) || [];
      if (categories.length === 0) {
        categories = DEFAULT_CATEGORIES.slice();
      }
      // 收集已有菜品的分类，兼容老数据（meat/veg）
      try {
        const { dishes } = await api('dish', 'list', {}, { showLoading: false });
        dishes.forEach(d => {
          if (d.category && !categories.includes(d.category)) {
            categories.push(d.category);
          }
        });
      } catch (e) {}
      // 默认选中"全部"（activeCategory 为空表示显示所有）
      this.setData({ categories, activeCategory: '', searchKeyword: '' }, () => {
        this.loadDishes();
      });
      if (this.data.user.role === 'boss') this.loadToday();
    } catch (e) {
      this.setData({ categories: DEFAULT_CATEGORIES, activeCategory: '', searchKeyword: '' }, () => {
        this.loadDishes();
      });
    }
  },

  async saveCategories(categories) {
    try {
      await api('family', 'updateInfo', { categories }, { showLoading: false });
    } catch (e) {}
  },

  switchCategory(e) {
    const cat = e.currentTarget.dataset.cat;
    // 先清空列表，触发卡片依次滑入动画
    this.setData({ activeCategory: cat, filteredDishes: [], searchKeyword: '' }, () => this.loadDishes());
  },

  // ===== 分类管理 =====
  onShowManageCategory() {
    this.setData({ showManageCategory: true, newCategoryName: '' });
  },
  onHideManageCategory() {
    this.setData({ showManageCategory: false });
  },
  onNewCatInput(e) {
    this.setData({ newCategoryName: e.detail });
  },
  async onAddCategory() {
    const name = (this.data.newCategoryName || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入分类名', icon: 'none' });
      return;
    }
    const categories = this.data.categories.slice();
    if (categories.includes(name)) {
      wx.showToast({ title: '该分类已存在', icon: 'none' });
      return;
    }
    const pass = await checkText(name);
    if (!pass) {
      wx.showToast({ title: '内容包含违规文字', icon: 'none' });
      return;
    }
    categories.push(name);
    this.setData({ categories, newCategoryName: '' });
    await this.saveCategories(categories);
    wx.showToast({ title: '已添加', icon: 'success' });
  },

  // 重命名分类
  onRenameCategory(e) {
    const name = e.currentTarget.dataset.name;
    this.setData({ showRename: true, renameOld: name, renameNew: name });
  },
  onHideRename() {
    this.setData({ showRename: false });
  },
  onRenameInput(e) {
    this.setData({ renameNew: e.detail });
  },
  async onConfirmRename() {
    const { renameOld, renameNew, categories } = this.data;
    const newName = (renameNew || '').trim();
    if (!newName) {
      wx.showToast({ title: '请输入新名称', icon: 'none' });
      return;
    }
    if (newName === renameOld) {
      this.setData({ showRename: false });
      return;
    }
    if (categories.includes(newName)) {
      wx.showToast({ title: '该分类已存在', icon: 'none' });
      return;
    }
    const pass = await checkText(newName);
    if (!pass) {
      wx.showToast({ title: '内容包含违规文字', icon: 'none' });
      return;
    }
    try {
      await api('dish', 'renameCategory', { oldName: renameOld, newName }, { showLoading: false });
      const newCategories = categories.map(c => c === renameOld ? newName : c);
      // 如果当前选中的是被改名的分类，同步更新
      let activeCategory = this.data.activeCategory;
      if (activeCategory === renameOld) activeCategory = newName;
      this.setData({ categories: newCategories, activeCategory, showRename: false });
      await this.saveCategories(newCategories);
      this.loadDishes();
      wx.showToast({ title: '已重命名', icon: 'success' });
    } catch (e) {}
  },

  // 删除分类（该分类下菜品归入全部）
  async onDeleteCategory(e) {
    const name = e.currentTarget.dataset.name;
    const confirm = await new Promise(resolve => {
      wx.showModal({
        title: '删除分类',
        content: `删除"${name}"后，该分类下的菜品会归入"全部"，确认删除？`,
        success: r => resolve(r.confirm)
      });
    });
    if (!confirm) return;
    try {
      await api('dish', 'clearCategory', { name }, { showLoading: false });
      const categories = this.data.categories.filter(c => c !== name);
      let activeCategory = this.data.activeCategory;
      if (activeCategory === name) activeCategory = '';
      this.setData({ categories, activeCategory });
      await this.saveCategories(categories);
      this.loadDishes();
      wx.showToast({ title: '已删除', icon: 'success' });
    } catch (e) {}
  },

  // ===== 菜品列表 =====
  async loadDishes() {
    try {
      const params = this.data.activeCategory ? { category: this.data.activeCategory } : {};
      const { dishes } = await api('dish', 'list', params, { showLoading: false });
      this.setData({
        dishes,
        filteredDishes: this.filterDishes(dishes, this.data.searchKeyword)
      });
      this.applyThumbs(dishes); // 后台补列表缩略图，不阻塞渲染
    } catch (e) {}
  },

  // 列表图按 list 规格取缩略图；image 保留原图（编辑大图用）
  async applyThumbs(list) {
    const ids = list.filter(d => d.image && d.image.indexOf('cloud://') === 0).map(d => d.image);
    if (!ids.length) return;
    await getTempUrls(ids); // 批量转换（一次请求），结果进内存缓存
    const urls = await Promise.all(list.map(d =>
      (d.image && d.image.indexOf('cloud://') === 0) ? thumb(d.image, 'list') : ''
    ));
    if (this.data.dishes !== list) return; // 期间已刷新，放弃本次写入
    list.forEach((d, i) => {
      if (urls[i]) d.imageThumb = urls[i];
    });
    // 已加入清单的项同步缩略图
    const cart = this.data.cart.map(c => {
      const d = list.find(x => x._id === c._id);
      return d && d.imageThumb ? { ...c, imageThumb: d.imageThumb } : c;
    });
    this.setData({
      dishes: list,
      filteredDishes: this.filterDishes(list, this.data.searchKeyword),
      cart
    });
  },

  async loadToday() {
    try {
      const { orders } = await api('order', 'today', {}, { showLoading: false });
      this.setData({ todayOrderedIds: orders.map(o => o.dish && o.dish._id) });
    } catch (e) {}
  },

  // ===== 购物车 =====
  toggleCart(e) {
    const id = e.currentTarget.dataset.id;
    const dish = this.data.dishes.find(d => d._id === id);
    if (!dish) return;
    const cart = this.data.cart.slice();
    const cartIds = this.data.cartIds.slice();
    const idx = cartIds.indexOf(id);
    if (idx > -1) {
      cart.splice(idx, 1);
      cartIds.splice(idx, 1);
      wx.showToast({ title: '已从清单移除', icon: 'none' });
    } else {
      cart.push({ _id: dish._id, name: dish.name, category: dish.category, image: dish.image, imageThumb: dish.imageThumb });
      cartIds.push(dish._id);
      wx.showToast({ title: '已添加到今日清单 🎉', icon: 'none' });
    }
    this.setData({ cart, cartIds });
  },

  onShowCart() {
    if (this.data.cart.length === 0) return;
    this.setData({ showCart: true });
  },
  onHideCart() {
    this.setData({ showCart: false });
  },
  onRemoveFromCart(e) {
    const id = e.currentTarget.dataset.id;
    const cart = this.data.cart.filter(c => c._id !== id);
    const cartIds = this.data.cartIds.filter(cid => cid !== id);
    this.setData({ cart, cartIds, showCart: cart.length > 0 ? this.data.showCart : false });
  },

  async onConfirmOrder() {
    const { cart, submitting } = this.data;
    if (cart.length === 0 || submitting) return;
    this.setData({ submitting: true });
    try {
      const { added, skipped } = await api('order', 'batchAdd', {
        dishIds: cart.map(c => c._id)
      }, { loadingText: '提交中' });
      if (added.length > 0) {
        wx.showToast({ title: `已下单 ${added.length} 道`, icon: 'success' });
      }
      if (skipped.length > 0) {
        setTimeout(() => {
          wx.showToast({ title: `${skipped.length} 道已点过，跳过`, icon: 'none' });
        }, 1500);
      }
      this.setData({ cart: [], cartIds: [], showCart: false });
      this.loadToday();
    } catch (e) {}
    this.setData({ submitting: false });
  },

  // ===== 添加菜品 =====
  toggleAdd() {
    this.setData({ showAdd: !this.data.showAdd, addForm: { name: '', category: this.data.activeCategory || '', image: '' } });
  },
  onAddName(e) {
    this.setData({ 'addForm.name': e.detail });
  },
  onPickCategory(e) {
    this.setData({ 'addForm.category': e.currentTarget.dataset.cat });
  },
  async onChooseDishImage() {
    const fileID = await chooseAndUpload({ type: 'dish' });
    if (fileID) this.setData({ 'addForm.image': fileID });
  },
  onClearDishImage() {
    this.setData({ 'addForm.image': '' });
  },
  async onAddDish() {
    const { name, category, image } = this.data.addForm;
    if (!name.trim()) {
      wx.showToast({ title: '请输入菜名', icon: 'none' });
      return;
    }
    if (!category) {
      wx.showToast({ title: '请选择分类', icon: 'none' });
      return;
    }
    const pass = await checkText(name.trim());
    if (!pass) {
      wx.showToast({ title: '内容包含违规文字', icon: 'none' });
      return;
    }
    try {
      await api('dish', 'add', { name: name.trim(), category, image });
      wx.showToast({ title: '已添加', icon: 'success' });
      this.toggleAdd();
      this.loadDishes();
    } catch (e) {}
  },

  // ===== 编辑菜品 =====
  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    const dish = this.data.dishes.find(d => d._id === id);
    if (!dish) return;
    this.setData({
      showEdit: true,
      editForm: { id: dish._id, name: dish.name, category: dish.category, image: dish.image || '' }
    });
  },
  onHideEdit() {
    this.setData({ showEdit: false });
  },
  onEditName(e) {
    this.setData({ 'editForm.name': e.detail });
  },
  onPickEditCategory(e) {
    this.setData({ 'editForm.category': e.currentTarget.dataset.cat });
  },
  async onChooseEditImage() {
    const fileID = await chooseAndUpload({ type: 'dish' });
    if (fileID) this.setData({ 'editForm.image': fileID });
  },
  onClearEditImage() {
    this.setData({ 'editForm.image': '' });
  },
  async onConfirmEdit() {
    const { id, name, category, image } = this.data.editForm;
    if (!name.trim()) {
      wx.showToast({ title: '请输入菜名', icon: 'none' });
      return;
    }
    const pass = await checkText(name.trim());
    if (!pass) {
      wx.showToast({ title: '内容包含违规文字', icon: 'none' });
      return;
    }
    try {
      await api('dish', 'update', { id, name: name.trim(), category, image });
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ showEdit: false });
      this.loadDishes();
    } catch (e) {}
  },

  // ===== 删除菜品 =====
  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    this.setData({ showDelDialog: true, deleteTarget: { id, name } });
  },
  onCancelDelete() {
    this.setData({ showDelDialog: false });
  },
  async confirmDelete() {
    const { id } = this.data.deleteTarget;
    try {
      await api('dish', 'delete', { id });
      wx.showToast({ title: '已删除', icon: 'success' });
      this.setData({ showDelDialog: false });
      this.loadDishes();
    } catch (e) {}
  },

  ...inputHelper
});
