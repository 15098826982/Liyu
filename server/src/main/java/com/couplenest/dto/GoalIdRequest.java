package com.couplenest.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 目标 id 请求（打卡 / 完成翻转 / 删除）。
 */
@Data
public class GoalIdRequest {

    @NotNull(message = "目标 id 不能为空")
    private Long goalId;
}
