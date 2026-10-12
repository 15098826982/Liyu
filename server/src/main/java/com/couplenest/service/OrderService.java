package com.couplenest.service;

import com.couplenest.dto.OrderAddRequest;
import com.couplenest.dto.OrderMarkDoneRequest;
import com.couplenest.dto.RandomDishVO;
import com.couplenest.entity.Order;

import java.util.List;

/**
 * 下单业务。
 */
public interface OrderService {

    /** 下单：校验家庭已齐，写入菜品名/价格快照 */
    Order add(OrderAddRequest request);

    /** 本家庭订单列表（按下单日期倒序） */
    List<Order> list();

    /** 变更订单状态：校验订单属于当前家庭 */
    void markDone(OrderMarkDoneRequest request);

    /** 随机点菜：排除今天已点过的菜；全部点过时 dishes 为空数组 */
    RandomDishVO random();
}
