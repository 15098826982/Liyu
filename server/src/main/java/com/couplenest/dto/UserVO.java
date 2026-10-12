package com.couplenest.dto;

import lombok.Data;

/**
 * 当前用户返回：{ id, openid, nickname, avatar, familyId, role }。
 * role 为后端原始值 1=老婆 2=老公，字符串映射交给前端。
 */
@Data
public class UserVO {

    private Long id;
    private String openid;
    private String nickname;
    private String avatar;
    private Long familyId;
    private Integer role;
}
