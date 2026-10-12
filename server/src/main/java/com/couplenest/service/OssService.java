package com.couplenest.service;

import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.model.ObjectMetadata;
import com.couplenest.common.BusinessException;
import com.couplenest.config.OssProperties;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.Set;

/**
 * 图片上传到阿里云 OSS。
 * OSSClient 是线程安全的，启动时建一次、关闭时 shutdown，不随每次请求创建。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OssService {

    /** 单文件上限 5MB */
    private static final long MAX_FILE_SIZE = 5L * 1024 * 1024;
    /** 允许的扩展名 */
    private static final Set<String> ALLOWED_EXT = Set.of("jpg", "jpeg", "png", "webp");
    /** 允许的存放目录 */
    private static final Set<String> ALLOWED_TYPES = Set.of("avatar", "family", "dish", "wish", "common");
    private static final String DEFAULT_TYPE = "common";

    private final OssProperties ossProperties;

    private static final java.security.SecureRandom RANDOM = new java.security.SecureRandom();
    private static final String RANDOM_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

    private OSS ossClient;

    @PostConstruct
    public void init() {
        ossClient = new OSSClientBuilder()
                .build(ossProperties.getEndpoint(), ossProperties.getAccessKeyId(), ossProperties.getAccessKeySecret());
        log.info("OSSClient 初始化完成: endpoint={}, bucket={}", ossProperties.getEndpoint(), ossProperties.getBucketName());
    }

    @PreDestroy
    public void destroy() {
        if (ossClient != null) {
            ossClient.shutdown();
            log.info("OSSClient 已关闭");
        }
    }

    /**
     * 上传图片到 OSS。
     *
     * @param file 图片文件
     * @param type 业务类型，决定 objectKey 前缀
     * @return 可直接访问的公网 url
     */
    public String uploadFile(MultipartFile file, String type) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(400, "请选择要上传的图片");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BusinessException(400, "图片不能超过 5MB");
        }

        String dir = ALLOWED_TYPES.contains(type) ? type : DEFAULT_TYPE;

        // 优先用文件名的扩展名；微信压缩后的临时文件可能没扩展名，退化到 Content-Type
        String ext = extensionOf(file.getOriginalFilename());
        if (ext.isEmpty()) {
            ext = extFromContentType(file.getContentType());
        }
        if (ext == null || !ALLOWED_EXT.contains(ext)) {
            throw new BusinessException(400, "只支持 jpg / png / webp 格式的图片");
        }

        String objectKey = dir + "/" + System.currentTimeMillis() + "-" + randomString(6) + "." + ext;

        ObjectMetadata metadata = new ObjectMetadata();
        metadata.setContentLength(file.getSize());
        metadata.setContentType(contentTypeOf(ext));
        try (InputStream in = file.getInputStream()) {
            ossClient.putObject(ossProperties.getBucketName(), objectKey, in, metadata);
        } catch (IOException e) {
            throw new BusinessException(500, "图片上传失败，请稍后再试");
        }

        String url = "https://" + ossProperties.getBucketName() + "." + ossProperties.getEndpoint() + "/" + objectKey;
        log.info("上传 OSS 成功: key={}, size={}", objectKey, file.getSize());
        return url;
    }

    /** 取小写扩展名，没有则返回空串 */
    private String extensionOf(String filename) {
        if (filename == null) {
            return "";
        }
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) {
            return "";
        }
        return filename.substring(dot + 1).toLowerCase();
    }

    /** Content-Type -> 扩展名，不认识的返回 null */
    private String extFromContentType(String contentType) {
        if (contentType == null) {
            return null;
        }
        String ct = contentType.toLowerCase();
        if (ct.contains("jpeg") || ct.contains("jpg")) {
            return "jpg";
        }
        if (ct.contains("png")) {
            return "png";
        }
        if (ct.contains("webp")) {
            return "webp";
        }
        return null;
    }

    private String contentTypeOf(String ext) {
        switch (ext) {
            case "png":
                return "image/png";
            case "webp":
                return "image/webp";
            default:
                return "image/jpeg";
        }
    }

    private String randomString(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(RANDOM_CHARS.charAt(RANDOM.nextInt(RANDOM_CHARS.length())));
        }
        return sb.toString();
    }
}
