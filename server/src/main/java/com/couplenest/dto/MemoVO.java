package com.couplenest.dto;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 备忘录返回。
 * creatorRole 为后端原始值 1=老婆 2=老公，字符串映射交给前端。
 */
@Data
public class MemoVO {

    private Long id;
    private String title;
    private String content;
    private String color;
    private String category;
    /** 是否待办事项：0=否 1=是 */
    private Integer isTodo;
    /** 0=待办 1=完成 */
    private Integer done;
    private Long creatorId;
    private Integer creatorRole;
    private LocalDateTime createdAt;
}
