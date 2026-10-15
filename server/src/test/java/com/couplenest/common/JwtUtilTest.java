package com.couplenest.common;

import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;

import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * JwtUtil 单元测试：不依赖 Spring 容器、MySQL、Redis。
 */
class JwtUtilTest {

    /** 48 字节，满足 HS256 的 256 bit 要求 */
    private static final String SECRET = "unit-test-secret-key-0123456789abcdefghijklmnopqrst";
    private static final String ANOTHER_SECRET = "another-unit-test-secret-key-0123456789abcdefghij";

    private final JwtUtil jwtUtil = new JwtUtil(SECRET, 7);

    @Test
    void generate_thenParse_keepsUserIdAndOpenid() {
        String token = jwtUtil.generate(42L, "openid-abc");

        Claims claims = jwtUtil.parse(token);

        assertThat(claims.get("userId", Long.class)).isEqualTo(42L);
        assertThat(claims.get("openid", String.class)).isEqualTo("openid-abc");
    }

    @Test
    void generate_setsExpirationAboutSevenDaysLater() {
        Date before = new Date();
        Claims claims = jwtUtil.parse(jwtUtil.generate(1L, "o"));

        long ttlMillis = claims.getExpiration().getTime() - before.getTime();
        assertThat(ttlMillis).isBetween(7 * 24 * 3600_000L - 60_000L, 7 * 24 * 3600_000L + 60_000L);
    }

    @Test
    void generate_setsUniqueJtiPerToken() {
        Claims first = jwtUtil.parse(jwtUtil.generate(1L, "o"));
        Claims second = jwtUtil.parse(jwtUtil.generate(1L, "o"));

        assertThat(first.getId()).isNotBlank();
        assertThat(second.getId()).isNotBlank();
        // jti 是会话级唯一标识，退出登录的黑名单就是按它拉黑的
        assertThat(first.getId()).isNotEqualTo(second.getId());
    }

    @Test
    void parse_rejectsTamperedToken() {
        String token = jwtUtil.generate(1L, "o");
        char last = token.charAt(token.length() - 1);
        String tampered = token.substring(0, token.length() - 1) + (last == 'A' ? 'B' : 'A');

        assertThatThrownBy(() -> jwtUtil.parse(tampered)).isInstanceOf(Exception.class);
    }

    @Test
    void parse_rejectsTokenSignedByAnotherKey() {
        String foreignToken = new JwtUtil(ANOTHER_SECRET, 7).generate(1L, "o");

        assertThatThrownBy(() -> jwtUtil.parse(foreignToken)).isInstanceOf(Exception.class);
    }

    @Test
    void constructor_failsFastWhenSecretIsBlank() {
        assertThatThrownBy(() -> new JwtUtil("   ", 7))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT");
    }

    @Test
    void constructor_failsFastWhenSecretIsTooShortForHs256() {
        assertThatThrownBy(() -> new JwtUtil("too-short-secret", 7))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("32");
    }
}
