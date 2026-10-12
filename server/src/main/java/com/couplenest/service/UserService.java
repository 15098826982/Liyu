package com.couplenest.service;

import com.couplenest.dto.UserUpdateProfileRequest;
import com.couplenest.entity.User;

/**
 * 当前登录用户相关。
 */
public interface UserService {

    /** 当前登录用户（从库里读，保证 familyId/role 是最新值） */
    User getCurrentUser();

    /** 当前登录用户的 familyId；未加入家庭时抛业务异常 */
    Long getCurrentFamilyId();

    /** 更新个人资料（nickname/avatar 均可选，传了才更新），返回更新后的用户 */
    User updateProfile(UserUpdateProfileRequest request);

    /** 设置角色（1=老婆 2=老公），返回更新后的用户；家庭内该身份已有人时抛业务异常 */
    User setRole(Integer role);
}
