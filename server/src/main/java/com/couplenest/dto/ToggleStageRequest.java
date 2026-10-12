package com.couplenest.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 勾选 / 取消勾选某个阶段。
 */
@Data
public class ToggleStageRequest {

    @NotNull(message = "目标 id 不能为空")
    private Long goalId;

    @NotNull(message = "阶段下标不能为空")
    @Min(value = 0, message = "阶段下标不合法")
    private Integer stageIndex;
}
