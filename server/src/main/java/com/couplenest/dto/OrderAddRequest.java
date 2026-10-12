package com.couplenest.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 下单请求。
 */
@Data
public class OrderAddRequest {

    @NotNull(message = "菜品 id 不能为空")
    private Long dishId;
}
