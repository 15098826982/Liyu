package com.couplenest.controller;

import com.couplenest.common.Result;
import com.couplenest.dto.PeriodAddRequest;
import com.couplenest.entity.Period;
import com.couplenest.service.PeriodService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 经期接口。需要登录态。
 */
@RestController
@RequestMapping("/period")
@RequiredArgsConstructor
public class PeriodController {

    private final PeriodService periodService;

    @PostMapping("/add")
    public Result<Period> add(@Valid @RequestBody PeriodAddRequest request) {
        return Result.ok(periodService.add(request));
    }

    @GetMapping("/list")
    public Result<List<Period>> list() {
        return Result.ok(periodService.list());
    }
}
