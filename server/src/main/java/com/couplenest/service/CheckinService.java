package com.couplenest.service;

import com.couplenest.entity.Checkin;

/**
 * 打卡业务。
 */
public interface CheckinService {

    /** 今天打卡；已打过抛业务异常 */
    Checkin doCheckin();

    /** 当前用户今天是否已打卡 */
    boolean hasCheckedInToday();
}
