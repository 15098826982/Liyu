package com.couplenest.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 记心情请求。
 */
@Data
public class MoodAddRequest {

    @NotBlank(message = "心情类型不能为空")
    private String moodType;

    private String content;
}
