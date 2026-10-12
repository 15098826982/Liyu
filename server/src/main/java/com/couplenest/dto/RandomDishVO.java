package com.couplenest.dto;

import com.couplenest.entity.Dish;
import lombok.Data;

import java.util.List;

/**
 * 随机点菜返回：{ dishes:[ 随机一道菜 ] }，全部点过时为空数组。
 */
@Data
public class RandomDishVO {

    private List<Dish> dishes;
}
