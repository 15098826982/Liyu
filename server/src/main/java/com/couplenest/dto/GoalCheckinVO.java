package com.couplenest.dto;

import lombok.Data;

/**
 * 目标打卡 / 取消打卡的返回。
 * status 为前端词表：'ongoing' / 'completed'。
 */
@Data
public class GoalCheckinVO {

    private Integer checkedDays;
    private Integer progress;
    private String status;
    private Boolean todayChecked;
    private Boolean todayAnyChecked;

    /** checkin=已打卡 cancel=已取消 */
    private String action;
}
