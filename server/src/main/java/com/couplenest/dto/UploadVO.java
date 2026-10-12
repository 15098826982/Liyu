package com.couplenest.dto;

import lombok.Data;

/**
 * 图片上传返回：可直接放到 <image src> 的完整地址。
 */
@Data
public class UploadVO {

    private String url;
}
