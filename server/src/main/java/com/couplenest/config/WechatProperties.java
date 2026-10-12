package com.couplenest.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 微信小程序配置，对应 application.yml 里的 wechat.*
 */
@Data
@Component
@ConfigurationProperties(prefix = "wechat")
public class WechatProperties {

    private String appid;

    private String secret;

    /** true=本地 mock，不真调微信接口 */
    private boolean mock = true;
}
