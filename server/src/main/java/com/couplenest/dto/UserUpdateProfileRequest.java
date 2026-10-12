package com.couplenest.dto;

import lombok.Data;

/**
 * 更新个人资料请求：nickname / avatar 均可选，传了才更新。
 */
@Data
public class UserUpdateProfileRequest {

    private String nickname;

    private String avatar;
}
