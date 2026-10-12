-- =============================================================
-- 情侣小窝 数据库脚本（MySQL 8）
-- 库名：couple_nest
-- 说明：本脚本不参与 Spring Boot 自动执行，需手动导入。
-- 注意：`order` 是 MySQL 保留字，必须用反引号包裹。
-- =============================================================

CREATE DATABASE IF NOT EXISTS `couple_nest`
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_general_ci;

USE `couple_nest`;

-- -------------------------------------------------------------
-- 1. 用户表
-- 联合唯一索引 UNIQUE(family_id, role)：保证一个家庭一老公一老婆
-- （MySQL 唯一索引允许多个 NULL，因此未加入家庭的用户不受限制）
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user` (
    `id`         BIGINT       NOT NULL AUTO_INCREMENT,
    `openid`     VARCHAR(64)  NOT NULL COMMENT '微信 openid',
    `nickname`   VARCHAR(64)           DEFAULT NULL COMMENT '昵称',
    `avatar`     VARCHAR(512)          DEFAULT NULL COMMENT '头像地址',
    `family_id`  BIGINT                DEFAULT NULL COMMENT '所属家庭 id，可空',
    `role`       TINYINT               DEFAULT NULL COMMENT '角色 1=老婆 2=老公，可空',
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_openid` (`openid`),
    UNIQUE KEY `uk_user_family_role` (`family_id`, `role`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '用户表';

-- -------------------------------------------------------------
-- 2. 家庭表
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `family` (
    `id`               BIGINT      NOT NULL AUTO_INCREMENT,
    `name`             VARCHAR(64)          DEFAULT NULL COMMENT '家庭名称',
    `invite_code`      CHAR(6)     NOT NULL COMMENT '六位邀请码',
    `status`           TINYINT     NOT NULL DEFAULT 0 COMMENT '0=刚创建等另一半 1=已齐',
    `categories`       VARCHAR(512)         DEFAULT NULL COMMENT '分类列表 JSON 字符串',
    `love_start_date`  DATE                 DEFAULT NULL COMMENT '相恋日期',
    `anniversary_date` DATE                 DEFAULT NULL COMMENT '纪念日',
    `cover_image`      VARCHAR(512)         DEFAULT '' COMMENT '封面图 cloud://',
    `page_bg`          VARCHAR(512)         DEFAULT '' COMMENT '背景图 cloud://',
    `created_at`       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_family_invite_code` (`invite_code`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '家庭表';

-- -------------------------------------------------------------
-- 3. 菜品表
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `dish` (
    `id`         BIGINT         NOT NULL AUTO_INCREMENT,
    `family_id`  BIGINT         NOT NULL COMMENT '所属家庭 id',
    `name`       VARCHAR(64)    NOT NULL COMMENT '菜名',
    `category`   VARCHAR(32)             DEFAULT NULL COMMENT '分类',
    `price`      DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT '价格',
    `image_url`  VARCHAR(512)            DEFAULT NULL COMMENT '图片地址',
    `creator_id` BIGINT                  DEFAULT NULL COMMENT '创建人 user id',
    `created_at` DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_dish_family` (`family_id`),
    -- 联合唯一索引 UNIQUE(family_id, name)：同一家庭不允许重名菜品
    UNIQUE KEY `uk_family_name` (`family_id`, `name`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '菜品表';

-- -------------------------------------------------------------
-- 4. 点菜（订单）表
-- 联合唯一索引 UNIQUE(family_id, order_date, dish_id)：防同一家庭同一天重复点同一道菜
-- dish_name / price 为下单快照
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `order` (
    `id`         BIGINT         NOT NULL AUTO_INCREMENT,
    `family_id`  BIGINT         NOT NULL COMMENT '所属家庭 id',
    `dish_id`    BIGINT         NOT NULL COMMENT '菜品 id',
    `dish_name`  VARCHAR(64)    NOT NULL COMMENT '菜名快照',
    `price`      DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT '价格快照',
    `order_date` DATE           NOT NULL COMMENT '下单日期',
    `creator_id` BIGINT                  DEFAULT NULL COMMENT '点菜人 user id',
    `status`     TINYINT                 DEFAULT 0 COMMENT '0=已下单 1=已吃完',
    `created_at` DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_family_date_dish` (`family_id`, `order_date`, `dish_id`),
    KEY `idx_order_family_date` (`family_id`, `order_date`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '点菜（订单）表';

-- -------------------------------------------------------------
-- 5. 心愿单表
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `wish` (
    `id`          BIGINT       NOT NULL AUTO_INCREMENT,
    `family_id`   BIGINT       NOT NULL COMMENT '所属家庭 id',
    `title`       VARCHAR(128) NOT NULL COMMENT '心愿标题',
    `description` VARCHAR(500)          DEFAULT '' COMMENT '心愿描述',
    `type`        VARCHAR(20)           DEFAULT '' COMMENT '老婆的/老公的/共同的',
    `budget`      DECIMAL(10, 2)        DEFAULT NULL COMMENT '预算',
    `link_url`    VARCHAR(512)          DEFAULT NULL COMMENT '商品链接',
    `image_url`   VARCHAR(512)          DEFAULT NULL COMMENT '图片地址',
    `creator_id`  BIGINT                DEFAULT NULL COMMENT '创建人 user id',
    `status`      TINYINT      NOT NULL DEFAULT 0 COMMENT '0=想要 1=已买',
    `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_wish_family` (`family_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '心愿单表';

-- -------------------------------------------------------------
-- 6. 心情表
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `mood` (
    `id`         BIGINT      NOT NULL AUTO_INCREMENT,
    `family_id`  BIGINT      NOT NULL COMMENT '所属家庭 id',
    `user_id`    BIGINT      NOT NULL COMMENT '记录人 user id',
    `mood_type`  VARCHAR(32)          DEFAULT NULL COMMENT '心情类型',
    `content`    VARCHAR(512)         DEFAULT NULL COMMENT '心情文字',
    `mood_date`  DATE                 DEFAULT NULL COMMENT '心情日期',
    `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_mood_family_date` (`family_id`, `mood_date`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '心情表';

-- -------------------------------------------------------------
-- 7. 打卡表
-- 联合唯一索引 UNIQUE(family_id, user_id, checkin_date)：每人每天打卡一次
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `checkin` (
    `id`           BIGINT NOT NULL AUTO_INCREMENT,
    `family_id`    BIGINT NOT NULL COMMENT '所属家庭 id',
    `user_id`      BIGINT NOT NULL COMMENT '打卡人 user id',
    `checkin_date` DATE   NOT NULL COMMENT '打卡日期',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_family_user_date` (`family_id`, `user_id`, `checkin_date`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '打卡表';

-- -------------------------------------------------------------
-- 8. 经期记录表
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `period` (
    `id`          BIGINT       NOT NULL AUTO_INCREMENT,
    `family_id`   BIGINT       NOT NULL COMMENT '所属家庭 id',
    `user_id`     BIGINT       NOT NULL COMMENT '记录人 user id',
    `period_date` DATE                  DEFAULT NULL COMMENT '经期日期',
    `note`        VARCHAR(255)          DEFAULT NULL COMMENT '备注',
    `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_period_family` (`family_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '经期记录表';

-- -------------------------------------------------------------
-- 9. 备忘录表
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `memo` (
    `id`         BIGINT       NOT NULL AUTO_INCREMENT,
    `family_id`  BIGINT       NOT NULL COMMENT '所属家庭 id',
    `title`      VARCHAR(100)          DEFAULT '' COMMENT '标题',
    `content`    VARCHAR(512)          DEFAULT NULL COMMENT '待办内容',
    `color`      VARCHAR(20)           DEFAULT 'yellow' COMMENT '颜色',
    `category`   VARCHAR(20)           DEFAULT '其他' COMMENT '分类',
    `is_todo`    TINYINT               DEFAULT 1 COMMENT '是否待办 0=否 1=是',
    `creator_id` BIGINT                DEFAULT NULL COMMENT '创建人 user id',
    `done`       TINYINT      NOT NULL DEFAULT 0 COMMENT '0=待办 1=完成',
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_memo_family` (`family_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '备忘录表';

-- -------------------------------------------------------------
-- 11. 目标表（打卡页的「目标管理」）
-- mode：checkin=每日打卡（用 duration/start_date/end_date）
--       wish=一次愿望（用 goal_date/stages）
-- stages 存 JSON 数组 [{text, completed}]
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `goal` (
    `id`          BIGINT      NOT NULL AUTO_INCREMENT,
    `family_id`   BIGINT      NOT NULL COMMENT '所属家庭 id',
    `creator_id`  BIGINT      NOT NULL COMMENT '创建人 user id',
    `title`       VARCHAR(100) NOT NULL COMMENT '目标名称',
    `description` VARCHAR(500)          DEFAULT '' COMMENT '描述',
    `icon`        VARCHAR(10)           DEFAULT '🎯' COMMENT '图标 emoji',
    `mode`        VARCHAR(20) NOT NULL COMMENT 'checkin=每日打卡 wish=一次愿望',
    `frequency`   VARCHAR(20)           DEFAULT '每天' COMMENT '每天/每周3次/每周5次',
    `duration`    INT                   DEFAULT 0 COMMENT '天数（checkin 模式用）',
    `start_date`  DATE                  DEFAULT NULL COMMENT '开始日期',
    `end_date`    DATE                  DEFAULT NULL COMMENT '结束日期',
    `goal_date`   DATE                  DEFAULT NULL COMMENT '愿望目标日（wish 模式用）',
    `status`      TINYINT               DEFAULT 0 COMMENT '0=进行中 1=已完成',
    `stages`      JSON                  DEFAULT NULL COMMENT '阶段数组 [{text, completed}]（wish 模式用）',
    `created_at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_family` (`family_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '目标表';

-- -------------------------------------------------------------
-- 12. 目标打卡记录表
-- 联合唯一索引 UNIQUE(goal_id, user_id, checkin_date)：每人每个目标每天一次
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `checkin_record` (
    `id`           BIGINT NOT NULL AUTO_INCREMENT,
    `goal_id`      BIGINT NOT NULL COMMENT '目标 id',
    `user_id`      BIGINT NOT NULL COMMENT '打卡人 user id',
    `checkin_date` DATE   NOT NULL COMMENT '打卡日期',
    `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_goal_user_date` (`goal_id`, `user_id`, `checkin_date`),
    KEY `idx_goal` (`goal_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '目标打卡记录表';

-- -------------------------------------------------------------
-- 13. 错误日志表
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `error_logs` (
    `id`         BIGINT        NOT NULL AUTO_INCREMENT,
    `module`     VARCHAR(64)            DEFAULT NULL COMMENT '模块名',
    `action`     VARCHAR(64)            DEFAULT NULL COMMENT '操作名',
    `error_msg`  VARCHAR(1000)          DEFAULT NULL COMMENT '错误信息',
    `stack`      TEXT                   DEFAULT NULL COMMENT '堆栈信息',
    `context`    TEXT                   DEFAULT NULL COMMENT '上下文信息',
    `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_error_module` (`module`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '错误日志表';
