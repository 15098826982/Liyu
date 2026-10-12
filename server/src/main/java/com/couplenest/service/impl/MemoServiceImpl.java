package com.couplenest.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.couplenest.common.BusinessException;
import com.couplenest.common.UserContext;
import com.couplenest.dto.MemoAddRequest;
import com.couplenest.dto.MemoUpdateRequest;
import com.couplenest.dto.MemoVO;
import com.couplenest.entity.Memo;
import com.couplenest.entity.User;
import com.couplenest.mapper.MemoMapper;
import com.couplenest.mapper.UserMapper;
import com.couplenest.service.MemoService;
import com.couplenest.service.UserService;
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
 * 备忘录业务实现。
 * 写操作都带 familyId 条件，保证家庭级数据隔离。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MemoServiceImpl implements MemoService {

    /** 状态：0=待办 1=完成 */
    private static final int STATUS_TODO = 0;
    private static final int STATUS_DONE = 1;
    /** 默认便签颜色 */
    private static final String DEFAULT_COLOR = "yellow";
    /** 北京时间 */
    private static final ZoneId ZONE_BEIJING = ZoneId.of("Asia/Shanghai");

    private final MemoMapper memoMapper;
    private final UserMapper userMapper;
    private final UserService userService;

    @Override
    public Memo add(MemoAddRequest request) {
        Long familyId = userService.getCurrentFamilyId();

        Memo memo = new Memo();
        memo.setFamilyId(familyId);
        memo.setTitle(request.getTitle());
        memo.setContent(request.getContent());
        memo.setColor(request.getColor() == null ? DEFAULT_COLOR : request.getColor());
        memo.setCategory(request.getCategory());
        memo.setIsTodo(request.getIsTodo() == null ? 1 : request.getIsTodo());
        memo.setCreatorId(UserContext.getUserId());
        memo.setDone(STATUS_TODO);
        memo.setCreatedAt(LocalDateTime.now(ZONE_BEIJING).withNano(0));
        memoMapper.insert(memo);

        log.info("加备忘录成功: familyId={}, memoId={}", familyId, memo.getId());
        return memo;
    }

    @Override
    public List<MemoVO> list() {
        Long familyId = userService.getCurrentFamilyId();
        List<Memo> memos = memoMapper.selectList(Wrappers.<Memo>lambdaQuery()
                .eq(Memo::getFamilyId, familyId)
                .orderByAsc(Memo::getDone)
                .orderByDesc(Memo::getId));
        Map<Long, Integer> roleMap = roleMap(memos.stream().map(Memo::getCreatorId).collect(Collectors.toSet()));
        return memos.stream().map(m -> toVO(m, roleMap.get(m.getCreatorId()))).collect(Collectors.toList());
    }

    @Override
    public void update(MemoUpdateRequest request) {
        Long familyId = userService.getCurrentFamilyId();

        Memo update = new Memo();
        update.setTitle(request.getTitle());
        update.setContent(request.getContent());
        update.setColor(request.getColor());
        update.setCategory(request.getCategory());
        update.setIsTodo(request.getIsTodo());
        // MyBatis-Plus 默认跳过 null 字段，做到「只更新传了的字段」
        int rows = memoMapper.update(update, Wrappers.<Memo>lambdaUpdate()
                .eq(Memo::getId, request.getId())
                .eq(Memo::getFamilyId, familyId));
        if (rows == 0) {
            throw new BusinessException(BusinessException.CODE_MEMO_NOT_FOUND, "备忘录不存在");
        }
    }

    @Override
    public boolean toggle(Long memoId) {
        Long familyId = userService.getCurrentFamilyId();

        Memo memo = memoMapper.selectOne(Wrappers.<Memo>lambdaQuery()
                .eq(Memo::getId, memoId)
                .eq(Memo::getFamilyId, familyId));
        if (memo == null) {
            throw new BusinessException(BusinessException.CODE_MEMO_NOT_FOUND, "备忘录不存在");
        }

        boolean done = !(memo.getDone() != null && memo.getDone() == STATUS_DONE);
        Memo update = new Memo();
        update.setDone(done ? STATUS_DONE : STATUS_TODO);
        memoMapper.update(update, Wrappers.<Memo>lambdaUpdate()
                .eq(Memo::getId, memoId)
                .eq(Memo::getFamilyId, familyId));
        return done;
    }

    @Override
    public void done(Long memoId) {
        Long familyId = userService.getCurrentFamilyId();

        Memo memo = new Memo();
        memo.setDone(STATUS_DONE);
        int rows = memoMapper.update(memo, Wrappers.<Memo>lambdaUpdate()
                .eq(Memo::getId, memoId)
                .eq(Memo::getFamilyId, familyId));
        if (rows == 0) {
            throw new BusinessException(BusinessException.CODE_MEMO_NOT_FOUND, "备忘录不存在");
        }
    }

    @Override
    public void delete(Long memoId) {
        Long familyId = userService.getCurrentFamilyId();

        int rows = memoMapper.delete(Wrappers.<Memo>lambdaQuery()
                .eq(Memo::getId, memoId)
                .eq(Memo::getFamilyId, familyId));
        if (rows == 0) {
            throw new BusinessException(BusinessException.CODE_MEMO_NOT_FOUND, "备忘录不存在");
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

    private MemoVO toVO(Memo m, Integer creatorRole) {
        MemoVO vo = new MemoVO();
        vo.setId(m.getId());
        vo.setTitle(m.getTitle());
        vo.setContent(m.getContent());
        vo.setColor(m.getColor());
        vo.setCategory(m.getCategory());
        vo.setIsTodo(m.getIsTodo());
        vo.setDone(m.getDone());
        vo.setCreatorId(m.getCreatorId());
        vo.setCreatorRole(creatorRole);
        vo.setCreatedAt(m.getCreatedAt());
        return vo;
    }
}
