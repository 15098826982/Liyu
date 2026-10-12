package com.couplenest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 用户表。
 * 联合唯一索引 UNIQUE(family_id, role)：保证一个家庭内一老公一老婆。
 */
@Data
@TableName("user")
public class User {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 微信 openid，唯一 */
    private String openid;

    private String nickname;

    private String avatar;

    /** 所属家庭 id，可空（未加入家庭时为空） */
    private Long familyId;

    /** 角色：1=老婆 2=老公，可空 */
    private Integer role;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
