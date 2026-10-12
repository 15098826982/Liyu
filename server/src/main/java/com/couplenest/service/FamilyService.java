package com.couplenest.service;

import com.couplenest.dto.FamilyInfoVO;
import com.couplenest.dto.FamilyUpdateRequest;
import com.couplenest.dto.FamilyVO;

/**
 * 家庭相关业务。
 */
public interface FamilyService {

    /** 创建家庭：生成邀请码，创建者成为老公(role=2) */
    FamilyVO create(Long userId, String name);

    /** 加入家庭：加入者成为老婆(role=1) */
    FamilyVO join(Long userId, String inviteCode);

    /** 查询当前用户所属家庭（含成员）；未加入返回 null */
    FamilyInfoVO getInfo(Long userId);

    /** 更新当前用户所属家庭信息（全部可选，传了才更新） */
    void updateInfo(Long userId, FamilyUpdateRequest request);

    /** 退出家庭：清空当前用户的 family_id / role；未加入时抛业务异常 */
    void leave(Long userId);
}
