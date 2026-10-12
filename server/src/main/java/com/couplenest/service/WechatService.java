package com.couplenest.service;

/**
 * 微信相关能力。
 */
public interface WechatService {

    /** 用 wx.login 的 code 换取 openid */
    String code2Session(String code);
}
