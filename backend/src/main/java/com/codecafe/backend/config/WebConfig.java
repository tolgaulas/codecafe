package com.codecafe.backend.config;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**") // Apply to all endpoints in the backend
            .allowedOrigins("http://localhost") // Allow requests from your frontend origin
            .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS") // Common HTTP methods
            .allowedHeaders("*") // Allow all headers
            .allowCredentials(true); // Important if your frontend sends credentials (e.g., cookies, auth headers)
    }
}
