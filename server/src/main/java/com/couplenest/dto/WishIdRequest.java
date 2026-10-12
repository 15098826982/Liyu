package com.couplenest.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 心愿 id 请求（标记已买 / 删除）。
 */
@Data
public class WishIdRequest {

    @NotNull(message = "心愿 id 不能为空")
    private Long wishId;
}
