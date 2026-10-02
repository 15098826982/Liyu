// dedupeOrders 云函数（临时用，清理完可删除）
// action: report（默认，只报告不删除） | clean（确认后删除重复，每组保留最早一条）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const $ = db.command.aggregate;

exports.main = async (event) => {
  const action = event.action || 'report';

  // 按 familyId + orderDate + dishId 分组，找出数量 > 1 的重复组
  const agg = await db.collection('orders').aggregate()
    .group({
      _id: { familyId: '$familyId', orderDate: '$orderDate', dishId: '$dishId' },
      count: $.sum(1),
      docs: $.push({
        _id: '$_id',
        status: '$status',
        createdAt: '$createdAt'
      })
    })
    .match({ count: $.gt(1) })
    .end();

  const dupGroups = agg.list || [];
  const report = dupGroups.map(g => ({
    familyId: g._id.familyId,
    orderDate: g._id.orderDate,
    dishId: g._id.dishId,
    count: g.count,
    records: g.docs
  }));

  if (action === 'report') {
    return { code: 0, action: 'report', duplicateGroups: report.length, groups: report };
  }

  if (action === 'clean') {
    let removed = 0;
    const removedIds = [];
    for (const g of dupGroups) {
      // 按 createdAt 升序，保留最早一条，其余删除
      const docs = g.docs.slice().sort((a, b) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      const toRemove = docs.slice(1);
      for (const d of toRemove) {
        try {
          await db.collection('orders').doc(d._id).remove();
          removed++;
          removedIds.push(d._id);
        } catch (e) {
          // 单条删除失败不中断
        }
      }
    }
    return { code: 0, action: 'clean', removed, removedIds };
  }

  return { code: -1, msg: `unknown action: ${action}` };
};
