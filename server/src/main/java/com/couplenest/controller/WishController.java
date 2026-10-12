package com.couplenest.controller;

import com.couplenest.common.Result;
import com.couplenest.dto.WishAddRequest;
import com.couplenest.dto.WishIdRequest;
import com.couplenest.dto.WishUpdateRequest;
import com.couplenest.dto.WishVO;
import com.couplenest.entity.Wish;
import com.couplenest.service.WishService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 心愿单接口。需要登录态。
 */
@RestController
@RequestMapping("/wish")
@RequiredArgsConstructor
public class WishController {

    private final WishService wishService;

    @PostMapping("/add")
    public Result<Wish> add(@Valid @RequestBody WishAddRequest request) {
        return Result.ok(wishService.add(request));
    }

    @GetMapping("/list")
    public Result<List<WishVO>> list() {
        return Result.ok(wishService.list());
    }

    @PostMapping("/update")
    public Result<Void> update(@Valid @RequestBody WishUpdateRequest request) {
        wishService.update(request);
        return Result.ok(null);
    }

    @PostMapping("/bought")
    public Result<Void> bought(@Valid @RequestBody WishIdRequest request) {
        wishService.bought(request.getWishId());
        return Result.ok(null);
    }

    @PostMapping("/delete")
    public Result<Void> delete(@Valid @RequestBody WishIdRequest request) {
        wishService.delete(request.getWishId());
        return Result.ok(null);
    }
}
