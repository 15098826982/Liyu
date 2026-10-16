SELECT
  (SELECT COUNT(*) FROM user)   AS users,
  (SELECT COUNT(*) FROM family) AS families,
  (SELECT COUNT(*) FROM dish)   AS dishes,
  (SELECT COUNT(*) FROM `order`) AS orders;
SELECT id, status, invite_code FROM family ORDER BY id LIMIT 10;
SELECT id, nickname, family_id, role, LEFT(openid, 24) AS openid_prefix FROM user ORDER BY id LIMIT 10;
