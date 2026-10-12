package com.couplenest.controller;

import com.couplenest.common.Result;
import com.couplenest.dto.UploadVO;
import com.couplenest.service.OssService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 图片上传接口。需要登录态（由 JwtInterceptor 统一校验）。
 * 图片存阿里云 OSS，返回可直接访问的公网 url。
 */
@RestController
@RequiredArgsConstructor
public class UploadController {

    private final OssService ossService;

    @PostMapping("/upload")
    public Result<UploadVO> upload(@RequestParam("file") MultipartFile file,
                                   @RequestParam(value = "type", required = false) String type) {
        String url = ossService.uploadFile(file, type);
        UploadVO vo = new UploadVO();
        vo.setUrl(url);
        return Result.ok(vo);
    }
}
