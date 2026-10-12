package com.couplenest.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.couplenest.common.UserContext;
import com.couplenest.dto.MoodAddRequest;
import com.couplenest.dto.MoodVO;
import com.couplenest.entity.Mood;
import com.couplenest.entity.User;
import com.couplenest.mapper.MoodMapper;
import com.couplenest.mapper.UserMapper;
import com.couplenest.service.MoodService;
import com.couplenest.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 心情业务实现。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MoodServiceImpl implements MoodService {

    /** 北京时间 */
    private static final ZoneId ZONE_BEIJING = ZoneId.of("Asia/Shanghai");

    private final MoodMapper moodMapper;
    private final UserMapper userMapper;
    private final UserService userService;

    @Override
    public Mood add(MoodAddRequest request) {
        Long familyId = userService.getCurrentFamilyId();

        Mood mood = new Mood();
        mood.setFamilyId(familyId);
        mood.setUserId(UserContext.getUserId());
        mood.setMoodType(request.getMoodType());
        mood.setContent(request.getContent());
        mood.setMoodDate(LocalDate.now(ZONE_BEIJING));
        mood.setCreatedAt(LocalDateTime.now(ZONE_BEIJING).withNano(0));
        moodMapper.insert(mood);

        log.info("记心情成功: familyId={}, moodId={}", familyId, mood.getId());
        return mood;
    }

    @Override
    public List<MoodVO> list() {
        Long familyId = userService.getCurrentFamilyId();
        List<Mood> moods = moodMapper.selectList(Wrappers.<Mood>lambdaQuery()
                .eq(Mood::getFamilyId, familyId)
                .orderByDesc(Mood::getMoodDate)
                .orderByDesc(Mood::getId));
        Map<Long, Integer> roleMap = roleMap(moods.stream().map(Mood::getUserId).collect(Collectors.toSet()));
        return moods.stream().map(m -> toVO(m, roleMap.get(m.getUserId()))).collect(Collectors.toList());
    }

    /** 批量查记录人角色：userId -> role */
    private Map<Long, Integer> roleMap(Set<Long> userIds) {
        userIds.remove(null);
        if (userIds.isEmpty()) {
            return Map.of();
        }
        return userMapper.selectBatchIds(userIds).stream()
                .filter(u -> u.getRole() != null)
                .collect(Collectors.toMap(User::getId, User::getRole, (a, b) -> a));
    }

    private MoodVO toVO(Mood m, Integer role) {
        MoodVO vo = new MoodVO();
        vo.setId(m.getId());
        vo.setUserId(m.getUserId());
        vo.setMoodType(m.getMoodType());
        vo.setContent(m.getContent());
        vo.setMoodDate(m.getMoodDate());
        vo.setRole(role);
        vo.setCreatedAt(m.getCreatedAt());
        return vo;
    }
}
