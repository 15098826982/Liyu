package com.couplenest.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 设置角色请求：role 1=老婆 2=老公（前端把 boss/manager 转成 1/2）。
 */
@Data
public class UserSetRoleRequest {

    @NotNull(message = "角色不能为空")
    @Min(value = 1, message = "角色不合法")
    @Max(value = 2, message = "角色不合法")
    private Integer role;
}
