// pages/checkin/index.js  打卡规划
const { api } = require('../../utils/request');
const auth = require('../../utils/auth');
const inputHelper = require('../../utils/input');
const { checkText } = require('../../utils/security');

const ICON_OPTIONS = [
  { icon: '🏃', label: '运动' },
  { icon: '📚', label: '学习' },
  { icon: '💧', label: '喝水' },
  { icon: '😴', label: '早睡' },
  { icon: '📖', label: '读书' },
  { icon: '💪', label: '健身' },
  { icon: '🧘', label: '冥想' },
  { icon: '✍️', label: '写作' },
  { icon: '🎯', label: '目标' },
  { icon: '✨', label: '其他' },
  { icon: '🌅', label: '日出' },
  { icon: '✈️', label: '旅行' },
  { icon: '🏠', label: '家' },
  { icon: '🎂', label: '生日' },
  { icon: '💍', label: '对戒' }
];

const DURATION_OPTIONS = [
  { value: 7, label: '7天' },
  { value: 30, label: '30天' },
  { value: 100, label: '100天' }
];

const FREQUENCY_OPTIONS = ['每天', '每周3次', '每周5次'];

const MODE_OPTIONS = [
  { value: 'checkin', label: '每日打卡' },
  { value: 'wish', label: '一次愿望' }
];

const STATUS_TEXT = {
  ongoing: '进行中',
  completed: '已完成',
  pending: '未开始'
};

