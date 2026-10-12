package com.couplenest.service;

import com.couplenest.dto.DishAddRequest;
import com.couplenest.dto.DishUpdateRequest;
import com.couplenest.entity.Dish;

import java.util.List;

/**
 * 菜品业务。菜单查询走 Redis 缓存，写操作清缓存。
 */
public interface DishService {

    /** 加菜 */
    Dish add(DishAddRequest request);

    /** 查本家庭所有菜（先走缓存） */
    List<Dish> list();

    /** 改菜 */
    void update(DishUpdateRequest request);

    /** 删菜 */
    void delete(Long dishId);
}
