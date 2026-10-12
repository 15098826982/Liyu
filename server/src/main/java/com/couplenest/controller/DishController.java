package com.couplenest.controller;

import com.couplenest.common.Result;
import com.couplenest.dto.DishAddRequest;
import com.couplenest.dto.DishDeleteRequest;
import com.couplenest.dto.DishUpdateRequest;
import com.couplenest.entity.Dish;
import com.couplenest.service.DishService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 菜品接口。需要登录态。
 */
@RestController
@RequestMapping("/dish")
@RequiredArgsConstructor
public class DishController {

    private final DishService dishService;

    @PostMapping("/add")
    public Result<Dish> add(@Valid @RequestBody DishAddRequest request) {
        return Result.ok(dishService.add(request));
    }

    @GetMapping("/list")
    public Result<List<Dish>> list() {
        return Result.ok(dishService.list());
    }

    @PostMapping("/update")
    public Result<Void> update(@Valid @RequestBody DishUpdateRequest request) {
        dishService.update(request);
        return Result.ok(null);
    }

    @PostMapping("/delete")
    public Result<Void> delete(@Valid @RequestBody DishDeleteRequest request) {
        dishService.delete(request.getId());
        return Result.ok(null);
    }
}
