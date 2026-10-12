package com.couplenest.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 加菜请求。
 */
@Data
public class DishAddRequest {

    @NotBlank(message = "菜名不能为空")
    private String name;

    private String category;

    @DecimalMin(value = "0", message = "价格不能为负")
    private BigDecimal price;

    private String imageUrl;
}
