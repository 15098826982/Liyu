package com.couplenest.service;

import com.couplenest.dto.WishAddRequest;
import com.couplenest.dto.WishUpdateRequest;
import com.couplenest.dto.WishVO;
import com.couplenest.entity.Wish;

import java.util.List;

/**
 * 心愿单业务。
 */
public interface WishService {

    /** 加心愿 */
    Wish add(WishAddRequest request);

    /** 查本家庭所有心愿（带创建人角色，未买在前，已买在后） */
    List<WishVO> list();

    /** 改心愿，只更新传了的字段 */
    void update(WishUpdateRequest request);

    /** 标记已买 */
    void bought(Long wishId);

    /** 删除心愿 */
    void delete(Long wishId);
}
