package com.couplenest.common;

/**
 * 业务异常，由全局异常处理器转成 { code, msg } 返回。
 */
public class BusinessException extends RuntimeException {

    /** 未登录 / token 无效 */
    public static final int CODE_UNAUTHORIZED = 401;
    /** 邀请码无效 */
    public static final int CODE_INVALID_INVITE_CODE = 1001;
    /** 老婆位置已有人 */
    public static final int CODE_WIFE_SEAT_TAKEN = 1002;
    /** 邀请码生成失败 */
    public static final int CODE_INVITE_CODE_GENERATE_FAIL = 1003;
    /** 微信登录失败 */
    public static final int CODE_WECHAT_LOGIN_FAIL = 1004;
    /** 未加入家庭 */
    public static final int CODE_NOT_IN_FAMILY = 1005;
    /** 家庭未齐（等对象加入） */
    public static final int CODE_FAMILY_NOT_READY = 1006;
    /** 菜品不存在 */
    public static final int CODE_DISH_NOT_FOUND = 1007;
    /** 今天已点过这道菜 */
    public static final int CODE_ORDER_DUPLICATE = 1008;
    /** 心愿不存在 */
    public static final int CODE_WISH_NOT_FOUND = 1009;
    /** 备忘录不存在 */
    public static final int CODE_MEMO_NOT_FOUND = 1010;
    /** 今天已打卡 */
    public static final int CODE_CHECKIN_DUPLICATE = 1011;
    /** 同一家庭重名菜品 */
    public static final int CODE_DISH_DUPLICATE = 1012;
    /** 该身份已经被占用（家庭内一老公一老婆） */
    public static final int CODE_ROLE_TAKEN = 1013;
    /** 目标不存在（沿用通用「资源不存在」码） */
    public static final int CODE_GOAL_NOT_FOUND = 1014;
    /** 操作太频繁（登录限流） */
    public static final int CODE_TOO_MANY_REQUESTS = 1015;
    /** 订单不存在（沿用通用「资源不存在」码 1007） */
    public static final int CODE_ORDER_NOT_FOUND = 1007;

    private final int code;

    public BusinessException(int code, String msg) {
        super(msg);
        this.code = code;
    }

    public int getCode() {
        return code;
    }
}
