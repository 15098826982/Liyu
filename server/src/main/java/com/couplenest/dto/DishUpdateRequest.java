package com.couplenest.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 改菜请求：name / price / imageUrl 传哪个改哪个（不传的不动）。
 */
@Data
public class DishUpdateRequest {

    @NotNull(message = "菜品 id 不能为空")
    private Long id;

    private String name;

    private String category;

    @DecimalMin(value = "0", message = "价格不能为负")
    private BigDecimal price;

    private String imageUrl;
}
