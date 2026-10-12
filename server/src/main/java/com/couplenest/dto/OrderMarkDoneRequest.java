package com.couplenest.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 订单状态变更请求。
 * status 不传时默认置为 1（已吃完），传 0 可改回未做。
 */
@Data
public class OrderMarkDoneRequest {

    @NotNull(message = "订单 id 不能为空")
    private Long orderId;

    /** 0=已下单 1=已吃完；不传按 1 处理 */
    private Integer status;
}
