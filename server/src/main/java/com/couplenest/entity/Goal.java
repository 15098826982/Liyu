package com.couplenest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 目标表（打卡页的「目标管理」）。
 * autoResultMap = true 让 stages 的 typeHandler 在查询时也生效。
 */
@Data
@TableName(value = "goal", autoResultMap = true)
public class Goal {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long familyId;

    private Long creatorId;

    private String title;

    private String description;

    /** 图标 emoji */
    private String icon;

    /** checkin=每日打卡 wish=一次愿望 */
    private String mode;

    /** 每天 / 每周3次 / 每周5次 */
    private String frequency;

    /** 天数（checkin 模式用） */
    private Integer duration;

    private LocalDate startDate;

    private LocalDate endDate;

    /** 愿望目标日（wish 模式用） */
    private LocalDate goalDate;

    /** 0=进行中 1=已完成 */
    private Integer status;

    /** 阶段数组（wish 模式用），JSON 存取 */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Stage> stages;

    private LocalDateTime createdAt;
}
