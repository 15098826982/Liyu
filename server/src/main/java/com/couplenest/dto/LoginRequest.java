package com.couplenest.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 登录请求：code 为 wx.login 拿到的临时码。
 */
@Data
public class LoginRequest {

    @NotBlank(message = "code 不能为空")
    private String code;
}
