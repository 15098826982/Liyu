package com.couplenest.service;

import com.couplenest.dto.PeriodAddRequest;
import com.couplenest.entity.Period;

import java.util.List;

/**
 * 经期业务。
 */
public interface PeriodService {

    /** 记一条经期 */
    Period add(PeriodAddRequest request);

    /** 查本家庭经期记录（按日期倒序） */
    List<Period> list();
}
