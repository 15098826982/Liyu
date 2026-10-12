package com.couplenest.controller;

import com.couplenest.common.Result;
import com.couplenest.dto.MoodAddRequest;
import com.couplenest.dto.MoodVO;
import com.couplenest.entity.Mood;
import com.couplenest.service.MoodService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 心情接口。需要登录态。
 */
@RestController
@RequestMapping("/mood")
@RequiredArgsConstructor
public class MoodController {

    private final MoodService moodService;

    @PostMapping("/add")
    public Result<Mood> add(@Valid @RequestBody MoodAddRequest request) {
        return Result.ok(moodService.add(request));
    }

    @GetMapping("/list")
    public Result<List<MoodVO>> list() {
        return Result.ok(moodService.list());
    }
}
