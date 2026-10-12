package com.couplenest.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 创建家庭请求：小窝名字。
 */
@Data
public class FamilyCreateRequest {

    @NotBlank(message = "小窝名字不能为空")
    private String name;
}
