package com.couplenest.controller;

import com.couplenest.common.BusinessException;
import com.couplenest.common.RateLimiter;
import com.couplenest.common.Result;
import com.couplenest.common.UserContext;
import com.couplenest.dto.FamilyCreateRequest;
import com.couplenest.dto.FamilyInfoVO;
import com.couplenest.dto.FamilyJoinRequest;
import com.couplenest.dto.FamilyUpdateRequest;
import com.couplenest.dto.FamilyVO;
import com.couplenest.service.FamilyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * 家庭接口。需要登录态，userId 从 UserContext 取（不信任前端传值）。
 */
@RestController
@RequestMapping("/family")
@RequiredArgsConstructor
public class FamilyController {

    /** 同一用户 1 分钟内最多尝试 5 次邀请码 */
    private static final int JOIN_MAX_PER_WINDOW = 5;
    private static final Duration JOIN_WINDOW = Duration.ofMinutes(1);
    private static final String RATE_JOIN_PREFIX = "rate:family:join:";

    private final FamilyService familyService;
    private final RateLimiter rateLimiter;

    @PostMapping("/create")
    public Result<FamilyVO> create(@Valid @RequestBody FamilyCreateRequest request) {
        return Result.ok(familyService.create(UserContext.getUserId(), request.getName()));
    }

    /**
     * 加入家庭。
     * 限流原因：邀请码只有 6 位（数字 100 万种、字母数字 8.9 亿种），
     * 不限速的话脚本可以持续枚举并混进陌生人的家庭、读到对方的全部数据。
     */
    @PostMapping("/join")
    public Result<FamilyVO> join(@Valid @RequestBody FamilyJoinRequest request) {
        Long userId = UserContext.getUserId();
        if (!rateLimiter.tryAcquire(RATE_JOIN_PREFIX + userId, JOIN_MAX_PER_WINDOW, JOIN_WINDOW)) {
            throw new BusinessException(BusinessException.CODE_TOO_MANY_REQUESTS, "尝试太频繁，请稍后再试");
        }
        return Result.ok(familyService.join(userId, request.getInviteCode()));
    }

    @GetMapping("/getInfo")
    public Result<FamilyInfoVO> getInfo() {
        return Result.ok(familyService.getInfo(UserContext.getUserId()));
    }

    @PostMapping("/updateInfo")
    public Result<Void> updateInfo(@Valid @RequestBody FamilyUpdateRequest request) {
        familyService.updateInfo(UserContext.getUserId(), request);
        return Result.ok(null);
    }

    @PostMapping("/leave")
    public Result<Void> leave() {
        familyService.leave(UserContext.getUserId());
        return Result.ok(null);
    }
}
