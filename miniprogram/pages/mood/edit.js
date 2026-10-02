// pages/mood/edit.js  记录/修改心情
const { api } = require('../../utils/request');
const auth = require('../../utils/auth');
const { checkText } = require('../../utils/security');

const MOOD_MAP = {
  '平静': '😌',
  '生气': '😤',
  '开心': '😄',
  '心动': '🥰',
  '伤心': '😢',
  '疲惫': '😴'
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
    todayStr: '',
    moodList: [
      { value: '平静', label: '平静', emoji: '😌', img: '/images/mood/calm_husband.webp' },
      { value: '生气', label: '生气', emoji: '😤', img: '/images/mood/angry_husband.webp' },
      { value: '开心', label: '开心', emoji: '😄', img: '/images/mood/happy_husband.webp' },
      { value: '心动', label: '心动', emoji: '🥰', img: '/images/mood/love_husband.webp' },
      { value: '伤心', label: '伤心', emoji: '😢', img: '/images/mood/sad_husband.webp' },
      { value: '疲惫', label: '疲惫', emoji: '😴', img: '/images/mood/tired_husband.webp' }
    ],
    selectedMood: '',
    submitting: false,
    wifeMood: {},
    husbandMood: {},
    myMood: null
  },

  onLoad() {
    const user = auth.getUser();
    if (!user || !user.familyId || !user.role) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    const now = new Date();
    const todayStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    // 按当前用户角色切换心情选项的表情图（老婆=圆形, 老公=方形）
    const imgMap = user.role === 'boss' ? MOOD_WIFE_IMG : MOOD_HUSBAND_IMG;
    const moodList = this.data.moodList.map(item => ({
      ...item,
      img: imgMap[item.value]
    }));
    this.setData({ user, todayStr, moodList });
    this.loadToday();
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

      const myRole = this.data.user.role;
      const myMood = moods.find(m => m.role === myRole) || null;

      this.setData({
        wifeMood: wife,
        husbandMood: husband,
        myMood,
        selectedMood: myMood ? myMood.mood : ''
      });
    } catch (e) {}
  },

  onSelectMood(e) {
    this.setData({ selectedMood: e.currentTarget.dataset.value });
  },

  async onSave() {
    const { selectedMood, submitting } = this.data;
    if (!selectedMood) {
      wx.showToast({ title: '请选择心情', icon: 'none' });
      return;
    }
    if (submitting) return;
    const note = '';
    const pass = await checkText(note);
    if (!pass) {
      wx.showToast({ title: '内容包含违规文字', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await api('mood', 'add', { mood: selectedMood, note }, { loadingText: '打卡中' });
      wx.showToast({ title: '打卡成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (e) {}
    this.setData({ submitting: false });
  }
});
