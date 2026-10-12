package com.couplenest.dto;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 心情返回。
 * role 为记录人的后端原始值 1=老婆 2=老公，字符串映射交给前端。
 */
@Data
public class MoodVO {

    private Long id;
    private Long userId;
    private String moodType;
    private String content;
    private LocalDate moodDate;
    private Integer role;
    private LocalDateTime createdAt;
}
