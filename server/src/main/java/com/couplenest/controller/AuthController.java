package com.couplenest.controller;

import com.couplenest.common.BusinessException;
import com.couplenest.common.IpUtils;
import com.couplenest.common.RateLimiter;
import com.couplenest.common.Result;
import com.couplenest.dto.LoginRequest;
import com.couplenest.dto.LoginVO;
import com.couplenest.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * 登录接口。此接口不需要登录态。
 */
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    /** 同一 code 限流 key 前缀 */
    private static final String RATE_CODE_PREFIX = "rate:login:code:";
    /** 同一 IP 限流 key 前缀 */
    private static final String RATE_IP_PREFIX = "rate:login:ip:";
    /** 同一 code 5 秒内只允许 1 次 */
    private static final int CODE_MAX_PER_WINDOW = 1;
    private static final Duration CODE_WINDOW = Duration.ofSeconds(5);
    /** 同一 IP 1 分钟内最多 10 次 */
    private static final int IP_MAX_PER_WINDOW = 10;
    private static final Duration IP_WINDOW = Duration.ofSeconds(60);

    private final AuthService authService;
    private final RateLimiter rateLimiter;

    @PostMapping("/login")
    public Result<LoginVO> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        String code = request.getCode();

        // 限流 1：同一 code 5 秒内只能请求 1 次（code 为空同样拦，防止空参刷接口）
        limit(RATE_CODE_PREFIX + (code == null ? "" : code), CODE_MAX_PER_WINDOW, CODE_WINDOW);

        // 限流 2：同一 IP 1 分钟内最多 10 次（走 Nginx 反代时取真实客户端 IP）
        limit(RATE_IP_PREFIX + IpUtils.getClientIp(httpRequest), IP_MAX_PER_WINDOW, IP_WINDOW);

        return Result.ok(authService.login(code));
    }

    @PostMapping("/logout")
    public Result<Void> logout(HttpServletRequest httpRequest) {
        authService.logout(httpRequest.getHeader(HttpHeaders.AUTHORIZATION));
        return Result.ok(null);
    }

    /** 计数限流：窗口内超过 max 次则拒绝（计数与过期时间由 Redis 端 Lua 原子完成） */
    private void limit(String key, int max, Duration window) {
        if (!rateLimiter.tryAcquire(key, max, window)) {
            throw new BusinessException(BusinessException.CODE_TOO_MANY_REQUESTS, "操作太频繁，请稍后再试");
        }
    }
}
