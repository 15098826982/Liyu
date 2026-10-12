package com.couplenest.dto;

import lombok.Data;

import java.util.List;

/**
 * 家庭详情：{ family, members }。
 */
@Data
public class FamilyInfoVO {

    private FamilyVO family;
    private List<FamilyMemberVO> members;
}
