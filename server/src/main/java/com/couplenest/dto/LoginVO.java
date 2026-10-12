package com.couplenest.dto;

import lombok.Data;

/**
 * 登录返回：{ token, userId, familyId, role }。
 * 未加入家庭时 familyId、role 为 null。
 */
@Data
public class LoginVO {

    private String token;
    private Long userId;
    private Long familyId;
    private Integer role;
}
