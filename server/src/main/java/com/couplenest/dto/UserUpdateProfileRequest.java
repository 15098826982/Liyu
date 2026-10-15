package com.couplenest.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 更新个人资料请求：nickname / avatar 均可选，传了才更新。
 * 长度上限与库表定义对齐（user.nickname varchar(64)、avatar varchar(512)），
 * 避免超长内容在数据库层抛异常、变成 500 系统错误。
 */
@Data
public class UserUpdateProfileRequest {

    @Size(max = 32, message = "昵称不能超过 32 个字")
    private String nickname;

    @Size(max = 512, message = "头像地址过长")
    private String avatar;
}
