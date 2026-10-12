package com.couplenest.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.couplenest.common.UserContext;
import com.couplenest.dto.PeriodAddRequest;
import com.couplenest.entity.Period;
import com.couplenest.mapper.PeriodMapper;
import com.couplenest.service.PeriodService;
import com.couplenest.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

/**
 * 经期业务实现。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PeriodServiceImpl implements PeriodService {

    /** 北京时间 */
    private static final ZoneId ZONE_BEIJING = ZoneId.of("Asia/Shanghai");

    private final PeriodMapper periodMapper;
    private final UserService userService;

    @Override
    public Period add(PeriodAddRequest request) {
        Long familyId = userService.getCurrentFamilyId();

        Period period = new Period();
        period.setFamilyId(familyId);
        period.setUserId(UserContext.getUserId());
        period.setPeriodDate(request.getPeriodDate());
        period.setNote(request.getNote());
        period.setCreatedAt(LocalDateTime.now(ZONE_BEIJING).withNano(0));
        periodMapper.insert(period);

        log.info("记经期成功: familyId={}, periodId={}", familyId, period.getId());
        return period;
    }

    @Override
    public List<Period> list() {
        Long familyId = userService.getCurrentFamilyId();
        return periodMapper.selectList(Wrappers.<Period>lambdaQuery()
                .eq(Period::getFamilyId, familyId)
                .orderByDesc(Period::getPeriodDate)
                .orderByDesc(Period::getId));
    }
}
