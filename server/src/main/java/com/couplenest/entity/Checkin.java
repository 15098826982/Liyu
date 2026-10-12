package com.couplenest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;

/**
 * 打卡表。
 * 联合唯一索引 UNIQUE(family_id, user_id, checkin_date)：每人每天只能打卡一次。
 */
@Data
@TableName("checkin")
public class Checkin {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long familyId;

    private Long userId;

    private LocalDate checkinDate;
}
