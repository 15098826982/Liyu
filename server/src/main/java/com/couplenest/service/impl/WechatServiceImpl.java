package com.couplenest.service.impl;

import com.couplenest.common.BusinessException;
import com.couplenest.config.WechatProperties;
import com.couplenest.service.WechatService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * 微信 code2session 实现。
 * 未配置真实 appid/secret 时走 mock（wechat.mock=true），方便本地联调。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WechatServiceImpl implements WechatService {

    private static final String CODE2SESSION_URL = "https://api.weixin.qq.com/sns/jscode2session";

    private final WechatProperties wechatProperties;
    private final RestTemplate restTemplate;

    @Override
    public String code2Session(String code) {
        if (wechatProperties.isMock()) {
            // 本地 mock：同一个 code 稳定映射到同一个 openid
            String openid = "mock_openid_" + code;
            log.warn("[mock] 未调用真实微信接口，code={} -> openid={}", code, openid);
            return openid;
        }

        String url = UriComponentsBuilder.fromHttpUrl(CODE2SESSION_URL)
                .queryParam("appid", wechatProperties.getAppid())
                .queryParam("secret", wechatProperties.getSecret())
                .queryParam("js_code", code)
                .queryParam("grant_type", "authorization_code")
                .toUriString();

        JsonNode body = restTemplate.getForObject(url, JsonNode.class);
        if (body == null) {
            throw new BusinessException(BusinessException.CODE_WECHAT_LOGIN_FAIL, "微信登录失败：无响应");
        }
        if (body.hasNonNull("errcode") && body.get("errcode").asInt() != 0) {
            throw new BusinessException(BusinessException.CODE_WECHAT_LOGIN_FAIL,
                    "微信登录失败：" + body.path("errmsg").asText());
        }
        String openid = body.path("openid").asText(null);
        if (openid == null || openid.isEmpty()) {
            throw new BusinessException(BusinessException.CODE_WECHAT_LOGIN_FAIL, "微信登录失败：未返回 openid");
        }
        return openid;
    }
}
