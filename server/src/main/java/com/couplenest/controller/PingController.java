package com.couplenest.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 健康检查接口，仅用于确认工程可以正常启动、对外可访问。
 */
@RestController
public class PingController {

    @GetMapping("/ping")
    public String ping() {
        return "ok";
    }
}
