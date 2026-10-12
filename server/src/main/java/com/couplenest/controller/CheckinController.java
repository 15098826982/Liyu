package com.couplenest.controller;

import com.couplenest.common.Result;
import com.couplenest.entity.Checkin;
import com.couplenest.service.CheckinService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 打卡接口。需要登录态。
 */
@RestController
@RequestMapping("/checkin")
@RequiredArgsConstructor
public class CheckinController {

    private final CheckinService checkinService;

    @PostMapping("/do")
    public Result<Checkin> doCheckin() {
        return Result.ok(checkinService.doCheckin());
    }

    @GetMapping("/status")
    public Result<Boolean> status() {
        return Result.ok(checkinService.hasCheckedInToday());
    }
}
