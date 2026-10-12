package com.couplenest.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.couplenest.common.BusinessException;
import com.couplenest.common.UserContext;
import com.couplenest.dto.DishAddRequest;
import com.couplenest.dto.DishUpdateRequest;
import com.couplenest.entity.Dish;
import com.couplenest.mapper.DishMapper;
import com.couplenest.service.DishService;
import com.couplenest.service.UserService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

/**
 * 菜品业务实现。
 * 缓存 key：dish:family:{familyId}，TTL 30 分钟；加/改/删菜时删除该 key。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DishServiceImpl implements DishService {

    private static final String CACHE_KEY_PREFIX = "dish:family:";
    private static final Duration CACHE_TTL = Duration.ofMinutes(30);
    /** 防重唯一索引名 */
    private static final String IDX_DISH_FAMILY_NAME = "uk_family_name";
    /** 北京时间 */
    private static final ZoneId ZONE_BEIJING = ZoneId.of("Asia/Shanghai");

    private final DishMapper dishMapper;
    private final UserService userService;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public Dish add(DishAddRequest request) {
        Long familyId = userService.getCurrentFamilyId();

        Dish dish = new Dish();
        dish.setFamilyId(familyId);
        dish.setName(request.getName());
        dish.setCategory(request.getCategory());
        dish.setPrice(request.getPrice());
        dish.setImageUrl(request.getImageUrl());
        dish.setCreatorId(UserContext.getUserId());
        // 显式赋值创建时间，让新增响应里直接带上，不必等下次 list（对齐到秒，与库中 DATETIME 一致）
        dish.setCreatedAt(LocalDateTime.now(ZONE_BEIJING).withNano(0));
        try {
            dishMapper.insert(dish);
        } catch (DuplicateKeyException e) {
            if (isDuplicateOf(e, IDX_DISH_FAMILY_NAME)) {
                throw new BusinessException(BusinessException.CODE_DISH_DUPLICATE, "这道菜已经加过啦");
            }
            throw e;
        }

        evictCache(familyId);
        log.info("加菜成功: familyId={}, dishId={}", familyId, dish.getId());
        return dish;
    }

    @Override
    public List<Dish> list() {
        Long familyId = userService.getCurrentFamilyId();
        String key = cacheKey(familyId);

        List<Dish> cached = readCache(key);
        if (cached != null) {
            log.debug("菜品缓存命中: key={}", key);
            return cached;
        }

        List<Dish> dishes = dishMapper.selectList(Wrappers.<Dish>lambdaQuery()
                .eq(Dish::getFamilyId, familyId)
                .orderByDesc(Dish::getId));
        writeCache(key, dishes);
        return dishes;
    }

    @Override
    public void update(DishUpdateRequest request) {
        Long familyId = userService.getCurrentFamilyId();

        Dish dish = new Dish();
        dish.setName(request.getName());
        dish.setCategory(request.getCategory());
        dish.setPrice(request.getPrice());
        dish.setImageUrl(request.getImageUrl());
        int rows = dishMapper.update(dish, Wrappers.<Dish>lambdaUpdate()
                .eq(Dish::getId, request.getId())
                .eq(Dish::getFamilyId, familyId));
        if (rows == 0) {
            throw new BusinessException(BusinessException.CODE_DISH_NOT_FOUND, "菜品不存在");
        }

        evictCache(familyId);
    }

    @Override
    public void delete(Long dishId) {
        Long familyId = userService.getCurrentFamilyId();

        int rows = dishMapper.delete(Wrappers.<Dish>lambdaQuery()
                .eq(Dish::getId, dishId)
                .eq(Dish::getFamilyId, familyId));
        if (rows == 0) {
            throw new BusinessException(BusinessException.CODE_DISH_NOT_FOUND, "菜品不存在");
        }

        evictCache(familyId);
    }

    private String cacheKey(Long familyId) {
        return CACHE_KEY_PREFIX + familyId;
    }

    /** 读缓存；反序列化失败时降级查库，不影响主流程 */
    private List<Dish> readCache(String key) {
        String json = redisTemplate.opsForValue().get(key);
        if (json == null) {
            return null;
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<Dish>>() {
            });
        } catch (JsonProcessingException e) {
            log.warn("菜品缓存反序列化失败，降级查库: key={}", key, e);
            return null;
        }
    }

    private void writeCache(String key, List<Dish> dishes) {
        try {
            redisTemplate.opsForValue().set(key, objectMapper.writeValueAsString(dishes), CACHE_TTL);
        } catch (JsonProcessingException e) {
            log.warn("菜品缓存写入失败: key={}", key, e);
        }
    }

    private void evictCache(Long familyId) {
        redisTemplate.delete(cacheKey(familyId));
    }

    /** 判断 DuplicateKeyException 是否由指定唯一索引触发 */
    private boolean isDuplicateOf(DuplicateKeyException e, String indexName) {
        String msg = e.getMostSpecificCause().getMessage();
        return msg != null && msg.contains(indexName);
    }
}
