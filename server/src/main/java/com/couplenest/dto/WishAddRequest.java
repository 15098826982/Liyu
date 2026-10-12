package com.couplenest.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 加心愿请求。
 */
@Data
public class WishAddRequest {

    @NotBlank(message = "心愿内容不能为空")
    private String title;

    /** 谁的心愿：老婆的 / 老公的 / 共同的 */
    private String type;

    /** 心愿描述 */
    private String description;

    /** 预算 */
    private BigDecimal budget;

    private String linkUrl;

    private String imageUrl;

    /** 状态：0=待实现 1=已收到；不传按 0 处理 */
    private Integer status;
}
