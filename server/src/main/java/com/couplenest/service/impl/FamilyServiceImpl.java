package com.couplenest.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.couplenest.common.BusinessException;
import com.couplenest.dto.FamilyInfoVO;
import com.couplenest.dto.FamilyMemberVO;
import com.couplenest.dto.FamilyUpdateRequest;
import com.couplenest.dto.FamilyVO;
import com.couplenest.entity.Family;
import com.couplenest.entity.User;
import com.couplenest.mapper.FamilyMapper;
import com.couplenest.mapper.UserMapper;
import com.couplenest.service.FamilyService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 家庭创建 / 加入实现。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FamilyServiceImpl implements FamilyService {

    /** 角色常量 */
    private static final int ROLE_WIFE = 1;
    private static final int ROLE_HUSBAND = 2;
    /** 家庭状态：刚创建，等另一半加入 */
    private static final int STATUS_PENDING = 0;
    /** 家庭状态：两人已齐 */
    private static final int STATUS_FULL = 1;
    /** 家庭满员人数 */
    private static final int FAMILY_MEMBER_COUNT = 2;
    /** 邀请码最大重试次数 */
    private static final int MAX_RETRY = 5;

    /** 唯一索引名，用于判断是哪个索引冲突 */
    private static final String IDX_FAMILY_INVITE_CODE = "uk_family_invite_code";
    private static final String IDX_USER_FAMILY_ROLE = "uk_user_family_role";

    private final FamilyMapper familyMapper;
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;
    private final SecureRandom random = new SecureRandom();

    @Override
    @Transactional
    public FamilyVO create(Long userId, String name) {
        User current = userMapper.selectById(userId);
        if (current != null && current.getFamilyId() != null) {
            throw new BusinessException(BusinessException.CODE_ALREADY_IN_FAMILY,
                    "你已经有小窝了，请先退出再创建新的");
        }

        Family family = null;
        for (int i = 0; i < MAX_RETRY; i++) {
            String inviteCode = randomInviteCode();
            Family candidate = new Family();
            candidate.setName(name);
            candidate.setInviteCode(inviteCode);
            candidate.setStatus(0);
            try {
                familyMapper.insert(candidate);
                family = candidate;
                break;
            } catch (DuplicateKeyException e) {
                if (isDuplicateOf(e, IDX_FAMILY_INVITE_CODE)) {
                    log.warn("邀请码冲突，重新生成: {}", inviteCode);
                    continue;
                }
                throw e;
            }
        }
        if (family == null) {
            throw new BusinessException(BusinessException.CODE_INVITE_CODE_GENERATE_FAIL, "邀请码生成失败，请重试");
        }

        // 创建者成为老公
        User update = new User();
        update.setId(userId);
        update.setFamilyId(family.getId());
        update.setRole(ROLE_HUSBAND);
        userMapper.updateById(update);

        return toVO(family);
    }

    @Override
    @Transactional
    public FamilyVO join(Long userId, String inviteCode) {
        Family family = familyMapper.selectOne(
                Wrappers.<Family>lambdaQuery().eq(Family::getInviteCode, inviteCode));
        if (family == null) {
            throw new BusinessException(BusinessException.CODE_INVALID_INVITE_CODE, "邀请码无效");
        }

        User current = userMapper.selectById(userId);
        if (current != null && current.getFamilyId() != null) {
            // 已在本家庭：直接返回，保持 join 的幂等（超时重试 / 重复点击不报错、不重复写库）
            if (current.getFamilyId().equals(family.getId())) {
                return toVO(family);
            }
            // 已在别的家庭：拒绝。否则会把旧家庭丢掉，且旧家庭状态仍是「已齐」，形成脏数据
            throw new BusinessException(BusinessException.CODE_ALREADY_IN_FAMILY,
                    "你已经有小窝了，请先退出再加入新的");
        }

        // 加入者成为老婆；若该角色位已被占用，(family_id, role) 唯一索引会冲突
        User update = new User();
        update.setId(userId);
        update.setFamilyId(family.getId());
        update.setRole(ROLE_WIFE);
        try {
            userMapper.updateById(update);
        } catch (DuplicateKeyException e) {
            if (isDuplicateOf(e, IDX_USER_FAMILY_ROLE)) {
                throw new BusinessException(BusinessException.CODE_WIFE_SEAT_TAKEN, "这个家庭的老婆位置已经有人了");
            }
            throw e;
        }

        // 两人已齐
        Family familyUpdate = new Family();
        familyUpdate.setId(family.getId());
        familyUpdate.setStatus(STATUS_FULL);
        familyMapper.updateById(familyUpdate);
        family.setStatus(STATUS_FULL);

        return toVO(family);
    }

    @Override
    public FamilyInfoVO getInfo(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null || user.getFamilyId() == null) {
            return null;
        }
        Family family = familyMapper.selectById(user.getFamilyId());
        if (family == null) {
            return null;
        }

        List<User> users = userMapper.selectList(Wrappers.<User>lambdaQuery()
                .eq(User::getFamilyId, family.getId()));
        List<FamilyMemberVO> members = users.stream().map(u -> {
            FamilyMemberVO m = new FamilyMemberVO();
            m.setId(u.getId());
            m.setNickname(u.getNickname());
            m.setAvatar(u.getAvatar());
            m.setRole(u.getRole());
            return m;
        }).collect(Collectors.toList());

        FamilyInfoVO vo = new FamilyInfoVO();
        vo.setFamily(toVO(family));
        vo.setMembers(members);
        return vo;
    }

    @Override
    public void updateInfo(Long userId, FamilyUpdateRequest request) {
        User user = userMapper.selectById(userId);
        if (user == null || user.getFamilyId() == null) {
            return;
        }

        // 全部字段都没传时不更新（避免生成无 SET 子句的非法 SQL）
        boolean hasAnything = request.getCategories() != null
                || notBlank(request.getLoveStartDate())
                || notBlank(request.getAnniversaryDate())
                || request.getCoverImage() != null
                || request.getPageBg() != null;
        if (!hasAnything) {
            return;
        }

        Family familyUpdate = new Family();
        familyUpdate.setId(user.getFamilyId());
        if (request.getCategories() != null) {
            familyUpdate.setCategories(writeCategories(request.getCategories()));
        }
        familyUpdate.setLoveStartDate(parseDate(request.getLoveStartDate()));
        familyUpdate.setAnniversaryDate(parseDate(request.getAnniversaryDate()));
        familyUpdate.setCoverImage(request.getCoverImage());
        familyUpdate.setPageBg(request.getPageBg());
        familyMapper.updateById(familyUpdate);
    }

    @Override
    @Transactional
    public void leave(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null || user.getFamilyId() == null) {
            throw new BusinessException(BusinessException.CODE_NOT_IN_FAMILY, "你还没有加入小窝");
        }
        Long familyId = user.getFamilyId();

        // family_id / role 都置为 NULL，MyBatis-Plus 的 updateById 会跳过 null，必须用 UpdateWrapper
        userMapper.update(null, Wrappers.<User>lambdaUpdate()
                .eq(User::getId, userId)
                .set(User::getFamilyId, null)
                .set(User::getRole, null));

        // 退出后家庭人数不再满员，把状态退回「等另一半」，否则会出现「状态已齐但只剩一个人」的脏数据
        Long remaining = userMapper.selectCount(Wrappers.<User>lambdaQuery()
                .eq(User::getFamilyId, familyId));
        Family familyUpdate = new Family();
        familyUpdate.setId(familyId);
        familyUpdate.setStatus(remaining != null && remaining >= FAMILY_MEMBER_COUNT
                ? STATUS_FULL : STATUS_PENDING);
        familyMapper.updateById(familyUpdate);
    }

    /** 组装家庭 VO，categories 解析失败/为空时返回空数组 */
    private FamilyVO toVO(Family family) {
        FamilyVO vo = new FamilyVO();
        vo.setFamilyId(family.getId());
        vo.setInviteCode(family.getInviteCode());
        vo.setName(family.getName());
        vo.setStatus(family.getStatus());
        vo.setCategories(readCategories(family.getCategories()));
        vo.setLoveStartDate(family.getLoveStartDate());
        vo.setAnniversaryDate(family.getAnniversaryDate());
        vo.setCoverImage(family.getCoverImage());
        vo.setPageBg(family.getPageBg());
        return vo;
    }

    /** 非空非空白判断 */
    private boolean notBlank(String s) {
        return s != null && !s.trim().isEmpty();
    }

    /** yyyy-MM-dd → LocalDate；空/空白返回 null */
    private LocalDate parseDate(String s) {
        if (!notBlank(s)) {
            return null;
        }
        return LocalDate.parse(s.trim());
    }

    /** JSON 字符串 → List<String>，失败返回空数组 */
    private List<String> readCategories(String json) {
        if (json == null || json.isEmpty()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {
            });
        } catch (Exception e) {
            log.warn("家庭分类解析失败，返回空数组: {}", json, e);
            return Collections.emptyList();
        }
    }

    /** List<String> → JSON 字符串，失败返回 null */
    private String writeCategories(List<String> categories) {
        if (categories == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(categories);
        } catch (Exception e) {
            log.warn("家庭分类序列化失败", e);
            return null;
        }
    }

    /** 生成六位数字邀请码 */
    private String randomInviteCode() {
        return String.format("%06d", random.nextInt(1_000_000));
    }

    /** 判断 DuplicateKeyException 是否由指定唯一索引触发 */
    private boolean isDuplicateOf(DuplicateKeyException e, String indexName) {
        String msg = e.getMostSpecificCause().getMessage();
        return msg != null && msg.contains(indexName);
    }
}
