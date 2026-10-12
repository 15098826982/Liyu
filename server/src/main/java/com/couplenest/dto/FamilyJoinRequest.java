package com.couplenest.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 加入家庭请求：六位邀请码。
 */
@Data
public class FamilyJoinRequest {

    @NotBlank(message = "邀请码不能为空")
    private String inviteCode;
}
