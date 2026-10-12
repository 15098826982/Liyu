package com.couplenest;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 情侣小窝后端启动类（单体应用）。
 */
@SpringBootApplication
@EnableScheduling
@MapperScan("com.couplenest.mapper")
public class CoupleNestApplication {

    public static void main(String[] args) {
        SpringApplication.run(CoupleNestApplication.class, args);
    }
}
