package com.couplenest.service;

import com.couplenest.dto.MoodAddRequest;
import com.couplenest.dto.MoodVO;
import com.couplenest.entity.Mood;

import java.util.List;

/**
 * 心情业务。
 */
public interface MoodService {

    /** 记一条心情 */
    Mood add(MoodAddRequest request);

    /** 查本家庭心情记录（带记录人角色，按日期倒序） */
    List<MoodVO> list();
}
