package com.couplenest.interceptor;

import com.couplenest.common.UserContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 访问日志拦截器：记录每个请求的耗时并打印一行日志。
 * 在 WebMvcConfig 中 order=0 注册，早于 JwtInterceptor 执行（开始时间从请求进入即计时）。
 */
@Slf4j
@Component
public class AccessLogInterceptor implements HandlerInterceptor {

    /** 请求开始时间写入 request 的 attribute key */
    private static final String ATTR_START = "couplenest.startTime";

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        request.setAttribute(ATTR_START, System.currentTimeMillis());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        Object start = request.getAttribute(ATTR_START);
        long cost = start instanceof Long ? System.currentTimeMillis() - (Long) start : -1;

        // 本拦截器 order=0 在 JwtInterceptor 之后执行 afterCompletion，UserContext 已被清理，
        // 故优先取 JwtInterceptor 写入 request 的 userId 兜底。
        Long userId = UserContext.getUserId();
        if (userId == null) {
            Object attr = request.getAttribute(JwtInterceptor.ATTR_USER_ID);
            if (attr instanceof Long) {
                userId = (Long) attr;
            }
        }

        log.info("访问日志: userId={}, method={}, uri={}, status={}, cost={}ms",
                userId, request.getMethod(), request.getRequestURI(), response.getStatus(), cost);
    }
}
