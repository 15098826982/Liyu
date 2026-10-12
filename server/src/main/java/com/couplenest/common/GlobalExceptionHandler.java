package com.couplenest.common;

import com.couplenest.entity.ErrorLog;
import com.couplenest.entity.User;
import com.couplenest.mapper.ErrorLogMapper;
import com.couplenest.mapper.UserMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * 全局异常处理器：统一返回信封 { code, msg, data }。
 * 只有"没预料到"的异常才落 error_logs，业务异常/唯一索引冲突属正常分支，不落库。
 */
@Slf4j
@RestControllerAdvice
@RequiredArgsConstructor
public class GlobalExceptionHandler {

    private static final int MAX_ACTION_LEN = 64;
    private static final int MAX_MSG_LEN = 1000;
    private static final int MAX_STACK_LEN = 5000;
    /** 北京时间 */
    private static final ZoneId ZONE_BEIJING = ZoneId.of("Asia/Shanghai");

    private final ErrorLogMapper errorLogMapper;
    private final UserMapper userMapper;

    /** 业务异常：正常业务分支，返回业务码，不落 error_logs */
    @ExceptionHandler(BusinessException.class)
    public Result<Void> handleBusiness(BusinessException e) {
        log.info("业务异常: code={}, msg={}", e.getCode(), e.getMessage());
        return Result.error(e.getCode(), e.getMessage());
    }

    /**
     * 唯一索引冲突：如重复下单 / 重复打卡。
     * 业务侧已各自捕获并给出友好提示，这里是兜底，同样按业务提示返回，不当系统错误落库。
     */
    @ExceptionHandler(DuplicateKeyException.class)
    public Result<Void> handleDuplicateKey(DuplicateKeyException e) {
        log.info("唯一索引冲突: {}", e.getMostSpecificCause().getMessage());
        return Result.error(409, "数据重复，请勿重复操作");
    }

    /** 参数校验失败 */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Void> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().isEmpty()
                ? "参数不合法"
                : e.getBindingResult().getFieldErrors().get(0).getDefaultMessage();
        log.info("参数校验失败: {}", msg);
        return Result.error(400, msg);
    }

    /** 兜底：未预料的异常 → 落 error_logs + 返回 500，堆栈只进日志和库，不给前端 */
    @ExceptionHandler(Exception.class)
    public Result<Void> handleOther(Exception e, HttpServletRequest request) {
        log.error("系统异常: {} {}", request.getMethod(), request.getRequestURI(), e);
        saveErrorLog(e, request);
        return Result.error(500, "系统开小差了");
    }

    /** 把系统异常写进 error_logs；落库失败只记日志，不能影响本次响应 */
    private void saveErrorLog(Exception e, HttpServletRequest request) {
        try {
            String uri = request.getRequestURI();
            ErrorLog errorLog = new ErrorLog();
            errorLog.setModule(firstSegment(uri));
            errorLog.setAction(truncate(request.getMethod() + " " + uri, MAX_ACTION_LEN));
            errorLog.setErrorMsg(truncate(
                    e.getMessage() == null ? e.getClass().getName() : e.getMessage(), MAX_MSG_LEN));
            errorLog.setStack(truncate(stackTrace(e), MAX_STACK_LEN));
            errorLog.setContext(buildContext(request));
            errorLog.setCreatedAt(LocalDateTime.now(ZONE_BEIJING).withNano(0));
            errorLogMapper.insert(errorLog);
        } catch (Exception logEx) {
            log.error("错误日志落库失败", logEx);
        }
    }

    /** 组装关键上下文：当前用户 id、所属家庭 id、请求方法与路径 */
    private String buildContext(HttpServletRequest request) {
        Long userId = UserContext.getUserId();
        Long familyId = null;
        if (userId != null) {
            User user = userMapper.selectById(userId);
            if (user != null) {
                familyId = user.getFamilyId();
            }
        }
        return String.format("{\"userId\":%s,\"familyId\":%s,\"method\":\"%s\",\"uri\":\"%s\"}",
                userId, familyId, request.getMethod(), request.getRequestURI());
    }

    /** 取路径第一段作为模块名，如 /dish/add → dish */
    private String firstSegment(String uri) {
        if (uri == null || uri.isEmpty() || "/".equals(uri)) {
            return "root";
        }
        String path = uri.startsWith("/") ? uri.substring(1) : uri;
        int idx = path.indexOf('/');
        return idx < 0 ? path : path.substring(0, idx);
    }

    private String stackTrace(Exception e) {
        StringWriter sw = new StringWriter();
        e.printStackTrace(new PrintWriter(sw));
        return sw.toString();
    }

    private String truncate(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() <= max ? s : s.substring(0, max);
    }
}
