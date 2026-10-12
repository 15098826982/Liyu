package com.couplenest.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.couplenest.common.BusinessException;
import com.couplenest.common.UserContext;
import com.couplenest.dto.GoalAddRequest;
import com.couplenest.dto.GoalCheckinVO;
import com.couplenest.dto.GoalToggleVO;
import com.couplenest.dto.GoalVO;
import com.couplenest.entity.CheckinRecord;
import com.couplenest.entity.Family;
import com.couplenest.entity.Goal;
import com.couplenest.entity.Stage;
import com.couplenest.mapper.CheckinRecordMapper;
import com.couplenest.mapper.FamilyMapper;
import com.couplenest.mapper.GoalMapper;
import com.couplenest.service.GoalService;
import com.couplenest.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

/**
 * 目标管理业务实现。
 * 所有写操作都先按 familyId 校验归属，防跨家庭越权。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GoalServiceImpl implements GoalService {

    /** 模式：每日打卡 / 一次愿望 */
    private static final String MODE_CHECKIN = "checkin";
    private static final String MODE_WISH = "wish";
    /** 状态：0=进行中 1=已完成 */
    private static final int STATUS_ONGOING = 0;
    private static final int STATUS_COMPLETED = 1;
    /** 状态字符串（前端词表） */
    private static final String STR_ONGOING = "ongoing";
    private static final String STR_COMPLETED = "completed";
    /** 动作 */
    private static final String ACTION_CHECKIN = "checkin";
    private static final String ACTION_CANCEL = "cancel";
    private static final String ACTION_COMPLETE = "complete";
    /** 家庭状态：两人已齐 */
    private static final int FAMILY_STATUS_FULL = 1;
    /** 默认值 */
    private static final String DEFAULT_ICON = "🎯";
    private static final String DEFAULT_FREQUENCY = "每天";
    /** 北京时间 */
    private static final ZoneId ZONE_BEIJING = ZoneId.of("Asia/Shanghai");

    private final GoalMapper goalMapper;
    private final CheckinRecordMapper checkinRecordMapper;
    private final FamilyMapper familyMapper;
    private final UserService userService;

    @Override
    public Goal add(GoalAddRequest request) {
        Long familyId = userService.getCurrentFamilyId();

        // 1. 家庭必须已齐
        Family family = familyMapper.selectById(familyId);
        if (family == null || family.getStatus() == null || family.getStatus() != FAMILY_STATUS_FULL) {
            throw new BusinessException(BusinessException.CODE_FAMILY_NOT_READY, "等对象加入小窝后再创建目标");
        }

        boolean wishMode = MODE_WISH.equals(request.getMode());
        LocalDate start = parseDate(request.getStartDate());
        if (start == null) {
            start = LocalDate.now(ZONE_BEIJING);
        }
        int duration = request.getDuration() == null ? 0 : request.getDuration();

        Goal goal = new Goal();
        goal.setFamilyId(familyId);
        goal.setCreatorId(UserContext.getUserId());
        goal.setTitle(request.getTitle());
        goal.setDescription(notBlank(request.getDescription()) ? request.getDescription() : "");
        goal.setIcon(notBlank(request.getIcon()) ? request.getIcon() : DEFAULT_ICON);
        goal.setMode(request.getMode());
        goal.setFrequency(notBlank(request.getFrequency()) ? request.getFrequency() : DEFAULT_FREQUENCY);
        goal.setDuration(duration);
        goal.setStartDate(start);
        goal.setStatus(STATUS_ONGOING);

        if (wishMode) {
            // 愿望型：结束日 = 目标日，阶段文字转成 [{text, completed:false}]
            LocalDate goalDate = parseDate(request.getGoalDate());
            goal.setGoalDate(goalDate);
            goal.setEndDate(goalDate != null ? goalDate : start);
            goal.setStages(toStages(request.getStages()));
        } else {
            // 打卡型：结束日 = 开始日 + duration 天
            goal.setEndDate(start.plusDays(duration));
        }

        goal.setCreatedAt(LocalDateTime.now(ZONE_BEIJING).withNano(0));
        goalMapper.insert(goal);

        log.info("创建目标成功: familyId={}, goalId={}, mode={}", familyId, goal.getId(), goal.getMode());
        return goal;
    }

    @Override
    public List<GoalVO> list() {
        Long familyId = userService.getCurrentFamilyId();
        Long userId = UserContext.getUserId();
        LocalDate today = LocalDate.now(ZONE_BEIJING);

        List<Goal> goals = goalMapper.selectList(Wrappers.<Goal>lambdaQuery()
                .eq(Goal::getFamilyId, familyId)
                .orderByDesc(Goal::getId));

        List<GoalVO> result = new ArrayList<>(goals.size());
        for (Goal goal : goals) {
            result.add(toVO(goal, userId, today));
        }
        return result;
    }

    @Override
    public GoalCheckinVO checkin(Long goalId) {
        Long familyId = userService.getCurrentFamilyId();
        Long userId = UserContext.getUserId();
        LocalDate today = LocalDate.now(ZONE_BEIJING);
        Goal goal = requireFamilyGoal(goalId, familyId);

        LambdaQueryWrapper<CheckinRecord> mine = Wrappers.<CheckinRecord>lambdaQuery()
                .eq(CheckinRecord::getGoalId, goalId)
                .eq(CheckinRecord::getUserId, userId)
                .eq(CheckinRecord::getCheckinDate, today);

        String action;
        if (countRecords(mine) > 0) {
            // 今天已有我的记录 -> 取消打卡
            checkinRecordMapper.delete(mine);
            action = ACTION_CANCEL;
        } else {
            CheckinRecord record = new CheckinRecord();
            record.setGoalId(goalId);
            record.setUserId(userId);
            record.setCheckinDate(today);
            record.setCreatedAt(LocalDateTime.now(ZONE_BEIJING).withNano(0));
            checkinRecordMapper.insert(record);
            action = ACTION_CHECKIN;
        }

        GoalCheckinVO vo = buildCheckinVO(goal, userId, today);
        vo.setAction(action);
        return vo;
    }

    @Override
    public GoalToggleVO toggle(Long goalId) {
        Long familyId = userService.getCurrentFamilyId();
        Goal goal = requireFamilyGoal(goalId, familyId);

        int current = goal.getStatus() == null ? STATUS_ONGOING : goal.getStatus();
        int next = current == STATUS_COMPLETED ? STATUS_ONGOING : STATUS_COMPLETED;

        Goal update = new Goal();
        update.setId(goal.getId());
        update.setStatus(next);
        goalMapper.updateById(update);

        List<Stage> stages = goal.getStages() == null ? new ArrayList<>() : goal.getStages();
        GoalToggleVO vo = new GoalToggleVO();
        vo.setStatus(next == STATUS_COMPLETED ? STR_COMPLETED : STR_ONGOING);
        vo.setProgress(wishProgress(stages, next));
        vo.setStages(stages);
        vo.setAction(next == STATUS_COMPLETED ? ACTION_COMPLETE : ACTION_CANCEL);
        return vo;
    }

    @Override
    public GoalToggleVO toggleStage(Long goalId, Integer stageIndex) {
        Long familyId = userService.getCurrentFamilyId();
        Goal goal = requireFamilyGoal(goalId, familyId);

        List<Stage> stages = goal.getStages() == null ? new ArrayList<>() : new ArrayList<>(goal.getStages());
        if (stageIndex == null || stageIndex < 0 || stageIndex >= stages.size()) {
            throw new BusinessException(BusinessException.CODE_GOAL_NOT_FOUND, "目标阶段不存在");
        }
        Stage stage = stages.get(stageIndex);
        stage.setCompleted(!stage.isCompleted());

        boolean allCompleted = stages.stream().allMatch(Stage::isCompleted);
        int status = allCompleted ? STATUS_COMPLETED : STATUS_ONGOING;

        Goal update = new Goal();
        update.setId(goal.getId());
        update.setStages(stages);
        update.setStatus(status);
        goalMapper.updateById(update);

        GoalToggleVO vo = new GoalToggleVO();
        vo.setStatus(allCompleted ? STR_COMPLETED : STR_ONGOING);
        vo.setProgress(wishProgress(stages, status));
        vo.setStages(stages);
        vo.setAction(allCompleted ? ACTION_COMPLETE : null);
        return vo;
    }

    @Override
    public void delete(Long goalId) {
        Long familyId = userService.getCurrentFamilyId();
        Goal goal = requireFamilyGoal(goalId, familyId);

        goalMapper.deleteById(goal.getId());
        checkinRecordMapper.delete(Wrappers.<CheckinRecord>lambdaQuery()
                .eq(CheckinRecord::getGoalId, goal.getId()));

        log.info("删除目标成功: familyId={}, goalId={}", familyId, goal.getId());
    }

    /** 取目标并校验属于当前家庭，越权当作不存在 */
    private Goal requireFamilyGoal(Long goalId, Long familyId) {
        Goal goal = goalMapper.selectById(goalId);
        if (goal == null || !familyId.equals(goal.getFamilyId())) {
            throw new BusinessException(BusinessException.CODE_GOAL_NOT_FOUND, "目标不存在");
        }
        return goal;
    }

    private GoalVO toVO(Goal goal, Long userId, LocalDate today) {
        GoalVO vo = new GoalVO();
        vo.setId(goal.getId());
        vo.setTitle(goal.getTitle());
        vo.setDescription(goal.getDescription());
        vo.setIcon(goal.getIcon());
        vo.setMode(goal.getMode());
        vo.setFrequency(goal.getFrequency());
        vo.setDuration(goal.getDuration());
        vo.setStartDate(goal.getStartDate());
        vo.setEndDate(goal.getEndDate());
        vo.setGoalDate(goal.getGoalDate());
        vo.setCreatedAt(goal.getCreatedAt());

        if (MODE_CHECKIN.equals(goal.getMode())) {
            int duration = goal.getDuration() == null ? 0 : goal.getDuration();
            long checkedDays = countRecords(Wrappers.<CheckinRecord>lambdaQuery()
                    .eq(CheckinRecord::getGoalId, goal.getId()));
            int progress = duration > 0 ? (int) Math.min(100, checkedDays * 100.0 / duration) : 0;
            boolean todayChecked = countRecords(Wrappers.<CheckinRecord>lambdaQuery()
                    .eq(CheckinRecord::getGoalId, goal.getId())
                    .eq(CheckinRecord::getUserId, userId)
                    .eq(CheckinRecord::getCheckinDate, today)) > 0;
            boolean todayAnyChecked = countRecords(Wrappers.<CheckinRecord>lambdaQuery()
                    .eq(CheckinRecord::getGoalId, goal.getId())
                    .eq(CheckinRecord::getCheckinDate, today)) > 0;

            vo.setCheckedDays((int) checkedDays);
            vo.setProgress(progress);
            vo.setStatus(progress >= 100 ? STR_COMPLETED : STR_ONGOING);
            vo.setTodayChecked(todayChecked);
            vo.setTodayAnyChecked(todayAnyChecked);
        } else {
            List<Stage> stages = goal.getStages() == null ? new ArrayList<>() : goal.getStages();
            vo.setStages(stages);
            vo.setProgress(wishProgress(stages, goal.getStatus()));
            vo.setStatus(goal.getStatus() != null && goal.getStatus() == STATUS_COMPLETED ? STR_COMPLETED : STR_ONGOING);
        }
        return vo;
    }

    /** 打卡型：按目标重算计数与今日状态 */
    private GoalCheckinVO buildCheckinVO(Goal goal, Long userId, LocalDate today) {
        int duration = goal.getDuration() == null ? 0 : goal.getDuration();
        long checkedDays = countRecords(Wrappers.<CheckinRecord>lambdaQuery()
                .eq(CheckinRecord::getGoalId, goal.getId()));
        int progress = duration > 0 ? (int) Math.min(100, checkedDays * 100.0 / duration) : 0;
        boolean todayChecked = countRecords(Wrappers.<CheckinRecord>lambdaQuery()
                .eq(CheckinRecord::getGoalId, goal.getId())
                .eq(CheckinRecord::getUserId, userId)
                .eq(CheckinRecord::getCheckinDate, today)) > 0;
        boolean todayAnyChecked = countRecords(Wrappers.<CheckinRecord>lambdaQuery()
                .eq(CheckinRecord::getGoalId, goal.getId())
                .eq(CheckinRecord::getCheckinDate, today)) > 0;

        GoalCheckinVO vo = new GoalCheckinVO();
        vo.setCheckedDays((int) checkedDays);
        vo.setProgress(progress);
        vo.setStatus(progress >= 100 ? STR_COMPLETED : STR_ONGOING);
        vo.setTodayChecked(todayChecked);
        vo.setTodayAnyChecked(todayAnyChecked);
        return vo;
    }

    /** 愿望型进度：无阶段时看 status，有阶段时按已完成比例 */
    private int wishProgress(List<Stage> stages, Integer status) {
        int total = stages == null ? 0 : stages.size();
        if (total == 0) {
            return (status != null && status == STATUS_COMPLETED) ? 100 : 0;
        }
        long completed = stages.stream().filter(Stage::isCompleted).count();
        return (int) (completed * 100 / total);
    }

    private long countRecords(LambdaQueryWrapper<CheckinRecord> wrapper) {
        Long count = checkinRecordMapper.selectCount(wrapper);
        return count == null ? 0L : count;
    }

    /** 阶段文字数组 -> Stage 对象数组 */
    private List<Stage> toStages(List<String> texts) {
        List<Stage> stages = new ArrayList<>();
        if (texts == null) {
            return stages;
        }
        for (String text : texts) {
            if (notBlank(text)) {
                stages.add(new Stage(text.trim(), false));
            }
        }
        return stages;
    }

    /** YYYY-MM-DD -> LocalDate，空串当没传 */
    private LocalDate parseDate(String text) {
        if (!notBlank(text)) {
            return null;
        }
        try {
            return LocalDate.parse(text.trim());
        } catch (DateTimeParseException e) {
            throw new BusinessException(400, "日期格式不正确");
        }
    }

    private boolean notBlank(String s) {
        return s != null && !s.trim().isEmpty();
    }
}
