// utils/request.js
// 后端 HTTP 统一调用 + 云开发数据结构翻译层
// 页面仍按云开发风格调用 api(module, action, params, opts)，本文件负责：
//   1) 拼 HTTP 请求（路径 / 参数 / 鉴权头）
//   2) 处理统一信封 { code, msg, data }
//   3) 把后端返回的数据翻译成页面期望的形状（_id / category / image / familyCode / role 字符串等）

// 后端地址按小程序运行环境切换，避免每次发版前手改代码（也避免把测试地址带上线）
// develop = 开发者工具 / 真机调试，trial = 体验版，release = 正式版
// 注意：真机要求 HTTPS + ICP 备案域名，并在公众平台登记 request 合法域名；
//      开发者工具的「不校验合法域名」只对工具本身生效，真机一定失败。
const API_HOSTS = {
  develop: 'http://localhost:8080',
  trial: 'https://api.example.com',    // TODO 换成你的备案域名（体验版）
  release: 'https://api.example.com'   // TODO 换成你的备案域名（正式版）
};

function resolveBaseUrl() {
  try {
    const envVersion = wx.getAccountInfoSync().miniProgram.envVersion;
    return API_HOSTS[envVersion] || API_HOSTS.release;
  } catch (e) {
    return API_HOSTS.release;
  }
}

const BASE_URL = resolveBaseUrl();
const TOKEN_KEY = 'token';
const USER_KEY = 'user_info';
const LOGIN_PAGE = '/pages/login/login';

// 未登录跳转防重入
let redirecting = false;

// 当前页面路径（含 query 时只取路径部分）
function currentRoute() {
  const pages = getCurrentPages();
  if (!pages.length) return '';
  return '/' + pages[pages.length - 1].route;
}

// 401：清登录态并跳登录页（已在登录页则跳过，避免启动时无限跳）
function handleUnauthorized() {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(USER_KEY);
  if (redirecting) return;
  if (currentRoute() === LOGIN_PAGE) return;
  redirecting = true;
  wx.reLaunch({
    url: LOGIN_PAGE,
    complete: () => {
      setTimeout(() => { redirecting = false; }, 500);
    }
  });
}

/**
 * 底层 HTTP 请求
 * @param {string} method GET / POST ...
 * @param {string} path 以 / 开头
 * @param {object} data 请求体 / query
 * @param {object} opts { showLoading=true, loadingText='加载中' }
 * @returns {Promise<any>} resolve 信封中的 data；失败已弹提示并 reject
 */
function request(method, path, data = {}, opts = {}) {
  const { showLoading = true, loadingText = '加载中' } = opts || {};
  if (showLoading) {
    wx.showLoading({ title: loadingText, mask: true });
  }
  return new Promise((resolve, reject) => {
    const header = { 'Content-Type': 'application/json' };
    const token = wx.getStorageSync(TOKEN_KEY);
    if (token) header.Authorization = 'Bearer ' + token;

    wx.request({
      url: BASE_URL + path,
      method,
      data,
      header,
      success: (res) => {
        if (showLoading) wx.hideLoading();
        const body = res.data || {};
        // 未登录 / 过期
        if (res.statusCode === 401 || body.code === 401) {
          handleUnauthorized();
          reject(body);
          return;
        }
        if (body.code === 0) {
          resolve(body.data);
        } else {
          wx.showToast({ title: body.msg || '请求失败', icon: 'none' });
          reject(body);
        }
      },
      fail: (err) => {
        if (showLoading) wx.hideLoading();
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
        reject(err);
      }
    });
  });
}

// ===== 形状转换 =====
function toDish(d) {
  if (!d) return null;
  return {
    _id: d.id,
    id: d.id,
    name: d.name,
    category: d.category || '',
    image: d.imageUrl || '',
    price: d.price
  };
}

function toOrder(o) {
  if (!o) return null;
  return {
    _id: o.id,
    id: o.id,
    dishId: o.dishId,
    name: o.dishName,
    dishName: o.dishName,
    price: o.price,
    orderDate: o.orderDate,
    status: o.status === 1 ? 'done' : 'pending',
    dish: { _id: o.dishId, name: o.dishName }
  };
}

function toFamily(f) {
  if (!f) return null;
  return {
    _id: f.familyId,
    familyId: f.familyId,
    name: f.name,
    familyCode: f.inviteCode,
    inviteCode: f.inviteCode,
    status: f.status,
    categories: f.categories || [],
    loveStartDate: f.loveStartDate || '',
    anniversaryDate: f.anniversaryDate || '',
    coverImage: f.coverImage || '',
    pageBg: f.pageBg || ''
  };
}

