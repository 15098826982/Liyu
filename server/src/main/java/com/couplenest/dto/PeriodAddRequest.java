package com.couplenest.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

/**
 * 记经期请求。
 */
@Data
public class PeriodAddRequest {

    @NotNull(message = "日期不能为空")
    private LocalDate periodDate;

    private String note;
}
