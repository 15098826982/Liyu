package com.couplenest.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.couplenest.common.JwtUtil;
import com.couplenest.dto.LoginVO;
import com.couplenest.entity.User;
import com.couplenest.mapper.UserMapper;
import com.couplenest.service.AuthService;
import com.couplenest.service.WechatService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Date;

/**
 * 微信登录实现。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    /** token 黑名单 key 前缀 */
    private static final String BLACKLIST_PREFIX = "jwt:blacklist:";
    private static final String BEARER_PREFIX = "Bearer ";

    private final WechatService wechatService;
    private final UserMapper userMapper;
    private final JwtUtil jwtUtil;
    private final StringRedisTemplate redisTemplate;

    @Override
    public LoginVO login(String code) {
        String openid = wechatService.code2Session(code);

        User user = userMapper.selectOne(Wrappers.<User>lambdaQuery().eq(User::getOpenid, openid));
        if (user == null) {
            // 新用户：nickname/avatar 先空着，family/role 为空
            user = new User();
            user.setOpenid(openid);
            userMapper.insert(user);
            log.info("新用户注册: userId={}, openid={}", user.getId(), openid);
        }

        String token = jwtUtil.generate(user.getId(), openid);

        LoginVO vo = new LoginVO();
        vo.setToken(token);
        vo.setUserId(user.getId());
        vo.setFamilyId(user.getFamilyId());
        vo.setRole(user.getRole());
        return vo;
    }

    @Override
    public void logout(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith(BEARER_PREFIX)) {
            return;
        }
        String token = authorizationHeader.substring(BEARER_PREFIX.length()).trim();
        try {
            Claims claims = jwtUtil.parse(token);
            String jti = claims.getId();
            if (jti == null || jti.isEmpty()) {
                // 改造前签发的旧 token 没有 jti，无法拉黑；它们会在 7 天内自然过期
                log.warn("token 缺少 jti，跳过黑名单写入");
                return;
            }
            Date expiration = claims.getExpiration();
            long ttlMillis = expiration.getTime() - System.currentTimeMillis();
            if (ttlMillis > 0) {
                // 黑名单存活到 token 自然过期即可，之后无需再拦
                redisTemplate.opsForValue().set(BLACKLIST_PREFIX + jti, "1", Duration.ofMillis(ttlMillis));
            }
        } catch (Exception e) {
            // token 已过期或非法，本身已无法通过校验，无需拉黑
            log.warn("退出登录解析 token 失败: {}", e.getMessage());
        }
    }
}
