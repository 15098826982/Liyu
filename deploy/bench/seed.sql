SET NAMES utf8mb4;
-- 压测专用数据：一个隔离家庭 + 一个 mock 用户 + 50 道菜 + 50 条备忘录
-- 为什么要造两份同样规模的数据：
--   dish 列表走 Redis 缓存（Cache-Aside），memo 列表不走缓存、每次都查 MySQL。
--   同样的数据量、同样的返回结构，两者的 QPS 差值就是「缓存到底带来多少收益」。
-- 压测结束后执行 deploy/bench/cleanup.sql 删除。

DELETE FROM dish   WHERE family_id IN (SELECT id FROM family WHERE name = 'bench');
DELETE FROM memo   WHERE family_id IN (SELECT id FROM family WHERE name = 'bench');
DELETE FROM `order` WHERE family_id IN (SELECT id FROM family WHERE name = 'bench');
DELETE FROM user   WHERE openid = 'mock_openid_bench1';
DELETE FROM family WHERE name = 'bench';

INSERT INTO family (name, invite_code, status) VALUES ('bench', 'BENCH1', 1);
SET @fid = LAST_INSERT_ID();

INSERT INTO user (openid, nickname, family_id, role)
VALUES ('mock_openid_bench1', 'bench', @fid, 2);
SET @uid = LAST_INSERT_ID();

INSERT INTO dish (family_id, name, category, price, creator_id)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 50)
SELECT @fid, CONCAT('压测菜品', n), IF(n % 2 = 0, '荤菜', '素菜'), 10.00 + n, @uid FROM seq;

INSERT INTO memo (family_id, title, content, category, is_todo, creator_id, done)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 50)
SELECT @fid, CONCAT('压测备忘', n), CONCAT('压测内容', n), '其他', 1, @uid, 0 FROM seq;

SELECT @fid AS family_id, @uid AS user_id,
       (SELECT COUNT(*) FROM dish WHERE family_id = @fid) AS dishes,
       (SELECT COUNT(*) FROM memo WHERE family_id = @fid) AS memos;
