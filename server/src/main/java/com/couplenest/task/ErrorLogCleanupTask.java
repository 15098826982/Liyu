package com.couplenest.task;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.couplenest.entity.ErrorLog;
import com.couplenest.mapper.ErrorLogMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * error_logs 定期清理：每天凌晨 3 点删除 30 天前的记录。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ErrorLogCleanupTask {

    /** 北京时间 */
    private static final ZoneId ZONE_BEIJING = ZoneId.of("Asia/Shanghai");
    /** 保留天数 */
    private static final int KEEP_DAYS = 30;

    private final ErrorLogMapper errorLogMapper;

    @Scheduled(cron = "0 0 3 * * ?")
    public void cleanup() {
        LocalDateTime threshold = LocalDateTime.now(ZONE_BEIJING).minusDays(KEEP_DAYS);
        int deleted = errorLogMapper.delete(Wrappers.<ErrorLog>lambdaQuery()
                .lt(ErrorLog::getCreatedAt, threshold));
        log.info("error_logs 清理完成: 删除 {} 条 {} 之前的记录", deleted, threshold);
    }
}
