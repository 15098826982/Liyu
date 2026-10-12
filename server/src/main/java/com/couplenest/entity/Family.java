package com.couplenest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 家庭表。
 */
@Data
@TableName("family")
public class Family {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    /** 六位邀请码，唯一 */
    private String inviteCode;

    /** 状态：0=刚创建等另一半 1=已齐 */
    private Integer status;

    /** 分类列表，存 JSON 字符串，如 ["荤菜","素菜"] */
    private String categories;

    /** 相恋日期 */
    private LocalDate loveStartDate;

    /** 纪念日 */
    private LocalDate anniversaryDate;

    /** 封面图 cloud:// */
    private String coverImage;

    /** 背景图 cloud:// */
    private String pageBg;

    private LocalDateTime createdAt;
}
