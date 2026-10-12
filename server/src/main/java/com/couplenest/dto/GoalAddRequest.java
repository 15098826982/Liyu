package com.couplenest.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

/**
 * 新增目标请求。
 * startDate / goalDate 用 String 接收（YYYY-MM-DD），避免前端传空串时反序列化失败。
 * stages 前端传字符串数组，service 里转成 [{text, completed:false}]。
 */
@Data
public class GoalAddRequest {

    @NotBlank(message = "目标名称不能为空")
    private String title;

    private String description;

    private String icon;

    /** checkin=每日打卡 wish=一次愿望 */
    @NotBlank(message = "目标类型不能为空")
    private String mode;

    private String frequency;

    private Integer duration;

    private String startDate;

    /** wish 模式的目标日 */
    private String goalDate;

    /** wish 模式的阶段文字数组 */
    private List<String> stages;
}
