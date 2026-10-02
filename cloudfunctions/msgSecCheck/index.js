// 云函数 msgSecCheck：文字内容安全审核
// 参数：content（文本内容）
// 返回：{ pass, errCode, errMsg, detail }  pass=true 合规
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const content = String(event.content || '').trim();
  if (!content) return { pass: true, errCode: 0, errMsg: 'ok' };
  try {
    const result = await cloud.openapi.security.msgSecCheck({
      content: content.slice(0, 2500),
      version: 2,
      scene: 2, // 1资料 2评论 3论坛 4社交日志
      openid: cloud.getWXContext().OPENID
    });
    const suggest = result.result && result.result.suggest;
    return {
      pass: result.errCode === 0 && suggest === 'pass',
      errCode: result.errCode,
      errMsg: result.errMsg || 'ok',
      detail: result.result || null
    };
  } catch (e) {
    // 87014 表示内容违规，其余视为检测失败（一律不放行）
    return { pass: false, errCode: e.errCode || -1, errMsg: e.errMsg || e.message };
  }
};
