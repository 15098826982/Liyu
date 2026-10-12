package com.couplenest.common;

/**
 * 当前登录用户上下文。由 JWT 拦截器在请求进入时写入，请求结束时清理。
 * 业务接口通过 {@link #getUserId()} 直接拿当前用户，前端无需再传 userId（防伪造）。
 */
public final class UserContext {

    private static final ThreadLocal<Long> USER_ID = new ThreadLocal<>();

    private UserContext() {
    }

    public static void setUserId(Long userId) {
        USER_ID.set(userId);
    }

    public static Long getUserId() {
        return USER_ID.get();
    }

    public static void clear() {
        USER_ID.remove();
    }
}
