package com.couplenest.common;

import jakarta.servlet.http.HttpServletRequest;

/**
 * 客户端真实 IP 工具（用于 Nginx 反代后的限流、日志等场景）。
 *
 * <p><b>安全前提：XFF 可被客户端伪造。</b>
 * {@code X-Forwarded-For} / {@code X-Real-IP} 都是普通 HTTP 头，客户端可以自己塞。
 * 只有当流量必经自家 Nginx、且 Nginx 用 {@code $proxy_add_x_forwarded_for}（追加）而非
 * 覆盖该头时才可信——此时链路第一个 IP 才是真实客户端。
 * 若本服务直接暴露公网、绕过 Nginx，攻击者可伪造 XFF 冒充他人 IP
 * （既能绕过限流，也能嫁祸他人），因此本工具必须只在 Nginx 反代之后使用。
 *
 * <p>解析顺序：X-Forwarded-For 首个非空项 → X-Real-IP → getRemoteAddr() 兜底。
 * 说明：当前未维护「可信代理」白名单（单体小项目不引入额外配置），
 * 依赖 Nginx 追加而非覆盖 XFF 来保证第一个 IP 即真实客户端。
 */
public final class IpUtils {

    private static final String HEADER_X_FORWARDED_FOR = "X-Forwarded-For";
    private static final String HEADER_X_REAL_IP = "X-Real-IP";
    private static final String UNKNOWN = "unknown";

    private IpUtils() {
    }

    /**
     * 取客户端真实 IP。任何一步拿不到有效值都继续往后兜底，最终回退到直连地址。
     */
    public static String getClientIp(HttpServletRequest request) {
        if (request == null) {
            return null;
        }

        // 1. X-Forwarded-For：形如 "client, proxy1, proxy2"，取第一个非空项
        String xff = request.getHeader(HEADER_X_FORWARDED_FOR);
        if (xff != null && !xff.isBlank()) {
            for (String part : xff.split(",")) {
                String ip = part.trim();
                if (!ip.isEmpty() && !UNKNOWN.equalsIgnoreCase(ip)) {
                    return ip;
                }
            }
        }

        // 2. X-Real-IP
        String realIp = request.getHeader(HEADER_X_REAL_IP);
        if (realIp != null && !realIp.isBlank() && !UNKNOWN.equalsIgnoreCase(realIp.trim())) {
            return realIp.trim();
        }

        // 3. 兜底：直连地址（未经代理或代理头缺失时的真实来源）
        return request.getRemoteAddr();
    }
}
