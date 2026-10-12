package com.couplenest.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.couplenest.entity.Goal;
import org.apache.ibatis.annotations.Mapper;

/**
 * 目标表 Mapper，零 XML。
 */
@Mapper
public interface GoalMapper extends BaseMapper<Goal> {
}
