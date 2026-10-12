package com.couplenest.dto;

import com.couplenest.entity.Stage;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 目标返回。
 * status 已转成前端词表：'ongoing' / 'completed'。
 * stages 直接返回 [{text, completed}]。
 */
@Data
public class GoalVO {

    private Long id;
    private String title;
    private String description;
    private String icon;
    private String mode;
    private String frequency;
    private Integer duration;
    private LocalDate startDate;
    private LocalDate endDate;
    private LocalDate goalDate;
    private String status;
    private Integer progress;
    private List<Stage> stages;

    /** checkin 模式：累计打卡次数 */
    private Integer checkedDays;
    /** checkin 模式：当前用户今天是否打卡 */
    private Boolean todayChecked;
    /** checkin 模式：今天是否有任何人打卡 */
    private Boolean todayAnyChecked;

    private LocalDateTime createdAt;
}
