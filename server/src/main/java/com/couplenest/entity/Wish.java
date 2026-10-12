package com.couplenest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 心愿单表。
 */
@Data
@TableName("wish")
public class Wish {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long familyId;

    private String title;

    /** 心愿描述 */
    private String description;

    /** 谁的心愿：老婆的 / 老公的 / 共同的 */
    private String type;

    /** 预算 */
    private BigDecimal budget;

    private String linkUrl;

    private String imageUrl;

    private Long creatorId;

    /** 状态：0=想要 1=已买 */
    private Integer status;

    private LocalDateTime createdAt;
}
