package com.couplenest.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.couplenest.common.BusinessException;
import com.couplenest.common.UserContext;
import com.couplenest.entity.Checkin;
import com.couplenest.mapper.CheckinMapper;
import com.couplenest.service.CheckinService;
import com.couplenest.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;

/**
 * 打卡业务实现。
 * 每人每天一次，重复交给唯一索引兜底（不做插入前查重）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CheckinServiceImpl implements CheckinService {

    /** 打卡防重唯一索引名 */
    private static final String IDX_CHECKIN_FAMILY_USER_DATE = "uniq_family_user_date";
    /** 北京时间 */
    private static final ZoneId ZONE_BEIJING = ZoneId.of("Asia/Shanghai");

    private final CheckinMapper checkinMapper;
    private final UserService userService;

    @Override
    public Checkin doCheckin() {
        Long familyId = userService.getCurrentFamilyId();
        Long userId = UserContext.getUserId();

        Checkin checkin = new Checkin();
        checkin.setFamilyId(familyId);
        checkin.setUserId(userId);
        checkin.setCheckinDate(LocalDate.now(ZONE_BEIJING));
        try {
            checkinMapper.insert(checkin);
        } catch (DuplicateKeyException e) {
            if (isDuplicateOf(e, IDX_CHECKIN_FAMILY_USER_DATE)) {
                throw new BusinessException(BusinessException.CODE_CHECKIN_DUPLICATE, "今天已经打过卡了");
            }
            throw e;
        }

        log.info("打卡成功: familyId={}, userId={}", familyId, userId);
        return checkin;
    }

    @Override
    public boolean hasCheckedInToday() {
        Long familyId = userService.getCurrentFamilyId();
        Long userId = UserContext.getUserId();
        Long count = checkinMapper.selectCount(Wrappers.<Checkin>lambdaQuery()
                .eq(Checkin::getFamilyId, familyId)
                .eq(Checkin::getUserId, userId)
                .eq(Checkin::getCheckinDate, LocalDate.now(ZONE_BEIJING)));
        return count != null && count > 0;
    }

    /** 判断 DuplicateKeyException 是否由指定唯一索引触发 */
    private boolean isDuplicateOf(DuplicateKeyException e, String indexName) {
        String msg = e.getMostSpecificCause().getMessage();
        return msg != null && msg.contains(indexName);
    }
}