function toUser(u) {
  if (!u) return null;
  const id = u.id != null ? u.id : u.userId;
  let role = null;
  if (u.role === 1) role = 'boss';
  else if (u.role === 2) role = 'manager';
  return {
    id,
    userId: id,
    openid: u.openid,
    nickname: u.nickname,
    avatar: u.avatar,
    familyId: u.familyId,
    role
  };
}

// ===== 心愿 / 心情 / 生理期 / 备忘录 形状转换 =====
function toWish(w) {
  if (!w) return null;
  return {
    _id: w.id,
    id: w.id,
    title: w.title,
    description: w.description || '',
    budget: w.budget,
    type: w.type || '',
    link: w.linkUrl || '',
    image: w.imageUrl || '',
    status: w.status === 1 ? '已收到' : '待实现',
    creatorRole: w.creatorRole === 1 ? 'boss' : (w.creatorRole === 2 ? 'manager' : undefined),
    createdAt: w.createdAt
  };
}

function toMood(m) {
  if (!m) return null;
  return {
    _id: m.id,
    id: m.id,
    userId: m.userId,
    role: m.role === 1 ? 'boss' : (m.role === 2 ? 'manager' : undefined),
    mood: m.moodType,
    note: m.content || '',
    date: m.moodDate,
    moodDate: m.moodDate,
    createdAt: m.createdAt
  };
}

function toPeriod(p) {
  if (!p) return null;
  return {
    _id: p.id,
    id: p.id,
    periodDate: p.periodDate,
    date: p.periodDate,
    note: p.note || '',
    createdAt: p.createdAt
  };
}

function toMemo(m) {
  if (!m) return null;
  return {
    _id: m.id,
    id: m.id,
    title: m.title || '',
    content: m.content,
    color: m.color || 'yellow',
    category: m.category || '其他',
    isTodo: m.isTodo === 1,
    isCompleted: m.done === 1,
    creatorRole: m.creatorRole === 1 ? 'boss' : (m.creatorRole === 2 ? 'manager' : undefined),
    createdAt: m.createdAt
  };
}

// ===== 打卡目标 形状转换 =====
function toGoal(g) {
  if (!g) return null;
  return {
    _id: g.id,
    id: g.id,
    title: g.title,
    description: g.description || '',
    icon: g.icon || '🎯',
    mode: g.mode,
    frequency: g.frequency || '每天',
    duration: g.duration || 0,
    startDate: g.startDate || '',
    endDate: g.endDate || '',
    goalDate: g.goalDate || '',
    status: g.status === 1 ? 'completed' : (g.status === 0 ? 'ongoing' : 'pending'),
    progress: g.progress || 0,
    stages: g.stages || [],
    checkedDays: g.checkedDays || 0,
    todayChecked: !!g.todayChecked,
    todayAnyChecked: !!g.todayAnyChecked,
    createdAt: g.createdAt
  };
}

// 本地时区今天 YYYY-MM-DD
function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// 未接入后端的 action：统一 toast 并 reject
function unsupported(moduleName, action) {
  wx.showToast({ title: '该功能暂未接入后端', icon: 'none' });
  return Promise.reject({ code: -1, msg: '该功能暂未接入后端', module: moduleName, action });
}

// order.batchAdd：逐个下单；成功进 added，被 1008 进 skipped，其它错误抛出
async function batchAdd(params, opts = {}) {
  const { showLoading = true, loadingText = '加载中' } = opts || {};
  const dishIds = (params && params.dishIds) || [];
  if (showLoading) wx.showLoading({ title: loadingText, mask: true });
  const added = [];
  const skipped = [];
  try {
    for (let i = 0; i < dishIds.length; i++) {
      const dishId = dishIds[i];
      try {
        const data = await request('POST', '/order/add', { dishId }, { showLoading: false });
        added.push(toOrder(data));
      } catch (e) {
        if (e && e.code === 1008) {
          skipped.push(dishId);
        } else {
          throw e;
        }
      }
    }
  } finally {
    if (showLoading) wx.hideLoading();
  }
  return { added, skipped };
}

/**
 * 便捷方法：调用某模块某 action（保持云开发调用签名不变）
 * 例：api('dish', 'list', { category: '荤菜' })
 */
