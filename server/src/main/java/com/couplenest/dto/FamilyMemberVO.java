package com.couplenest.dto;

import lombok.Data;

/**
 * 家庭成员：{ id, nickname, avatar, role }。
 * role 为后端原始值 1=老婆 2=老公，字符串映射交给前端。
 */
@Data
public class FamilyMemberVO {

    private Long id;
    private String nickname;
    private String avatar;
    private Integer role;
}
