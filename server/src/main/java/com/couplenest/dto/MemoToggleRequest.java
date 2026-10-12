package com.couplenest.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 切换备忘录完成状态请求。
 */
@Data
public class MemoToggleRequest {

    @NotNull(message = "备忘录 id 不能为空")
    private Long id;
}
