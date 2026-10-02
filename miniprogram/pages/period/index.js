// pages/period/index.js  经期管理 - 月历
const { api } = require('../../utils/request');
const auth = require('../../utils/auth');
const inputHelper = require('../../utils/input');

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const FLOW_OPTS = [{ value: '少', label: '少' }, { value: '中', label: '中' }, { value: '多', label: '多' }];
const PAIN_OPTS = [{ value: '无', label: '无' }, { value: '轻', label: '轻' }, { value: '中', label: '中' }, { value: '重', label: '重' }];
const MOOD_OPTS = [
  { value: '开心', label: '开心', emoji: '😊' },
  { value: '平静', label: '平静', emoji: '😌' },
  { value: '烦躁', label: '烦躁', emoji: '😤' },
  { value: '难过', label: '难过', emoji: '😢' }
];
const SYMPTOM_LIST = ['腰酸', '腹痛', '乏力', '胸胀', '头痛', '失眠'];

Page({
  data: {
    user: null,
    isWife: false,
    tip: '',
    calendarMonth: '',
    calendarMonthText: '',
    calendarYearText: '',
    weekdays: WEEKDAYS,
    calendarDays: [],
    showRecord: false,
    submitting: false,
    hasHistory: false,
    recordForm: {
      startDate: '',
      endDate: '',
      flow: '',
      pain: '',
      mood: '',
      symptoms: [],
      note: ''
    },
    flowOpts: FLOW_OPTS,
    painOpts: PAIN_OPTS,
    moodOpts: MOOD_OPTS,
    symptomOpts: SYMPTOM_LIST.map(v => ({ value: v, checked: false })),
    ph: { note: '想说点啥...' }
  },

  onShow() {
    const user = auth.getUser();
    if (!user || !user.familyId || !user.role) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    const now = new Date();
    this.setData({
      user,
      isWife: user.role === 'boss',
      calendarMonth: `${now.getFullYear()}-${now.getMonth() + 1}`
    });
    this.loadPeriods();
  },

  async loadPeriods() {
    try {
      const { periods } = await api('period', 'list', {}, { showLoading: false });
      this.periods = periods || [];
      this.setData({ hasHistory: this.periods.length > 0 });
      this.buildCalendar();
      this.buildTip();
    } catch (e) {
      this.periods = [];
      this.buildCalendar();
    }
  },

  fmtDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  parseDate(s) {
    return new Date(s + 'T00:00:00');
  },

  // 基于历史记录预测下次经期/排卵期
  computePrediction() {
    if (!this.periods || this.periods.length === 0) return null;
    const sorted = [...this.periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const latest = sorted[sorted.length - 1];
    const lastStart = this.parseDate(latest.startDate);

    // 周期：两条以上取差值，否则默认 28
    let cycle = 28;
    if (sorted.length >= 2) {
      const prev = this.parseDate(sorted[sorted.length - 2].startDate);
      const diff = Math.round((lastStart - prev) / 86400000);
      if (diff >= 21 && diff <= 45) cycle = diff;
    }

    // 经期长度：有 endDate 用之，否则默认 5
    let periodLen = 5;
    if (latest.endDate) {
      const end = this.parseDate(latest.endDate);
      const len = Math.round((end - lastStart) / 86400000) + 1;
      if (len >= 2 && len <= 10) periodLen = len;
    }

    const nextStart = new Date(lastStart.getTime() + cycle * 86400000);
    const nextEnd = new Date(nextStart.getTime() + (periodLen - 1) * 86400000);
    const ovulationDay = new Date(nextStart.getTime() - 14 * 86400000);
    const ovulationStart = new Date(ovulationDay.getTime() - 5 * 86400000);
    const ovulationEnd = new Date(ovulationDay.getTime() - 1 * 86400000);

    return {
      nextStart: this.fmtDate(nextStart),
      nextEnd: this.fmtDate(nextEnd),
      ovulationStart: this.fmtDate(ovulationStart),
      ovulationEnd: this.fmtDate(ovulationEnd),
      ovulationDay: this.fmtDate(ovulationDay)
    };
  },

  eachDay(startStr, endStr, cb) {
    const s = this.parseDate(startStr);
    const e = this.parseDate(endStr);
    for (let d = new Date(s); d <= e; d = new Date(d.getTime() + 86400000)) {
      cb(this.fmtDate(d));
    }
  },

  buildCalendar() {
    const [year, month] = this.data.calendarMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    // 周一为第一列
    const firstWeekday = (firstDay.getDay() + 6) % 7;
    const daysInMonth = lastDay.getDate();

    // 已记录经期：按日期展开
    const periodMap = {};
    this.periods.forEach(p => {
      if (!p.startDate) return;
      const s = this.parseDate(p.startDate);
      const e = p.endDate ? this.parseDate(p.endDate) : new Date(s.getTime() + 4 * 86400000);
      for (let d = new Date(s); d <= e; d = new Date(d.getTime() + 86400000)) {
        periodMap[this.fmtDate(d)] = p;
      }
    });

    const pred = this.computePrediction();
    const predSet = new Set();
    const ovuSet = new Set();
    const ovuDaySet = new Set();
    if (pred) {
      this.eachDay(pred.nextStart, pred.nextEnd, ds => predSet.add(ds));
      this.eachDay(pred.ovulationStart, pred.ovulationEnd, ds => ovuSet.add(ds));
      ovuDaySet.add(pred.ovulationDay);
    }

    const todayStr = this.fmtDate(new Date());

    const days = [];
    for (let i = 0; i < firstWeekday; i++) days.push({ empty: true });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      let status = '';
      if (periodMap[dateStr]) status = 'period';
      else if (predSet.has(dateStr)) status = 'predicted_period';
      else if (ovuDaySet.has(dateStr)) status = 'ovulation_day';
      else if (ovuSet.has(dateStr)) status = 'ovulation';
      days.push({
        date: d,
        dateStr,
        isToday: dateStr === todayStr,
        status
      });
    }

    this.setData({
      calendarDays: days,
      calendarMonthText: `${month}月`,
      calendarYearText: `${year}年`
    });
  },

  buildTip() {
    if (this.data.isWife) {
      this.setData({ tip: '' });
      return;
    }
    if (!this.periods || this.periods.length === 0) {
      this.setData({ tip: '老婆还没记录经期，等她记录后会提醒你哦~' });
      return;
    }
    const todayStr = this.fmtDate(new Date());
    const t = this.parseDate(todayStr);

    // 今天是否在已记录经期中
    const inPeriod = this.periods.find(p => {
      if (!p.startDate) return false;
      const s = this.parseDate(p.startDate);
      const e = p.endDate ? this.parseDate(p.endDate) : new Date(s.getTime() + 4 * 86400000);
      return t >= s && t <= e;
    });
    if (inPeriod) {
      const s = this.parseDate(inPeriod.startDate);
      const day = Math.round((t - s) / 86400000) + 1;
      this.setData({ tip: `老婆今天是经期第${day}天，记得让她多喝热水，不要惹她生气哦` });
      return;
    }

    const pred = this.computePrediction();
    if (pred) {
      const ovuStart = this.parseDate(pred.ovulationStart);
      const ovuEnd = this.parseDate(pred.ovulationEnd);
      if (t >= ovuStart && t <= ovuEnd) {
        this.setData({ tip: '老婆今天是排卵期，注意休息' });
        return;
      }
      const nextStart = this.parseDate(pred.nextStart);
      const days = Math.round((nextStart - t) / 86400000);
      if (days > 0 && days <= 7) {
        this.setData({ tip: `老婆还有${days}天来大姨妈，提前准备好红糖姜茶` });
        return;
      }
    }
    this.setData({ tip: '老婆近期状态平稳，好好陪伴她吧~' });
  },

  onPrevMonth() {
    const [y, m] = this.data.calendarMonth.split('-').map(Number);
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${m - 1}`;
    this.setData({ calendarMonth: prev }, () => this.buildCalendar());
  },
  onNextMonth() {
    const [y, m] = this.data.calendarMonth.split('-').map(Number);
    const next = m === 12 ? `${y + 1}-1` : `${y}-${m + 1}`;
    this.setData({ calendarMonth: next }, () => this.buildCalendar());
  },
  onPickMonth(e) {
    this.setData({ calendarMonth: e.detail.value }, () => this.buildCalendar());
  },

  openRecord() {
    if (!this.data.isWife) {
      wx.showToast({ title: '只有老婆可以记录哦', icon: 'none' });
      return;
    }
    const todayStr = this.fmtDate(new Date());
    const symptomOpts = this.data.symptomOpts.map(s => ({ ...s, checked: false }));
    this.setData({
      showRecord: true,
      symptomOpts,
      recordForm: {
        startDate: todayStr,
        endDate: '',
        flow: '',
        pain: '',
        mood: '',
        symptoms: [],
        note: ''
      }
    });
  },
  closeRecord() {
    this.setData({ showRecord: false });
  },

  onPickStart(e) {
    this.setData({ 'recordForm.startDate': e.detail.value });
  },
  onPickEnd(e) {
    this.setData({ 'recordForm.endDate': e.detail.value });
  },
  // 单选：flow / pain / mood
  onOptionTap(e) {
    const { field, value } = e.currentTarget.dataset;
    const cur = this.data.recordForm[field];
    this.setData({ [`recordForm.${field}`]: cur === value ? '' : value });
  },
  // 多选：症状
  onSymptomTap(e) {
    const v = e.currentTarget.dataset.value;
    const arr = this.data.symptomOpts.map(item =>
      item.value === v ? { ...item, checked: !item.checked } : item
    );
    this.setData({
      symptomOpts: arr,
      'recordForm.symptoms': arr.filter(i => i.checked).map(i => i.value)
    });
  },
  onNoteInput(e) {
    this.setData({ 'recordForm.note': e.detail.value });
  },

  async onSave() {
    if (this.data.submitting) return;
    const f = this.data.recordForm;
    if (!f.startDate) {
      wx.showToast({ title: '请选择开始日期', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await api('period', 'add', f, { loadingText: '保存中' });
      wx.showToast({ title: '记录成功', icon: 'success' });
      this.setData({ showRecord: false, submitting: false });
      this.loadPeriods();
    } catch (e) {
      this.setData({ submitting: false });
    }
  },

  showLegendHelp() {
    wx.showModal({
      title: '图例说明',
      content: '粉色实心：经期\n粉色斜纹：预测经期\n蓝色斜纹：排卵期\n紫色斜纹：排卵日\n红色圈：今天\n\n预测基于历史记录自动计算，仅供参考。',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#ff6b9d'
    });
  },

  ...inputHelper
});
