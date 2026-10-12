package com.couplenest.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 删菜请求。
 */
@Data
public class DishDeleteRequest {

    @NotNull(message = "菜品 id 不能为空")
    private Long id;
}
