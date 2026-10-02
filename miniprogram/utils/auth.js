// utils/auth.js
// 登录态管理 + 按用户状态统一路由
const { api } = require('./request');

const USER_KEY = 'user_info';

// 引导流程各步骤页面
const ROUTES = {
  login: '/pages/login/login',
  create: '/pages/family/create',
  join: '/pages/family/join',
  role: '/pages/role/select',
  home: '/pages/home/index'
};

function getUser() {
  return wx.getStorageSync(USER_KEY) || null;
}

function setUser(user) {
  wx.setStorageSync(USER_KEY, user || null);
}

function clearUser() {
  wx.removeStorageSync(USER_KEY);
}

// 拉取服务端最新 user 并写入本地缓存（避免本地缓存与服务端不一致）
async function fetchUser() {
  const { user } = await api('user', 'login', {}, { showLoading: false });
  if (user) setUser(user);
  return user || null;
}

// 根据用户状态计算目标页：无 familyId→创建页；有 familyId 无 role→身份选择页；都有→首页
function routeOf(user) {
  if (!user) return ROUTES.login;
  if (!user.familyId) return ROUTES.create;
  if (!user.role) return ROUTES.role;
  return ROUTES.home;
}

// 当前页面路径（含 query 时只取路径部分）
function currentRoute() {
  const pages = getCurrentPages();
  if (!pages.length) return '';
  return '/' + pages[pages.length - 1].route;
}

// 引导流程统一用 reLaunch 跳转，保证不残留返回栈（系统返回键就不会退回首页）
function go(url) {
  const path = url.split('?')[0];
  if (currentRoute() === path && url.indexOf('?') === -1) return;
  wx.reLaunch({ url });
}

/**
 * 通用入口守卫：先拉服务端最新 user，再按状态路由
 * @param {object} opts { readyOnly } readyOnly=true 时仅在「已就绪(有家庭+身份)」才跳首页，
 *                      否则停留当前页（用于 login 这类入口页，避免与上一页来回跳）
 * @returns {Promise<object|null>} 已就绪返回 user，否则 null
 */
async function ensureReady(opts = {}) {
  let user = null;
  try {
    user = await fetchUser();
  } catch (e) {
    // 云函数/网络异常：退回本地缓存判断，避免卡住
    user = getUser();
  }
  if (!user) {
    go(ROUTES.login);
    return null;
  }
  const target = routeOf(user);
  if (target === ROUTES.home) {
    go(ROUTES.home);
    return user;
  }
  if (!opts.readyOnly) go(target);
  return null;
}

module.exports = { getUser, setUser, clearUser, fetchUser, routeOf, go, ensureReady, ROUTES };
