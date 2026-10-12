package com.couplenest.service;

import com.couplenest.dto.LoginVO;

/**
 * 登录相关业务。
 */
public interface AuthService {

    /** 微信登录：code -> openid -> 用户 -> JWT */
    LoginVO login(String code);

    /** 退出登录：把当前 token 加入 Redis 黑名单，TTL 为 token 剩余有效期 */
    void logout(String authorizationHeader);
}
