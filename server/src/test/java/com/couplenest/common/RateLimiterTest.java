package com.couplenest.common;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

/**
 * 限流组件测试：覆盖「放行 / 超限 / Redis 异常时 fail-open」三条分支。
 */
@ExtendWith(MockitoExtension.class)
class RateLimiterTest {

    private static final Duration WINDOW = Duration.ofMinutes(1);

    @Mock
    private StringRedisTemplate redisTemplate;

    @InjectMocks
    private RateLimiter rateLimiter;

    @Test
    void allowsRequestWithinLimit() {
        when(redisTemplate.execute(any(RedisScript.class), anyList(), any(Object[].class))).thenReturn(3L);

        assertThat(rateLimiter.tryAcquire("rate:login:ip:1.2.3.4", 10, WINDOW)).isTrue();
    }

    @Test
    void rejectsRequestOverLimit() {
        when(redisTemplate.execute(any(RedisScript.class), anyList(), any(Object[].class))).thenReturn(11L);

        assertThat(rateLimiter.tryAcquire("rate:login:ip:1.2.3.4", 10, WINDOW)).isFalse();
    }

    @Test
    void failsOpenWhenRedisIsUnavailable() {
        when(redisTemplate.execute(any(RedisScript.class), anyList(), any(Object[].class)))
                .thenThrow(new RedisConnectionFailureException("redis down"));

        // 限流是保护措施而非核心业务：Redis 抖动时放行，避免登录接口整站不可用
        assertThat(rateLimiter.tryAcquire("rate:login:ip:1.2.3.4", 10, WINDOW)).isTrue();
    }
}
