package com.couplenest.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 备忘录 id 请求（标记完成 / 删除）。
 */
@Data
public class MemoIdRequest {

    @NotNull(message = "备忘录 id 不能为空")
    private Long memoId;
}