Page({
  data: {
    user: null,
    goals: [],
    loading: true,
    showAdd: false,
    submitting: false,
    iconOptions: ICON_OPTIONS,
    durationOptions: DURATION_OPTIONS,
    frequencyOptions: FREQUENCY_OPTIONS,
    modeOptions: MODE_OPTIONS,
    form: {
      title: '',
      description: '',
      icon: '🏃',
      frequency: '每天',
      duration: 7,
      startDate: '',
      mode: 'checkin',
      steps: '',
      goalDate: ''
    },
    today: '',
    minDate: '',
    showPop: false,
    popEmoji: '',
    ph: {
      title: '如：每天跑步',
      titleWish: '如：一起去海边看日出',
      description: '如：每天30分钟',
      descriptionWish: '如：约好下个月请假，酒店订在海边',
      steps: '如：选定日子,做好攻略,出发执行'
    }
  },

  // 弹出打卡/完成动画浮层
  showPopAnim(emoji) {
    this.setData({ showPop: true, popEmoji: emoji });
    setTimeout(() => this.setData({ showPop: false }), 600);
  },

  onShow() {
    const user = auth.getUser();
    if (!user || !user.familyId || !user.role) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    const today = this.formatDate(new Date());
    this.setData({ user, today, 'form.startDate': today, 'form.goalDate': today, minDate: today });
    this.loadGoals();
  },

  formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  async loadGoals() {
    this.setData({ loading: true });
    try {
      const { goals } = await api('checkin', 'list', {}, { showLoading: false });
      const list = goals.map(g => {
        const endShort = (g.endDate || '').replace(/-/g, '.').substring(5);
        return {
          ...g,
          statusText: STATUS_TEXT[g.status] || '进行中',
          endDateShort: endShort
        };
      });
      this.setData({ goals: this.sortGoals(list), loading: false });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  // 排序：已完成放最后；未完成里打卡型优先，进度低的优先
  sortGoals(goals) {
    return [...goals].sort((a, b) => {
      const aDone = a.status === 'completed';
      const bDone = b.status === 'completed';
      if (aDone && !bDone) return 1;
      if (bDone && !aDone) return -1;
      if (aDone && bDone) return 0;
      // 都未完成：打卡型（每天要做）优先
      const aCheckin = a.mode === 'checkin';
      const bCheckin = b.mode === 'checkin';
      if (aCheckin && !bCheckin) return -1;
      if (bCheckin && !aCheckin) return 1;
      // 同类型：进度低的优先
      return a.progress - b.progress;
    });
  },

  onOpenAdd() {
    this.setData({ showAdd: true });
  },
  onCloseAdd() {
    this.setData({ showAdd: false });
  },

  onTitleInput(e) {
    this.setData({ 'form.title': e.detail.value });
  },
  onDescInput(e) {
    this.setData({ 'form.description': e.detail.value });
  },
  onStepsInput(e) {
    this.setData({ 'form.steps': e.detail.value });
  },
  onPickIcon(e) {
    this.setData({ 'form.icon': e.currentTarget.dataset.icon });
  },
  onPickDuration(e) {
    this.setData({ 'form.duration': parseInt(e.currentTarget.dataset.value) });
  },
  onPickFrequency(e) {
    this.setData({ 'form.frequency': e.currentTarget.dataset.value });
  },
  onPickMode(e) {
    this.setData({ 'form.mode': e.currentTarget.dataset.value });
  },
  onStartDateChange(e) {
    this.setData({ 'form.startDate': e.detail.value });
  },
  onGoalDateChange(e) {
    this.setData({ 'form.goalDate': e.detail.value });
  },

  async onSubmit() {
    const { title, icon, frequency, duration, startDate, description, mode, steps, goalDate } = this.data.form;
    if (!title.trim()) {
      wx.showToast({ title: '请填写目标名称', icon: 'none' });
      return;
    }
    const pass = await checkText(`${title} ${description} ${steps}`);
    if (!pass) {
      wx.showToast({ title: '内容包含违规文字', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      if (mode === 'wish') {
        // 愿望型：解析 steps（逗号分隔）+ goalDate
        const stageArr = steps.split(/[,，\n]/).map(s => s.trim()).filter(Boolean);
        await api('checkin', 'add', {
          title, description, icon, mode: 'wish',
          stages: stageArr, goalDate, startDate: startDate
        }, { loadingText: '创建中' });
      } else {
        await api('checkin', 'add', {
          title, description, icon, frequency, duration, startDate, mode: 'checkin'
        }, { loadingText: '创建中' });
      }
      this.setData({
        showAdd: false,
        submitting: false,
        'form.title': '',
        'form.description': '',
        'form.steps': ''
      });
      wx.showToast({ title: '已创建', icon: 'success' });
      this.loadGoals();
    } catch (e) {
      this.setData({ submitting: false });
    }
  },

  // 点卡片：打卡型=今日打卡/取消；愿望型=有步骤则提示逐步勾选，无步骤才一键完成
  async onCheckin(e) {
    const id = e.currentTarget.dataset.id;
    const idx = this.data.goals.findIndex(g => g._id === id);
    if (idx < 0) return;
    const goal = this.data.goals[idx];

    // 愿望型：有步骤时逐个勾选（点步骤行）；无步骤才一键完成
    if (goal.mode === 'wish') {
      if (goal.stages && goal.stages.length > 0) {
        if (goal.status === 'completed') {
          wx.showToast({ title: '已完成啦 🎉', icon: 'none' });
        } else {
          wx.showToast({ title: '点击步骤，逐项完成', icon: 'none' });
        }
        return;
      }
      try {
        const res = await api('checkin', 'toggle', { id }, { loadingText: '处理中' });
        const goals = this.data.goals;
        goals[idx] = {
          ...goal,
          status: res.status,
          statusText: STATUS_TEXT[res.status] || '未开始',
          progress: res.progress,
          stages: res.stages
        };
        this.setData({ goals: this.sortGoals(goals) });
        if (res.action === 'complete') {
          this.showPopAnim('🎉');
          wx.showToast({ title: '完成啦', icon: 'none' });
        } else {
          wx.showToast({ title: '已取消完成', icon: 'none' });
        }
      } catch (e) {}
      return;
    }

    // 打卡型
    if (goal.status === 'completed') {
      wx.showToast({ title: '已完成啦 🎉', icon: 'none' });
      return;
    }
    try {
      const res = await api('checkin', 'checkin', { id }, { loadingText: '打卡中' });
      const goals = this.data.goals;
      goals[idx] = {
        ...goal,
        checkedDays: res.checkedDays,
        progress: res.progress,
        status: res.status,
        statusText: STATUS_TEXT[res.status] || '进行中',
        todayChecked: res.todayChecked,
        todayAnyChecked: res.todayAnyChecked
      };
      this.setData({ goals: this.sortGoals(goals) });
      if (res.action === 'checkin') {
        this.showPopAnim('💖');
        wx.showToast({ title: '打卡成功', icon: 'none' });
      } else {
        wx.showToast({ title: '已取消', icon: 'none' });
      }
    } catch (e) {}
  },

  // 点步骤行：愿望型逐个勾选步骤（阻止冒泡，不触发行卡点击）
  async onStageTap(e) {
    const { id, index } = e.currentTarget.dataset;
    const goalIdx = this.data.goals.findIndex(g => g._id === id);
    if (goalIdx < 0) return;
    const goal = this.data.goals[goalIdx];
    if (goal.mode !== 'wish') return;
    try {
      const res = await api('checkin', 'toggleStage', { id, stageIndex: index }, { loadingText: '处理中' });
      const goals = this.data.goals;
      goals[goalIdx] = {
        ...goal,
        status: res.status,
        statusText: STATUS_TEXT[res.status] || '未开始',
        progress: res.progress,
        stages: res.stages
      };
      this.setData({ goals: this.sortGoals(goals) });
      if (res.action === 'complete') {
        this.showPopAnim('🎉');
        wx.showToast({ title: '全部完成啦 🎉', icon: 'none' });
      }
    } catch (e) {}
  },

  async onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const res = await new Promise(resolve => {
      wx.showModal({
        title: '删除目标',
        content: '确定删除这个目标吗？',
        confirmColor: '#FF6B9D',
        success: r => resolve(r.confirm)
      });
    });
    if (!res) return;
    try {
      await api('checkin', 'delete', { id }, { loadingText: '删除中' });
      const goals = this.data.goals.filter(g => g._id !== id);
      this.setData({ goals });
      wx.showToast({ title: '已删除', icon: 'success' });
    } catch (e) {}
  },

  ...inputHelper
});
