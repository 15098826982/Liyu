package com.couplenest.interceptor;

import com.couplenest.common.JwtUtil;
import com.couplenest.common.Result;
import com.couplenest.common.UserContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;

/**
 * JWT 拦截器：校验 Authorization: Bearer <token>，解析出的 userId 放入 UserContext。
 * 校验签名后额外查一次 Redis 黑名单，退出登录的 token 会被拒绝。
 */
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
        try {
            Claims claims = jwtUtil.parse(token);
            // 签名校验通过后，再查一次黑名单（退出登录的 token）
            if (Boolean.TRUE.equals(redisTemplate.hasKey(BLACKLIST_PREFIX + token))) {
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
        } catch (Exception e) {
            writeUnauthorized(response);
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
