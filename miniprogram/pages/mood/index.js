// pages/mood/index.js  心情打卡主页 - 月历
const { api } = require('../../utils/request');
const auth = require('../../utils/auth');

const MOOD_MAP = {
  '平静': '😌',
  '生气': '😤',
  '开心': '😄',
  '心动': '🥰',
  '伤心': '😢',
  '疲惫': '😴'
};

const MOOD_COLOR = {
  '平静': '#a8d4f0',
  '生气': '#f5a3a3',
  '开心': '#ffd6e7',
  '心动': '#ffc0cb',
  '伤心': '#a8d4f0',
  '疲惫': '#d4b8e8'
};

// 老婆圆形表情图片
const MOOD_WIFE_IMG = {
  '平静': '/images/mood/calm_wife.webp',
  '生气': '/images/mood/angry_wife.webp',
  '开心': '/images/mood/happy_wife.webp',
  '心动': '/images/mood/love_wife.webp',
  '伤心': '/images/mood/sad_wife.webp',
  '疲惫': '/images/mood/tired_wife.webp'
};

// 老公正方形表情图片
const MOOD_HUSBAND_IMG = {
  '平静': '/images/mood/calm_husband.webp',
  '生气': '/images/mood/angry_husband.webp',
  '开心': '/images/mood/happy_husband.webp',
  '心动': '/images/mood/love_husband.webp',
  '伤心': '/images/mood/sad_husband.webp',
  '疲惫': '/images/mood/tired_husband.webp'
};

Page({
  data: {
    user: null,
    wifeMood: {},
    husbandMood: {},
    calendarMonth: '',
    calendarMonthText: '',
    calendarYearText: '',
    weekdays: ['一', '二', '三', '四', '五', '六', '日'],
    calendarDays: []
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
      calendarMonth: `${now.getFullYear()}-${now.getMonth() + 1}`
    });
    this.loadToday();
    this.loadCalendar();
  },

  async loadToday() {
    try {
      const { moods } = await api('mood', 'today', {}, { showLoading: false });
      const wife = moods.find(m => m.role === 'boss') || {};
      const husband = moods.find(m => m.role === 'manager') || {};
      if (wife.mood) {
        wife.moodEmoji = MOOD_MAP[wife.mood] || '';
        wife.moodImg = MOOD_WIFE_IMG[wife.mood] || '';
      }
      if (husband.mood) {
        husband.moodEmoji = MOOD_MAP[husband.mood] || '';
        husband.moodImg = MOOD_HUSBAND_IMG[husband.mood] || '';
      }
      this.setData({ wifeMood: wife, husbandMood: husband });
    } catch (e) {}
  },

  async loadCalendar() {
    try {
      const { moods } = await api('mood', 'list', { days: 60 }, { showLoading: false });
      this.buildCalendar(moods);
    } catch (e) {
      this.buildCalendar([]);
    }
  },

  buildCalendar(moods) {
    const [year, month] = this.data.calendarMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    // 周一是第一列：周日(0)→6, 周一(1)→0, ... 周六(6)→5
    const firstWeekday = (firstDay.getDay() + 6) % 7;
    const daysInMonth = lastDay.getDate();

    const moodMap = {};
    moods.forEach(m => {
      if (!moodMap[m.date]) moodMap[m.date] = {};
      moodMap[m.date][m.role] = m;
    });

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const days = [];
    for (let i = 0; i < firstWeekday; i++) {
      days.push({ empty: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayMoods = moodMap[dateStr] || {};
      const wife = dayMoods.boss || null;
      const husband = dayMoods.manager || null;
      days.push({
        date: d,
        dateStr,
        isToday: dateStr === todayStr,
        wifeEmoji: wife ? MOOD_MAP[wife.mood] : '',
        wifeColor: wife ? MOOD_COLOR[wife.mood] : '',
        wifeImg: wife ? MOOD_WIFE_IMG[wife.mood] : '',
        husbandEmoji: husband ? MOOD_MAP[husband.mood] : '',
        husbandColor: husband ? MOOD_COLOR[husband.mood] : '',
        husbandImg: husband ? MOOD_HUSBAND_IMG[husband.mood] : ''
      });
    }

    this.setData({
      calendarDays: days,
      calendarMonthText: `${month}月`,
      calendarYearText: `${year}年`
    });
  },

  onPrevMonth() {
    const [y, m] = this.data.calendarMonth.split('-').map(Number);
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${m - 1}`;
    this.setData({ calendarMonth: prev }, () => this.loadCalendar());
  },

  onNextMonth() {
    const [y, m] = this.data.calendarMonth.split('-').map(Number);
    const next = m === 12 ? `${y + 1}-1` : `${y}-${m + 1}`;
    this.setData({ calendarMonth: next }, () => this.loadCalendar());
  },

  onEditMood() {
    wx.navigateTo({ url: '/pages/mood/edit' });
  }
});
