package com.couplenest.controller;

import com.couplenest.common.Result;
import com.couplenest.dto.MemoAddRequest;
import com.couplenest.dto.MemoIdRequest;
import com.couplenest.dto.MemoToggleRequest;
import com.couplenest.dto.MemoUpdateRequest;
import com.couplenest.dto.MemoVO;
import com.couplenest.entity.Memo;
import com.couplenest.service.MemoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 备忘录接口。需要登录态。
 */
@RestController
@RequestMapping("/memo")
@RequiredArgsConstructor
public class MemoController {

    private final MemoService memoService;

    @PostMapping("/add")
    public Result<Memo> add(@Valid @RequestBody MemoAddRequest request) {
        return Result.ok(memoService.add(request));
    }

    @GetMapping("/list")
    public Result<List<MemoVO>> list() {
        return Result.ok(memoService.list());
    }

    @PostMapping("/update")
    public Result<Void> update(@Valid @RequestBody MemoUpdateRequest request) {
        memoService.update(request);
        return Result.ok(null);
    }

    @PostMapping("/toggle")
    public Result<Map<String, Object>> toggle(@Valid @RequestBody MemoToggleRequest request) {
        boolean isCompleted = memoService.toggle(request.getId());
        return Result.ok(Map.of("isCompleted", isCompleted));
    }

    @PostMapping("/done")
    public Result<Void> done(@Valid @RequestBody MemoIdRequest request) {
        memoService.done(request.getMemoId());
        return Result.ok(null);
    }

    @PostMapping("/delete")
    public Result<Void> delete(@Valid @RequestBody MemoIdRequest request) {
        memoService.delete(request.getMemoId());
        return Result.ok(null);
    }
}
