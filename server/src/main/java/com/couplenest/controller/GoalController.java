package com.couplenest.controller;

import com.couplenest.common.Result;
import com.couplenest.dto.GoalAddRequest;
import com.couplenest.dto.GoalCheckinVO;
import com.couplenest.dto.GoalIdRequest;
import com.couplenest.dto.GoalToggleVO;
import com.couplenest.dto.GoalVO;
import com.couplenest.dto.ToggleStageRequest;
import com.couplenest.entity.Goal;
import com.couplenest.service.GoalService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 目标管理接口（打卡页）。需要登录态。
 */
@RestController
@RequestMapping("/goal")
@RequiredArgsConstructor
public class GoalController {

    private final GoalService goalService;

    @PostMapping("/add")
    public Result<Goal> add(@Valid @RequestBody GoalAddRequest request) {
        return Result.ok(goalService.add(request));
    }

    @GetMapping("/list")
    public Result<List<GoalVO>> list() {
        return Result.ok(goalService.list());
    }

    @PostMapping("/checkin")
    public Result<GoalCheckinVO> checkin(@Valid @RequestBody GoalIdRequest request) {
        return Result.ok(goalService.checkin(request.getGoalId()));
    }

    @PostMapping("/toggle")
    public Result<GoalToggleVO> toggle(@Valid @RequestBody GoalIdRequest request) {
        return Result.ok(goalService.toggle(request.getGoalId()));
    }

    @PostMapping("/toggleStage")
    public Result<GoalToggleVO> toggleStage(@Valid @RequestBody ToggleStageRequest request) {
        return Result.ok(goalService.toggleStage(request.getGoalId(), request.getStageIndex()));
    }

    @PostMapping("/delete")
    public Result<Void> delete(@Valid @RequestBody GoalIdRequest request) {
        goalService.delete(request.getGoalId());
        return Result.ok(null);
    }
}
