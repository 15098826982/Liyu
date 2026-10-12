package com.couplenest.dto;

import com.couplenest.entity.Stage;
import lombok.Data;

import java.util.List;

/**
 * 愿望型目标「一键完成」/「勾选阶段」的返回。
 * action：complete=已完成 null=无特殊动作（取消勾选）。
 */
@Data
public class GoalToggleVO {

    private String status;
    private Integer progress;
    private List<Stage> stages;
    private String action;
}
