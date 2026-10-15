package com.couplenest.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * 更新家庭信息请求：全部可选，传了才更新。
 * 日期用字符串接收，空串表示不修改（避免前端传空串时反序列化 LocalDate 报错），
 * 因此日期字段在这里不做过严的格式校验，由 Service 统一用 LocalDate.parse 处理。
 */
@Data
public class FamilyUpdateRequest {

    @Size(max = 20, message = "分类最多 20 个")
    private List<String> categories;

    /** 相恋日期 yyyy-MM-dd */
    private String loveStartDate;

    /** 纪念日 yyyy-MM-dd */
    private String anniversaryDate;

    /** 封面图地址 */
    @Size(max = 512, message = "封面图地址过长")
    private String coverImage;

    /** 背景图地址 */
    @Size(max = 512, message = "背景图地址过长")
    private String pageBg;
}
