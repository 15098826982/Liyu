package com.couplenest.controller;

import com.couplenest.common.BusinessException;
import com.couplenest.common.RateLimiter;
import com.couplenest.common.Result;
import com.couplenest.common.UserContext;
import com.couplenest.dto.UploadVO;
import com.couplenest.service.OssService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;

/**
 * 图片上传接口。需要登录态（由 JwtInterceptor 统一校验）。
 * 图片存阿里云 OSS，返回可直接访问的公网 url。
 */
@RestController
@RequiredArgsConstructor
public class UploadController {

    /** 同一用户每天最多上传 50 张 */
    private static final int UPLOAD_MAX_PER_DAY = 50;
    private static final Duration UPLOAD_WINDOW = Duration.ofDays(1);
    private static final String RATE_UPLOAD_PREFIX = "rate:upload:user:";

    private final OssService ossService;
    private final RateLimiter rateLimiter;

    /**
     * 上传图片。
     * 限流原因：登录用户可以不限量上传 5MB 图片，一旦账号被盗用或客户端被脚本刷，
     * OSS 的存储与下行流量是按量计费的——这里做的是"账单防护"，不只是接口保护。
     */
    @PostMapping("/upload")
    public Result<UploadVO> upload(@RequestParam("file") MultipartFile file,
                                   @RequestParam(value = "type", required = false) String type) {
        Long userId = UserContext.getUserId();
        if (!rateLimiter.tryAcquire(RATE_UPLOAD_PREFIX + userId, UPLOAD_MAX_PER_DAY, UPLOAD_WINDOW)) {
            throw new BusinessException(BusinessException.CODE_TOO_MANY_REQUESTS, "今天上传的图片有点多，明天再试吧");
        }
        UploadVO vo = new UploadVO();
        vo.setUrl(ossService.uploadFile(file, type));
        return Result.ok(vo);
    }
}
