package com.couplenest.controller;

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

/**
 * 家庭接口。需要登录态，userId 从 UserContext 取（不信任前端传值）。
 */
@RestController
@RequestMapping("/family")
@RequiredArgsConstructor
public class FamilyController {

    private final FamilyService familyService;

    @PostMapping("/create")
    public Result<FamilyVO> create(@Valid @RequestBody FamilyCreateRequest request) {
        return Result.ok(familyService.create(UserContext.getUserId(), request.getName()));
    }

    @PostMapping("/join")
    public Result<FamilyVO> join(@Valid @RequestBody FamilyJoinRequest request) {
        return Result.ok(familyService.join(UserContext.getUserId(), request.getInviteCode()));
    }

    @GetMapping("/getInfo")
    public Result<FamilyInfoVO> getInfo() {
        return Result.ok(familyService.getInfo(UserContext.getUserId()));
    }

    @PostMapping("/updateInfo")
    public Result<Void> updateInfo(@RequestBody FamilyUpdateRequest request) {
        familyService.updateInfo(UserContext.getUserId(), request);
        return Result.ok(null);
    }

    @PostMapping("/leave")
    public Result<Void> leave() {
        familyService.leave(UserContext.getUserId());
        return Result.ok(null);
    }
}
