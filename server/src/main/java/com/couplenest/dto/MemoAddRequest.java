package com.couplenest.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 加备忘录请求。
 */
@Data
public class MemoAddRequest {

    /** 便签标题 */
    private String title;

    @NotBlank(message = "内容不能为空")
    private String content;

    /** 便签颜色，默认 yellow */
    private String color;

    /** 分类 */
    private String category;

    /** 是否待办事项：0=否 1=是，默认 1 */
    private Integer isTodo;
}
