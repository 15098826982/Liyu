package com.couplenest.interceptor;

import com.couplenest.common.JwtUtil;
import com.couplenest.common.Result;
import com.couplenest.common.UserContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;

/**
 * JWT 拦截器：校验 Authorization: Bearer &lt;token&gt;，解析出的 userId 放入 UserContext。
 * 校验签名后额外查一次 Redis 黑名单，退出登录的 token 会被拒绝。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtInterceptor implements HandlerInterceptor {

    private static final String BEARER_PREFIX = "Bearer ";
    /** token 黑名单 key 前缀 */
    private static final String BLACKLIST_PREFIX = "jwt:blacklist:";
    /** 登录用户 id 写入 request 的 attribute key，供访问日志拦截器读取 */
    public static final String ATTR_USER_ID = "couplenest.userId";

    private final JwtUtil jwtUtil;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith(BEARER_PREFIX)) {
            writeUnauthorized(response);
            return false;
        }

        String token = header.substring(BEARER_PREFIX.length()).trim();

        // 第一步：验签 + 过期校验。失败一律 401，这里不依赖 Redis。
        Claims claims;
        try {
            claims = jwtUtil.parse(token);
        } catch (Exception e) {
            writeUnauthorized(response);
            return false;
        }

        // 第二步：查黑名单（退出登录的会话）。黑名单键是 token 里的 jti，不是整串 token。
        // Redis 不可用时选择放行并告警：token 本身已通过验签，为一次缓存抖动把全站用户登出，
        // 可用性代价大于「已登出 token 短暂仍可用」的风险。这是刻意的取舍，不是漏写。
        String jti = claims.getId();
        if (jti != null && !jti.isEmpty() && isBlacklisted(jti)) {
            writeUnauthorized(response);
            return false;
        }

        Object userId = claims.get("userId");
        if (userId == null) {
            writeUnauthorized(response);
            return false;
        }
        Long uid = Long.valueOf(userId.toString());
        UserContext.setUserId(uid);
        request.setAttribute(ATTR_USER_ID, uid);
        return true;
    }

    /** 查黑名单；Redis 异常时降级为「未拉黑」 */
    private boolean isBlacklisted(String jti) {
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(BLACKLIST_PREFIX + jti));
        } catch (Exception e) {
            log.error("黑名单校验失败（Redis 不可用），本次放行: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        UserContext.clear();
    }

    private void writeUnauthorized(HttpServletResponse response) throws Exception {
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(objectMapper.writeValueAsString(Result.error(401, "未登录或登录已过期")));
    }
}
