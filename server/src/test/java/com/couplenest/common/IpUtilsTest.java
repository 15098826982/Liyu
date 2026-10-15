package com.couplenest.common;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 客户端真实 IP 解析测试（Nginx 反代场景）。
 */
class IpUtilsTest {

    @Test
    void takesFirstEntryOfXForwardedFor() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "1.2.3.4, 10.0.0.1, 10.0.0.2");
        request.setRemoteAddr("127.0.0.1");

        assertThat(IpUtils.getClientIp(request)).isEqualTo("1.2.3.4");
    }

    @Test
    void skipsUnknownPlaceholderInXForwardedFor() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "unknown, 1.2.3.4");
        request.setRemoteAddr("127.0.0.1");

        assertThat(IpUtils.getClientIp(request)).isEqualTo("1.2.3.4");
    }

    @Test
    void fallsBackToXRealIpWhenNoXForwardedFor() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Real-IP", "5.6.7.8");
        request.setRemoteAddr("127.0.0.1");

        assertThat(IpUtils.getClientIp(request)).isEqualTo("5.6.7.8");
    }

    @Test
    void fallsBackToRemoteAddrWhenNoProxyHeader() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("9.9.9.9");

        assertThat(IpUtils.getClientIp(request)).isEqualTo("9.9.9.9");
    }
}
