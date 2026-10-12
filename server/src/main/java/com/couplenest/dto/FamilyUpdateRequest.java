package com.couplenest.dto;

import lombok.Data;

import java.util.List;

/**
 * 更新家庭信息请求：全部可选，传了才更新。
 * 日期用字符串接收，空串表示不修改（避免前端传空串时反序列化 LocalDate 报错）。
 */
@Data
public class FamilyUpdateRequest {

    private List<String> categories;

    /** 相恋日期 yyyy-MM-dd */
    private String loveStartDate;

    /** 纪念日 yyyy-MM-dd */
    private String anniversaryDate;

    /** 封面图 cloud:// */
    private String coverImage;

    /** 背景图 cloud:// */
    private String pageBg;
}