function api(moduleName, action, params = {}, opts = {}) {
  const key = moduleName + '.' + action;
  switch (key) {
    // ===== 家庭 =====
    case 'family.getInfo':
      return request('GET', '/family/getInfo', {}, opts).then((data) => {
        const d = data || {};
        return {
          family: toFamily(d.family),
          members: (d.members || []).map((u) => ({
            ...u,
            role: u.role === 1 ? 'boss' : (u.role === 2 ? 'manager' : null)
          }))
        };
      });
    case 'family.create':
      return request('POST', '/family/create', { name: params.name }, opts)
        .then((data) => ({ family: toFamily(data) }));
    case 'family.join':
      return request('POST', '/family/join', { inviteCode: params.familyCode }, opts)
        .then((data) => ({ family: toFamily(data) }));
    case 'family.updateInfo':
      // 只把页面真正传了的字段发给后端，覆盖 categories + 相恋日期/纪念日/封面/背景
      return request('POST', '/family/updateInfo', {
        categories: params.categories,
        loveStartDate: params.loveStartDate,
        anniversaryDate: params.anniversaryDate,
        coverImage: params.coverImage,
        pageBg: params.pageBg
      }, opts);
    case 'family.leave':
      return request('POST', '/family/leave', {}, opts);

    // ===== 菜品 =====
    case 'dish.list':
      return request('GET', '/dish/list', {}, opts).then((list) => {
        const arr = Array.isArray(list) ? list : [];
        const filtered = params.category ? arr.filter((d) => d.category === params.category) : arr;
        return { dishes: filtered.map(toDish) };
      });
    case 'dish.add':
      return request('POST', '/dish/add',
        { name: params.name, category: params.category, imageUrl: params.image }, opts)
        .then(toDish);
    case 'dish.update':
      return request('POST', '/dish/update',
        { id: params.id, name: params.name, category: params.category, imageUrl: params.image }, opts);
    case 'dish.delete':
      return request('POST', '/dish/delete', { id: params.id }, opts);

    // ===== 点菜 =====
    case 'order.add':
      return request('POST', '/order/add', { dishId: params.dishId }, opts).then(toOrder);
    case 'order.today':
      return request('GET', '/order/list', {}, opts).then((list) => {
        const arr = Array.isArray(list) ? list : [];
        const today = todayStr();
        return { orders: arr.filter((o) => o.orderDate === today).map(toOrder) };
      });
    case 'order.batchAdd':
      return batchAdd(params, opts);
    // 历史页调用的是 order.history（带分页参数），后端无分页，两个 action 都映射到同一接口
    case 'order.list':
    case 'order.history':
      return request('GET', '/order/list', {}, opts).then((list) => {
        const arr = Array.isArray(list) ? list : [];
        return { orders: arr.map(toOrder) };
      });
    case 'order.markDone':
      return request('POST', '/order/markDone',
        { orderId: params.orderId, status: params.status === 'done' ? 1 : 0 }, opts);
    case 'order.random':
      return request('GET', '/order/random', {}, opts).then((data) => {
        const dishes = (data && data.dishes) || [];
        return { dishes: dishes.map(toDish) };
      });

    // ===== 登录 / 用户 =====
    case 'auth.login':
      return request('POST', '/auth/login', { code: params.code }, opts).then((data) => ({
        token: data && data.token,
        user: toUser(data)
      }));
    case 'user.me':
      return request('GET', '/user/me', {}, opts).then((data) => ({ user: toUser(data) }));
    case 'user.updateProfile':
      return request('POST', '/user/updateProfile', {
        nickname: params.nickname,
        avatar: params.avatar
      }, opts).then((data) => ({ user: toUser(data) }));
    case 'user.setRole':
      return request('POST', '/user/setRole', {
        role: params.role === 'boss' ? 1 : 2
      }, opts).then((data) => ({ user: toUser(data) }));

    // ===== 心愿清单 =====
    case 'wish.list':
      return request('GET', '/wish/list', {}, opts).then((list) => {
        const arr = Array.isArray(list) ? list : [];
        return { wishes: arr.map(toWish) };
      });
    case 'wish.add':
      return request('POST', '/wish/add', {
        title: params.title,
        description: params.description,
        budget: params.budget === '' ? null : params.budget,
        type: params.type,
        linkUrl: params.link,
        imageUrl: params.image || '',
        status: params.status === '已收到' ? 1 : 0
      }, opts);
    case 'wish.update': {
      // 只把页面真正传了的字段发给后端（卡片上切换状态只传 id + status），
      // 避免把没传的字段覆盖成空值
      const body = { id: params.id };
      if (params.title !== undefined) body.title = params.title;
      if (params.description !== undefined) body.description = params.description;
      if (params.budget !== undefined) body.budget = params.budget === '' ? null : params.budget;
      if (params.type !== undefined) body.type = params.type;
      if (params.link !== undefined) body.linkUrl = params.link;
      if (params.image !== undefined) body.imageUrl = params.image;
      if (params.status !== undefined) body.status = params.status === '已收到' ? 1 : 0;
      return request('POST', '/wish/update', body, opts);
    }
    case 'wish.bought':
      return request('POST', '/wish/bought', { wishId: params.id }, opts);
    case 'wish.delete':
      return request('POST', '/wish/delete', { wishId: params.id }, opts);

    // ===== 心情 =====
    case 'mood.list':
      return request('GET', '/mood/list', {}, opts).then((list) => {
        const arr = Array.isArray(list) ? list : [];
        return { moods: arr.map(toMood) };
      });
    case 'mood.today':
      return request('GET', '/mood/list', {}, opts).then((list) => {
        const arr = Array.isArray(list) ? list : [];
        const today = todayStr();
        return { moods: arr.filter((m) => m.moodDate === today).map(toMood) };
      });
    case 'mood.add':
      return request('POST', '/mood/add',
        { moodType: params.mood, content: params.note }, opts);

    // ===== 打卡 =====
    case 'checkin.status':
      return request('GET', '/checkin/status', {}, opts).then((checked) => ({ checked: !!checked }));
    case 'checkin.do':
      return request('POST', '/checkin/do', {}, opts);

    // ===== 打卡页：目标管理 =====
    case 'checkin.list':
      return request('GET', '/goal/list', {}, opts).then((list) => {
        const arr = Array.isArray(list) ? list : [];
        return { goals: arr.map(toGoal) };
      });
    case 'checkin.add':
      return request('POST', '/goal/add', {
        title: params.title,
        description: params.description,
        icon: params.icon,
        mode: params.mode,
        frequency: params.frequency,
        duration: params.duration,
        startDate: params.startDate,
        goalDate: params.goalDate,
        stages: params.stages
      }, opts);
    case 'checkin.checkin':
      return request('POST', '/goal/checkin', { goalId: params.id }, opts);
    case 'checkin.toggle':
      return request('POST', '/goal/toggle', { goalId: params.id }, opts);
    case 'checkin.toggleStage':
      return request('POST', '/goal/toggleStage',
        { goalId: params.id, stageIndex: params.stageIndex }, opts);
    case 'checkin.delete':
      return request('POST', '/goal/delete', { goalId: params.id }, opts);

    // ===== 生理期 =====
    case 'period.list':
      return request('GET', '/period/list', {}, opts).then((list) => {
        const arr = Array.isArray(list) ? list : [];
        return { periods: arr.map(toPeriod) };
      });
    case 'period.add':
      return request('POST', '/period/add',
        { periodDate: params.periodDate || params.startDate, note: params.note }, opts);

    // ===== 备忘录 =====
    case 'memo.list':
      return request('GET', '/memo/list', {}, opts).then((list) => {
        const arr = Array.isArray(list) ? list : [];
        return { memos: arr.map(toMemo) };
      });
    case 'memo.add':
      return request('POST', '/memo/add', {
        title: params.title,
        content: params.content,
        color: params.color,
        category: params.category,
        isTodo: params.isTodo ? 1 : 0
      }, opts);
    case 'memo.update': {
      // 只把页面真正传了的字段发给后端，避免把没传的字段覆盖成空值
      const body = { id: params.id };
      if (params.title !== undefined) body.title = params.title;
      if (params.content !== undefined) body.content = params.content;
      if (params.color !== undefined) body.color = params.color;
      if (params.category !== undefined) body.category = params.category;
      if (params.isTodo !== undefined) body.isTodo = params.isTodo ? 1 : 0;
      return request('POST', '/memo/update', body, opts);
    }
    case 'memo.toggle':
      return request('POST', '/memo/toggle', { id: params.id }, opts);
    case 'memo.done':
      return request('POST', '/memo/done', { memoId: params.id }, opts);
    case 'memo.delete':
      return request('POST', '/memo/delete', { memoId: params.id }, opts);

    default:
      return unsupported(moduleName, action);
  }
}

module.exports = { request, api, baseURL: BASE_URL };
