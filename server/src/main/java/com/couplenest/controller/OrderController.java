package com.couplenest.controller;

import com.couplenest.common.Result;
import com.couplenest.dto.OrderAddRequest;
import com.couplenest.dto.OrderMarkDoneRequest;
import com.couplenest.dto.RandomDishVO;
import com.couplenest.entity.Order;
import com.couplenest.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 点菜接口。需要登录态。
 */
@RestController
@RequestMapping("/order")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @PostMapping("/add")
    public Result<Order> add(@Valid @RequestBody OrderAddRequest request) {
        return Result.ok(orderService.add(request));
    }

    @GetMapping("/list")
    public Result<List<Order>> list() {
        return Result.ok(orderService.list());
    }

    @PostMapping("/markDone")
    public Result<Void> markDone(@Valid @RequestBody OrderMarkDoneRequest request) {
        orderService.markDone(request);
        return Result.ok(null);
    }

    @GetMapping("/random")
    public Result<RandomDishVO> random() {
        return Result.ok(orderService.random());
    }
}
