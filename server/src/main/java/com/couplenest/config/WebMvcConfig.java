package com.couplenest.config;

import com.couplenest.interceptor.AccessLogInterceptor;
import com.couplenest.interceptor.JwtInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 注册拦截器：除登录、健康检查外，全部接口都需要登录态。
 * 图片已改为存阿里云 OSS，不再需要本地静态资源映射。
 */
@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final JwtInterceptor jwtInterceptor;
    private final AccessLogInterceptor accessLogInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 访问日志拦截器 order=0，最早开始计时；登录、上传单独观察，不打印访问日志
        registry.addInterceptor(accessLogInterceptor)
                .order(0)
                .addPathPatterns("/**")
                .excludePathPatterns("/auth/login", "/upload");

        registry.addInterceptor(jwtInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns("/auth/login", "/ping", "/error");
    }
}
