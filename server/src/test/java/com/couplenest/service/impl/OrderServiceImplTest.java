package com.couplenest.service.impl;

import com.couplenest.common.BusinessException;
import com.couplenest.common.UserContext;
import com.couplenest.dto.OrderAddRequest;
import com.couplenest.entity.Dish;
import com.couplenest.entity.Family;
import com.couplenest.entity.Order;
import com.couplenest.mapper.DishMapper;
import com.couplenest.mapper.FamilyMapper;
import com.couplenest.mapper.OrderMapper;
import com.couplenest.service.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.math.BigDecimal;
import java.sql.SQLException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 下单业务的并发防重与缓存失效测试（纯 Mockito，不连数据库）。
 * 这几条用例对应的就是简历上「唯一索引兜底 + 捕获 DuplicateKeyException」那段代码。
 */
@ExtendWith(MockitoExtension.class)
class OrderServiceImplTest {

    private static final Long USER_ID = 1L;
    private static final Long FAMILY_ID = 7L;
    private static final Long DISH_ID = 100L;
    /** schema.sql 里 order 表的唯一索引名 */
    private static final String ORDER_UNIQUE_INDEX = "uniq_family_date_dish";

    @Mock
    private OrderMapper orderMapper;
    @Mock
    private DishMapper dishMapper;
    @Mock
    private FamilyMapper familyMapper;
    @Mock
    private UserService userService;
    @Mock
    private StringRedisTemplate redisTemplate;
    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private OrderServiceImpl orderService;

    @BeforeEach
    void setUp() {
        UserContext.setUserId(USER_ID);
        when(userService.getCurrentFamilyId()).thenReturn(FAMILY_ID);
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void add_rejectsWhenFamilyIsNotFullYet() {
        Family family = new Family();
        family.setId(FAMILY_ID);
        family.setStatus(0);
        when(familyMapper.selectById(FAMILY_ID)).thenReturn(family);

        assertThatThrownBy(() -> orderService.add(request()))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(BusinessException.CODE_FAMILY_NOT_READY);

        verify(orderMapper, never()).insert(any(Order.class));
    }

    @Test
    void add_rejectsDishBelongingToAnotherFamily() {
        when(familyMapper.selectById(FAMILY_ID)).thenReturn(fullFamily());
        Dish dish = new Dish();
        dish.setId(DISH_ID);
        dish.setFamilyId(999L);
        when(dishMapper.selectById(DISH_ID)).thenReturn(dish);

        assertThatThrownBy(() -> orderService.add(request()))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(BusinessException.CODE_DISH_NOT_FOUND);

        verify(orderMapper, never()).insert(any(Order.class));
    }

    @Test
    void add_translatesOrderUniqueIndexConflictToFriendlyBusinessError() {
        when(familyMapper.selectById(FAMILY_ID)).thenReturn(fullFamily());
        when(dishMapper.selectById(DISH_ID)).thenReturn(ownDish());
        when(orderMapper.insert(any(Order.class))).thenThrow(duplicateOf(ORDER_UNIQUE_INDEX));

        assertThatThrownBy(() -> orderService.add(request()))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(BusinessException.CODE_ORDER_DUPLICATE);

        // 下单失败不应删缓存（缓存本来就没变）
        verify(redisTemplate, never()).delete(anyString());
    }

    @Test
    void add_rethrowsConflictCausedBySomeOtherIndex() {
        when(familyMapper.selectById(FAMILY_ID)).thenReturn(fullFamily());
        when(dishMapper.selectById(DISH_ID)).thenReturn(ownDish());
        when(orderMapper.insert(any(Order.class))).thenThrow(duplicateOf("some_other_index"));

        // 只把「本表唯一索引」的冲突翻译成友好提示，其他索引冲突不能吞掉
        assertThatThrownBy(() -> orderService.add(request()))
                .isInstanceOf(DuplicateKeyException.class);
    }

    @Test
    void add_snapshotsDishFieldsAndEvictsFamilyCache() {
        when(familyMapper.selectById(FAMILY_ID)).thenReturn(fullFamily());
        when(dishMapper.selectById(DISH_ID)).thenReturn(ownDish());
        when(orderMapper.insert(any(Order.class))).thenReturn(1);

        Order order = orderService.add(request());

        // 菜名/价格下单时快照落库：菜品后来改名改价，历史订单仍然还原的是当时的事实
        assertThat(order.getFamilyId()).isEqualTo(FAMILY_ID);
        assertThat(order.getDishName()).isEqualTo("红烧肉");
        assertThat(order.getPrice()).isEqualByComparingTo("38.50");
        assertThat(order.getCreatorId()).isEqualTo(USER_ID);

        // Cache-Aside：写操作后删除列表缓存，下次读重建
        verify(redisTemplate).delete("order:family:" + FAMILY_ID);
    }

    private OrderAddRequest request() {
        OrderAddRequest request = new OrderAddRequest();
        request.setDishId(DISH_ID);
        return request;
    }

    private Family fullFamily() {
        Family family = new Family();
        family.setId(FAMILY_ID);
        family.setStatus(1);
        return family;
    }

    private Dish ownDish() {
        Dish dish = new Dish();
        dish.setId(DISH_ID);
        dish.setFamilyId(FAMILY_ID);
        dish.setName("红烧肉");
        dish.setPrice(new BigDecimal("38.50"));
        return dish;
    }

    /** 构造一个与真实 MySQL 报错结构一致的唯一键冲突（消息里带索引名） */
    private DuplicateKeyException duplicateOf(String indexName) {
        return new DuplicateKeyException("duplicate key",
                new SQLException("Duplicate entry '7-2026-10-14-100' for key '" + indexName + "'"));
    }
}
