package com.couplenest.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.couplenest.common.BusinessException;
import com.couplenest.common.UserContext;
import com.couplenest.dto.OrderAddRequest;
import com.couplenest.dto.OrderMarkDoneRequest;
import com.couplenest.dto.RandomDishVO;
import com.couplenest.entity.Dish;
import com.couplenest.entity.Family;
import com.couplenest.entity.Order;
import com.couplenest.mapper.DishMapper;
import com.couplenest.mapper.FamilyMapper;
import com.couplenest.mapper.OrderMapper;
import com.couplenest.service.OrderService;
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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

/**
 * 下单业务实现。
 * 订单列表缓存 key：order:family:{familyId}，TTL 30 分钟；下单/改状态时删除该 key。
 * random() 内部查今日订单，实时性要求高，不走缓存。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    /** 家庭状态：两人已齐 */
    private static final int FAMILY_STATUS_FULL = 1;
    /** 订单状态：已吃完 */
    private static final int ORDER_STATUS_DONE = 1;
    /** 防重唯一索引名 */
    private static final String IDX_ORDER_FAMILY_DATE_DISH = "uniq_family_date_dish";
    /** 北京时间 */
    private static final ZoneId ZONE_BEIJING = ZoneId.of("Asia/Shanghai");
    /** 订单列表缓存 key 前缀 */
    private static final String CACHE_KEY_PREFIX = "order:family:";
    private static final Duration CACHE_TTL = Duration.ofMinutes(30);

    private final OrderMapper orderMapper;
    private final DishMapper dishMapper;
    private final FamilyMapper familyMapper;
    private final UserService userService;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public Order add(OrderAddRequest request) {
        Long userId = UserContext.getUserId();
        Long familyId = userService.getCurrentFamilyId();

        // 1. 家庭必须已齐（老婆已加入）
        Family family = familyMapper.selectById(familyId);
        if (family == null || family.getStatus() == null || family.getStatus() != FAMILY_STATUS_FULL) {
            throw new BusinessException(BusinessException.CODE_FAMILY_NOT_READY, "等对象加入小窝后再点菜");
        }

        // 2. 取菜品，顺便校验菜品属于本家庭
        Dish dish = dishMapper.selectById(request.getDishId());
        if (dish == null || !familyId.equals(dish.getFamilyId())) {
            throw new BusinessException(BusinessException.CODE_DISH_NOT_FOUND, "菜品不存在");
        }

        // 3. 直接插入，重复交给唯一索引兜底（不做插入前查重）
        Order order = new Order();
        order.setFamilyId(familyId);
        order.setDishId(dish.getId());
        order.setDishName(dish.getName());   // 菜名快照
        order.setPrice(dish.getPrice());     // 价格快照
        order.setOrderDate(LocalDate.now(ZONE_BEIJING));
        order.setCreatorId(userId);
        // 显式赋值创建时间，让新增响应里直接带上（对齐到秒，与库中 DATETIME 一致）
        order.setCreatedAt(LocalDateTime.now(ZONE_BEIJING).withNano(0));
        try {
            orderMapper.insert(order);
        } catch (DuplicateKeyException e) {
            if (isDuplicateOf(e, IDX_ORDER_FAMILY_DATE_DISH)) {
                throw new BusinessException(BusinessException.CODE_ORDER_DUPLICATE, "今天这道菜已经点过啦");
            }
            throw e;
        }

        evictCache(familyId);
        log.info("下单成功: familyId={}, dishId={}, orderId={}", familyId, dish.getId(), order.getId());
        return order;
    }

    @Override
    public List<Order> list() {
        Long familyId = userService.getCurrentFamilyId();
        String key = cacheKey(familyId);

        List<Order> cached = readCache(key);
        if (cached != null) {
            log.debug("订单缓存命中: key={}", key);
            return cached;
        }

        List<Order> orders = orderMapper.selectList(Wrappers.<Order>lambdaQuery()
                .eq(Order::getFamilyId, familyId)
                .orderByDesc(Order::getOrderDate));
        writeCache(key, orders);
        return orders;
    }

    @Override
    public void markDone(OrderMarkDoneRequest request) {
        Long familyId = userService.getCurrentFamilyId();
        // 不传 status 默认置为已吃完；传 0 可改回未做
        int status = request.getStatus() == null ? ORDER_STATUS_DONE : request.getStatus();

        Order update = new Order();
        update.setStatus(status);
        int rows = orderMapper.update(update, Wrappers.<Order>lambdaUpdate()
                .eq(Order::getId, request.getOrderId())
                .eq(Order::getFamilyId, familyId));
        if (rows == 0) {
            throw new BusinessException(BusinessException.CODE_ORDER_NOT_FOUND, "订单不存在");
        }

        evictCache(familyId);
    }

    @Override
    public RandomDishVO random() {
        Long familyId = userService.getCurrentFamilyId();
        RandomDishVO vo = new RandomDishVO();

        List<Dish> dishes = dishMapper.selectList(Wrappers.<Dish>lambdaQuery()
                .eq(Dish::getFamilyId, familyId));
        if (dishes.isEmpty()) {
            vo.setDishes(Collections.emptyList());
            return vo;
        }

        // 排除今天已经点过的菜
        List<Order> todayOrders = orderMapper.selectList(Wrappers.<Order>lambdaQuery()
                .eq(Order::getFamilyId, familyId)
                .eq(Order::getOrderDate, LocalDate.now(ZONE_BEIJING)));
        Set<Long> orderedDishIds = todayOrders.stream()
                .map(Order::getDishId)
                .collect(Collectors.toSet());

        List<Dish> remaining = dishes.stream()
                .filter(d -> !orderedDishIds.contains(d.getId()))
                .collect(Collectors.toList());
        if (remaining.isEmpty()) {
            vo.setDishes(Collections.emptyList());
            return vo;
        }

        Dish pick = remaining.get(ThreadLocalRandom.current().nextInt(remaining.size()));
        vo.setDishes(Collections.singletonList(pick));
        return vo;
    }

    private String cacheKey(Long familyId) {
        return CACHE_KEY_PREFIX + familyId;
    }

    /** 读缓存；反序列化失败时降级查库，不影响主流程 */
    private List<Order> readCache(String key) {
        String json = redisTemplate.opsForValue().get(key);
        if (json == null) {
            return null;
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<Order>>() {
            });
        } catch (JsonProcessingException e) {
            log.warn("订单缓存反序列化失败，降级查库: key={}", key, e);
            return null;
        }
    }

    private void writeCache(String key, List<Order> orders) {
        try {
            redisTemplate.opsForValue().set(key, objectMapper.writeValueAsString(orders), CACHE_TTL);
        } catch (JsonProcessingException e) {
            log.warn("订单缓存写入失败: key={}", key, e);
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