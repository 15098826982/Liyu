package com.couplenest.service.impl;

import com.couplenest.common.BusinessException;
import com.couplenest.common.UserContext;
import com.couplenest.dto.UserUpdateProfileRequest;
import com.couplenest.entity.User;
import com.couplenest.mapper.UserMapper;
import com.couplenest.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

/**
 * 当前登录用户实现。
 */
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    /** 唯一索引名，用于判断是哪个索引冲突 */
    private static final String IDX_USER_FAMILY_ROLE = "uk_user_family_role";

    private final UserMapper userMapper;

    @Override
    public User getCurrentUser() {
        Long userId = UserContext.getUserId();
        User user = userId == null ? null : userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(BusinessException.CODE_UNAUTHORIZED, "用户不存在，请重新登录");
        }
        return user;
    }

    @Override
    public Long getCurrentFamilyId() {
        Long familyId = getCurrentUser().getFamilyId();
        if (familyId == null) {
            throw new BusinessException(BusinessException.CODE_NOT_IN_FAMILY, "你还没有加入小窝");
        }
        return familyId;
    }

    @Override
    public User updateProfile(UserUpdateProfileRequest request) {
        User current = getCurrentUser();
        if (request.getNickname() == null && request.getAvatar() == null) {
            return current;
        }
        User update = new User();
        update.setId(current.getId());
        update.setNickname(request.getNickname());
        update.setAvatar(request.getAvatar());
        userMapper.updateById(update);
        return userMapper.selectById(current.getId());
    }

    @Override
    public User setRole(Integer role) {
        User current = getCurrentUser();
        if (current.getFamilyId() == null) {
            throw new BusinessException(BusinessException.CODE_NOT_IN_FAMILY, "你还没有加入小窝");
        }
        User update = new User();
        update.setId(current.getId());
        update.setRole(role);
        try {
            userMapper.updateById(update);
        } catch (DuplicateKeyException e) {
            if (isDuplicateOf(e, IDX_USER_FAMILY_ROLE)) {
                throw new BusinessException(BusinessException.CODE_ROLE_TAKEN, "这个身份已经有人了");
            }
            throw e;
        }
        return userMapper.selectById(current.getId());
    }

    /** 判断 DuplicateKeyException 是否由指定唯一索引触发 */
    private boolean isDuplicateOf(DuplicateKeyException e, String indexName) {
        String msg = e.getMostSpecificCause().getMessage();
        return msg != null && msg.contains(indexName);
    }
}
