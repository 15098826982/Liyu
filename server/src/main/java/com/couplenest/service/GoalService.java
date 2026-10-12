package com.couplenest.service;

import com.couplenest.dto.GoalAddRequest;
import com.couplenest.dto.GoalCheckinVO;
import com.couplenest.dto.GoalToggleVO;
import com.couplenest.dto.GoalVO;
import com.couplenest.entity.Goal;

import java.util.List;

/**
 * 目标管理（打卡页）业务。
 */
public interface GoalService {

    /** 新增目标，返回新建的 goal */
    Goal add(GoalAddRequest request);

    /** 当前家庭的目标列表（带进度 / 今日打卡状态） */
    List<GoalVO> list();

    /** 打卡型：今天没打过则打卡，打过则取消；返回最新计数 */
    GoalCheckinVO checkin(Long goalId);

    /** 愿望型：一键完成 / 取消完成 */
    GoalToggleVO toggle(Long goalId);

    /** 愿望型：勾选 / 取消勾选某个阶段 */
    GoalToggleVO toggleStage(Long goalId, Integer stageIndex);

    /** 删除目标及其打卡记录 */
    void delete(Long goalId);
}
