package com.couplenest.service.impl;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.couplenest.common.BusinessException;
import com.couplenest.entity.Family;
import com.couplenest.entity.User;
import com.couplenest.mapper.FamilyMapper;
import com.couplenest.mapper.UserMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 家庭创建 / 加入 / 退出的业务规则测试（纯 Mockito，不连数据库）。
 * 重点覆盖「跨家庭越权」和「退出后家庭状态回退」这两条容易出脏数据的规则。
 */
@ExtendWith(MockitoExtension.class)
class FamilyServiceImplTest {

    @Mock
    private FamilyMapper familyMapper;
    @Mock
    private UserMapper userMapper;
    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private FamilyServiceImpl familyService;

    /**
     * MyBatis-Plus 的 LambdaUpdateWrapper.set(User::getXxx, ...) 在生成列名时依赖实体的 TableInfo 缓存，
     * 平时的 Spring 容器启动会顺带初始化它；纯单元测试没有容器，需要在这里手动初始化，
     * 否则会抛 "can not find lambda cache for this entity"。
     */
    @BeforeAll
    static void initMybatisPlusTableInfo() {
        MapperBuilderAssistant assistant = new MapperBuilderAssistant(new MybatisConfiguration(), "");
        TableInfoHelper.initTableInfo(assistant, User.class);
        TableInfoHelper.initTableInfo(assistant, Family.class);
    }

    @Test
    void create_rejectsUserWhoAlreadyBelongsToAFamily() {
        when(userMapper.selectById(1L)).thenReturn(user(1L, 99L, 2));

        assertThatThrownBy(() -> familyService.create(1L, "小窝"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(BusinessException.CODE_ALREADY_IN_FAMILY);

        verify(familyMapper, never()).insert(any(Family.class));
    }

    @Test
    void join_isIdempotentWhenUserAlreadyInThatFamily() {
        Family family = family(7L, "ABC123", 1);
        when(familyMapper.selectOne(any())).thenReturn(family);
        when(userMapper.selectById(1L)).thenReturn(user(1L, 7L, 1));

        assertThat(familyService.join(1L, "ABC123").getFamilyId()).isEqualTo(7L);

        // 幂等：重复加入本家庭不应再写 user，也不应报错
        verify(userMapper, never()).updateById(any(User.class));
    }

    @Test
    void join_rejectsUserWhoBelongsToAnotherFamily() {
        Family family = family(7L, "ABC123", 0);
        when(familyMapper.selectOne(any())).thenReturn(family);
        when(userMapper.selectById(1L)).thenReturn(user(1L, 88L, 1));

        assertThatThrownBy(() -> familyService.join(1L, "ABC123"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(BusinessException.CODE_ALREADY_IN_FAMILY);
    }

    @Test
    void join_assignsWifeRoleAndMarksFamilyFull() {
        Family family = family(7L, "ABC123", 0);
        when(familyMapper.selectOne(any())).thenReturn(family);
        when(userMapper.selectById(1L)).thenReturn(user(1L, null, null));

        assertThat(familyService.join(1L, "ABC123").getStatus()).isEqualTo(1);

        verify(userMapper).updateById(org.mockito.ArgumentMatchers.<User>argThat(
                u -> Long.valueOf(7L).equals(u.getFamilyId()) && Integer.valueOf(1).equals(u.getRole())));
        verify(familyMapper).updateById(org.mockito.ArgumentMatchers.<Family>argThat(
                f -> Integer.valueOf(1).equals(f.getStatus())));
    }

    @Test
    void leave_clearsMembershipAndResetsFamilyStatusToPending() {
        when(userMapper.selectById(1L)).thenReturn(user(1L, 7L, 1));
        when(userMapper.selectCount(any())).thenReturn(1L);

        familyService.leave(1L);

        verify(userMapper).update(any(), any());
        verify(familyMapper).updateById(org.mockito.ArgumentMatchers.<Family>argThat(
                f -> Integer.valueOf(0).equals(f.getStatus())));
    }

    private static User user(Long id, Long familyId, Integer role) {
        User user = new User();
        user.setId(id);
        user.setFamilyId(familyId);
        user.setRole(role);
        return user;
    }

    private static Family family(Long id, String inviteCode, int status) {
        Family family = new Family();
        family.setId(id);
        family.setInviteCode(inviteCode);
        family.setStatus(status);
        return family;
    }
}
