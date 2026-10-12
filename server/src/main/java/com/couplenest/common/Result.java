package com.couplenest.common;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 统一响应信封 { code, msg, data }。
 * 成功：code=0，msg="ok"，data 放业务数据；
 * 业务异常：code 非 0，data=null。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Result<T> {

    /** 成功码 */
    public static final int CODE_SUCCESS = 0;

    private int code;
    private String msg;
    private T data;

    public static <T> Result<T> ok(T data) {
        return new Result<>(CODE_SUCCESS, "ok", data);
    }

    public static <T> Result<T> error(int code, String msg) {
        return new Result<>(code, msg, null);
    }
}
