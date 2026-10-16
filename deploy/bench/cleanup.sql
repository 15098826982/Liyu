-- 清理压测数据，以及早期冒烟测试产生的 mock 用户
DELETE FROM dish   WHERE family_id IN (SELECT id FROM family WHERE name = 'bench');
DELETE FROM memo   WHERE family_id IN (SELECT id FROM family WHERE name = 'bench');
DELETE FROM `order` WHERE family_id IN (SELECT id FROM family WHERE name = 'bench');
DELETE FROM user   WHERE openid = 'mock_openid_bench1';
DELETE FROM family WHERE name = 'bench';
DELETE FROM user   WHERE openid LIKE 'mock_openid_%';

SELECT (SELECT COUNT(*) FROM user) AS users,
       (SELECT COUNT(*) FROM family) AS families,
       (SELECT COUNT(*) FROM dish) AS dishes;
