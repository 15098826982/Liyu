package com.couplenest.common;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Collections;

/**
 * 基于 Redis 的固定窗口计数限流。
 *
 * <p><b>为什么用 Lua：</b>朴素的 {@code INCR} + {@code EXPIRE} 是两次网络往返，
 * 如果进程在两条命令之间挂掉/断连，key 会永久存在，导致该维度被“永久限流”。
 * 把「自增 + 首次设置过期时间」放进一段 Lua 脚本，Redis 单线程执行脚本，
 * 天然具备原子性，不存在这个窗口。
 *
 * <p><b>为什么异常时放行（fail-open）：</b>限流是保护措施而不是核心业务，
 * Redis 抖动时如果直接抛异常，登录接口会整站 500 —— 影响面比“短时限流失效”大得多。
 * 因此这里捕获异常后放行并打 WARN，由调用方保证业务本身的安全（登录还要过微信校验）。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RateLimiter {

    /** KEYS[1]=计数 key，ARGV[1]=窗口毫秒数；返回自增后的计数值 */
    private static final DefaultRedisScript<Long> INCR_WITH_TTL_SCRIPT = new DefaultRedisScript<>(
            "local current = redis.call('INCR', KEYS[1]) "
                    + "if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end "
                    + "return current",
            Long.class);

    private final StringRedisTemplate redisTemplate;

    /**
     * 尝试获取一次配额。
     *
     * @param key    限流维度（如 rate:login:ip:1.2.3.4）
     * @param max    窗口内允许的最大次数
     * @param window 窗口长度
     * @return true=放行，false=超限
     */
    public boolean tryAcquire(String key, int max, Duration window) {
        try {
            Long count = redisTemplate.execute(INCR_WITH_TTL_SCRIPT,
                    Collections.singletonList(key), String.valueOf(window.toMillis()));
            return count == null || count <= max;
        } catch (DataAccessException e) {
            log.warn("限流组件不可用，本次放行: key={}", key, e);
            return true;
        }
    }
}
