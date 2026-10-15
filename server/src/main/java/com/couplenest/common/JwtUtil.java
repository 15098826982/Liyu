package com.couplenest.common;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

/**
 * JWT 生成与解析。payload 里放 userId 和 openid。
 */
@Component
public class JwtUtil {

    private static final String CLAIM_USER_ID = "userId";
    private static final String CLAIM_OPENID = "openid";

    /** HS256 要求密钥至少 256 bit，即 32 字节 */
    private static final int MIN_KEY_BYTES = 32;

    private final SecretKey key;
    private final long expireMillis;

    public JwtUtil(@Value("${jwt.secret:}") String secret,
                   @Value("${jwt.expire-days:7}") long expireDays) {
        // fail-fast：密钥缺失或强度不足时让应用启动失败，而不是带着弱密钥上线
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "未配置 JWT 密钥：请通过环境变量 JWT_SECRET 注入（生成示例：openssl rand -base64 48）");
        }
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < MIN_KEY_BYTES) {
            throw new IllegalStateException(String.format(
                    "JWT 密钥强度不足：HS256 要求至少 %d 字节（256 bit），当前仅 %d 字节，请更换 JWT_SECRET",
                    MIN_KEY_BYTES, keyBytes.length));
        }
        this.key = Keys.hmacShaKeyFor(keyBytes);
        this.expireMillis = expireDays * 24 * 60 * 60 * 1000L;
    }

    /**
     * 签发 token。
     * 每个 token 带一个随机 jti（JWT 标准的唯一标识），退出登录时黑名单里存的是 jti 而不是整串 token：
     * ① key 从 200+ 字符降到 36 字符；② 语义上"被拉黑的是这一次会话"，将来可以支持按设备踢人。
     */
    public String generate(Long userId, String openid) {
        Date now = new Date();
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .claim(CLAIM_USER_ID, userId)
                .claim(CLAIM_OPENID, openid)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expireMillis))
                .signWith(key)
                .compact();
    }

    /** 解析 token；签名不对或已过期会抛异常 */
    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
