package com.couplenest.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 改备忘录请求。id 必填，其余字段可选，只更新传了（非 null）的字段。
 */
@Data
public class MemoUpdateRequest {

    @NotNull(message = "备忘录 id 不能为空")
    private Long id;

    /** 便签标题 */
    private String title;

    private String content;

    /** 便签颜色 */
    private String color;

    /** 分类 */
    private String category;

    /** 是否待办事项：0=否 1=是 */
    private Integer isTodo;
}
