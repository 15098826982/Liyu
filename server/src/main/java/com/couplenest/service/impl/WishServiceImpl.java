package com.couplenest.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.couplenest.common.BusinessException;
import com.couplenest.common.UserContext;
import com.couplenest.dto.WishAddRequest;
import com.couplenest.dto.WishUpdateRequest;
import com.couplenest.dto.WishVO;
import com.couplenest.entity.User;
import com.couplenest.entity.Wish;
import com.couplenest.mapper.UserMapper;
import com.couplenest.mapper.WishMapper;
import com.couplenest.service.UserService;
import com.couplenest.service.WishService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 心愿单业务实现。
 * 写操作都带 familyId 条件，保证家庭级数据隔离。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WishServiceImpl implements WishService {

    /** 状态：0=待实现 1=已收到 */
    private static final int STATUS_WANTED = 0;
    private static final int STATUS_BOUGHT = 1;
    /** 北京时间 */
    private static final ZoneId ZONE_BEIJING = ZoneId.of("Asia/Shanghai");

    private final WishMapper wishMapper;
    private final UserMapper userMapper;
    private final UserService userService;

    @Override
    public Wish add(WishAddRequest request) {
        Long familyId = userService.getCurrentFamilyId();

        Wish wish = new Wish();
        wish.setFamilyId(familyId);
        wish.setTitle(request.getTitle());
        wish.setType(request.getType());
        wish.setDescription(request.getDescription());
        wish.setBudget(request.getBudget());
        wish.setLinkUrl(request.getLinkUrl());
        wish.setImageUrl(request.getImageUrl());
        wish.setCreatorId(UserContext.getUserId());
        wish.setStatus(request.getStatus() == null ? STATUS_WANTED : request.getStatus());
        wish.setCreatedAt(LocalDateTime.now(ZONE_BEIJING).withNano(0));
        wishMapper.insert(wish);

        log.info("加心愿成功: familyId={}, wishId={}", familyId, wish.getId());
        return wish;
    }

    @Override
    public List<WishVO> list() {
        Long familyId = userService.getCurrentFamilyId();
        List<Wish> wishes = wishMapper.selectList(Wrappers.<Wish>lambdaQuery()
                .eq(Wish::getFamilyId, familyId)
                .orderByAsc(Wish::getStatus)
                .orderByDesc(Wish::getId));
        Map<Long, Integer> roleMap = roleMap(wishes.stream().map(Wish::getCreatorId).collect(Collectors.toSet()));
        return wishes.stream().map(w -> toVO(w, roleMap.get(w.getCreatorId()))).collect(Collectors.toList());
    }

    @Override
    public void update(WishUpdateRequest request) {
        Long familyId = userService.getCurrentFamilyId();

        Wish update = new Wish();
        update.setTitle(request.getTitle());
        update.setType(request.getType());
        update.setDescription(request.getDescription());
        update.setBudget(request.getBudget());
        update.setLinkUrl(request.getLinkUrl());
        update.setImageUrl(request.getImageUrl());
        update.setStatus(request.getStatus());
        // MyBatis-Plus 默认跳过 null 字段，做到「只更新传了的字段」
        int rows = wishMapper.update(update, Wrappers.<Wish>lambdaUpdate()
                .eq(Wish::getId, request.getId())
                .eq(Wish::getFamilyId, familyId));
        if (rows == 0) {
            throw new BusinessException(BusinessException.CODE_WISH_NOT_FOUND, "心愿不存在");
        }
    }

    @Override
    public void bought(Long wishId) {
        Long familyId = userService.getCurrentFamilyId();

        Wish wish = new Wish();
        wish.setStatus(STATUS_BOUGHT);
        int rows = wishMapper.update(wish, Wrappers.<Wish>lambdaUpdate()
                .eq(Wish::getId, wishId)
                .eq(Wish::getFamilyId, familyId));
        if (rows == 0) {
            throw new BusinessException(BusinessException.CODE_WISH_NOT_FOUND, "心愿不存在");
        }
    }

    @Override
    public void delete(Long wishId) {
        Long familyId = userService.getCurrentFamilyId();

        int rows = wishMapper.delete(Wrappers.<Wish>lambdaQuery()
                .eq(Wish::getId, wishId)
                .eq(Wish::getFamilyId, familyId));
        if (rows == 0) {
            throw new BusinessException(BusinessException.CODE_WISH_NOT_FOUND, "心愿不存在");
        }
    }

    /** 批量查创建人角色：userId -> role */
    private Map<Long, Integer> roleMap(Set<Long> userIds) {
        userIds.remove(null);
        if (userIds.isEmpty()) {
            return Map.of();
        }
        return userMapper.selectBatchIds(userIds).stream()
                .filter(u -> u.getRole() != null)
                .collect(Collectors.toMap(User::getId, User::getRole, (a, b) -> a));
    }

    private WishVO toVO(Wish w, Integer creatorRole) {
        WishVO vo = new WishVO();
        vo.setId(w.getId());
        vo.setTitle(w.getTitle());
        vo.setType(w.getType());
        vo.setDescription(w.getDescription());
        vo.setBudget(w.getBudget());
        vo.setLinkUrl(w.getLinkUrl());
        vo.setImageUrl(w.getImageUrl());
        vo.setStatus(w.getStatus());
        vo.setCreatorId(w.getCreatorId());
        vo.setCreatorRole(creatorRole);
        vo.setCreatedAt(w.getCreatedAt());
        return vo;
    }
}
