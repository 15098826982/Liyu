package com.couplenest.service;

import com.couplenest.dto.MemoAddRequest;
import com.couplenest.dto.MemoUpdateRequest;
import com.couplenest.dto.MemoVO;
import com.couplenest.entity.Memo;

import java.util.List;

/**
 * 备忘录业务。
 */
public interface MemoService {

    /** 加备忘录 */
    Memo add(MemoAddRequest request);

    /** 查本家庭所有备忘录（带创建人角色，待办在前，已完成在后） */
    List<MemoVO> list();

    /** 改备忘录，只更新传了的字段 */
    void update(MemoUpdateRequest request);

    /** 翻转完成状态，返回翻转后的状态（true=已完成） */
    boolean toggle(Long memoId);

    /** 标记完成 */
    void done(Long memoId);

    /** 删除备忘录 */
    void delete(Long memoId);
}
