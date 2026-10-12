package com.couplenest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 点菜（订单）表。
 * 表名 order 是 MySQL 保留字，需用反引号包裹。
 * 联合唯一索引 UNIQUE(family_id, order_date, dish_id)：防止同一家庭同一天重复点同一道菜。
 * dish_name / price 为下单时的快照，直接落库、不再 JOIN dish 回查。
 */
@Data
@TableName("`order`")
public class Order {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long familyId;

    private Long dishId;

    /** 菜品名称快照 */
    private String dishName;

    /** 价格快照 */
    private BigDecimal price;

    private LocalDate orderDate;

    private Long creatorId;

    /** 订单状态：0=已下单 1=已吃完 */
    private Integer status;

    private LocalDateTime createdAt;
}
