package com.couplenest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 备忘录表。
 */
@Data
@TableName("memo")
public class Memo {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long familyId;

    /** 便签标题 */
    private String title;

    private String content;

    /** 便签颜色 */
    private String color;

    /** 分类：生活 / 购物 / 旅行 / 工作 / 其他 */
    private String category;

    /** 是否待办事项：0=否 1=是 */
    private Integer isTodo;

    private Long creatorId;

    /** 状态：0=待办 1=完成 */
    private Integer done;

    private LocalDateTime createdAt;
}
