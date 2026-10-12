package com.couplenest.dto;

import lombok.Data;

import java.time.LocalDate;
import java.util.List;

/**
 * 家庭返回：{ familyId, inviteCode, name, status, categories,
 * loveStartDate, anniversaryDate, coverImage, pageBg }。
 */
@Data
public class FamilyVO {

    private Long familyId;
    private String inviteCode;
    private String name;
    private Integer status;
    private List<String> categories;
    private LocalDate loveStartDate;
    private LocalDate anniversaryDate;
    private String coverImage;
    private String pageBg;
}
