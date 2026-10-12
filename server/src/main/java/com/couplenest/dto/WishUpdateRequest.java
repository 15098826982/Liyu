package com.couplenest.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 改心愿请求。id 必填，其余字段可选，只更新传了（非 null）的字段。
 */
@Data
public class WishUpdateRequest {

    @NotNull(message = "心愿 id 不能为空")
    private Long id;

    private String title;

    /** 谁的心愿：老婆的 / 老公的 / 共同的 */
    private String type;

    private String description;

    private BigDecimal budget;

    private String linkUrl;

    private String imageUrl;

    /** 状态：0=待实现 1=已收到 */
    private Integer status;
}
