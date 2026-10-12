package com.couplenest.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 阿里云 OSS 配置，对应 application.yml 里的 oss.*
 */
@Data
@Component
@ConfigurationProperties(prefix = "oss")
public class OssProperties {

    /** 地域节点，如 oss-cn-beijing.aliyuncs.com */
    private String endpoint;

    private String accessKeyId;

    private String accessKeySecret;

    /** bucket 名，拼接公开访问 url 时用 */
    private String bucketName;
}
