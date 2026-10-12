package com.couplenest.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.couplenest.entity.CheckinRecord;
import org.apache.ibatis.annotations.Mapper;

/**
 * 目标打卡记录表 Mapper，零 XML。
 */
@Mapper
public interface CheckinRecordMapper extends BaseMapper<CheckinRecord> {
}
