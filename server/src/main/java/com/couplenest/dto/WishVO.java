package com.couplenest.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 心愿返回。
 * creatorRole 为后端原始值 1=老婆 2=老公，字符串映射交给前端。
 * status 保持 0=待实现 1=已收到，中文映射交给前端。
 */
@Data
public class WishVO {

    private Long id;
    private String title;
    private String type;
    private String description;
    private BigDecimal budget;
    private String linkUrl;
    private String imageUrl;
    private Integer status;
    private Long creatorId;
    private Integer creatorRole;
    private LocalDateTime createdAt;
}
