package com.couplenest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 错误日志表。
 */
@Data
@TableName("error_logs")
public class ErrorLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String module;

    private String action;

    private String errorMsg;

    /** 堆栈信息（字段名 stack 非保留字，可直接映射） */
    private String stack;

    /** 上下文信息，字段名 context 需注意不要与 SQL 关键字混淆 */
    private String context;

    private LocalDateTime createdAt;
}
