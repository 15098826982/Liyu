package com.couplenest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 心情表。
 */
@Data
@TableName("mood")
public class Mood {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long familyId;

    private Long userId;

    /** 心情类型（如 happy/calm/love/sad/angry/tired） */
    private String moodType;

    private String content;

    private LocalDate moodDate;

    private LocalDateTime createdAt;
}
